import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { resolveHotel } from "@/lib/tenant";
import {
  createBookingAtomic,
  findBookingByPaymentIntent,
  generarConfirmacion,
  setBookingLang,
  type CrearReservaResult,
} from "@/lib/db/bookings";
import { releaseHold, extendHold } from "@/lib/db/availability";
import {
  registrarExperienciaVentas,
  liberarExperienciaVentas,
  liberarExperienciaApartado,
} from "@/lib/db/experiencias";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertar } from "@/lib/alertas";
import {
  sendConfirmacionReserva,
  sendAvisoReservaHotel,
  resolveHotelAvisoEmail,
  sendPagoSinCuartoHuesped,
  sendPagoSinCuartoHotel,
  type PagoSinCuartoArgs,
} from "@/lib/email/reserva";
import { bookingBrandFromHotel } from "@/lib/email/booking-branded";
import { NOTIFY_EMAIL } from "@/lib/email/resend";
import { deriveConnectState, upsertConnectState } from "@/lib/stripe/connect";
import { verificarFirma, pareceDeStripe, diagnosticoFirma } from "@/lib/stripe/firma";
import { leer, escribir } from "@/lib/db/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Webhook del motor público (reservas). Con DIRECT CHARGES los eventos llegan
// desde las cuentas conectadas de los hoteles, así que en Stripe se registra
// este endpoint DOS veces: como endpoint de cuenta propia (sesiones legadas de
// la plataforma) y como endpoint de "connected accounts". Cada registro tiene
// su propio secreto:
//   - STRIPE_WEBHOOK_SECRET_RESERVAS          (cuenta propia)
//   - STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT  (cuentas conectadas)
// (Y siguen siendo DISTINTOS del de suscripciones en /api/stripe/webhook.)
// Eventos: checkout.session.completed / async_payment_succeeded (confirman
// reserva), async_payment_failed / expired (liberan el hold), account.updated
// (persiste el estado Connect) y charge.refunded (marca reembolso y libera
// inventario). El hotel_id viaja en la metadata (nunca del body abierto).

function refOf(session: Stripe.Checkout.Session): string {
  // Referencia de idempotencia: el payment_intent, o el setup_intent cuando la
  // reserva es "pagar en hotel" (modo setup, sin cobro).
  return (
    (typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id) ||
    (typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id) ||
    ""
  );
}

// El peor caso del motor: el pago entró pero el cuarto se ocupó antes de crear
// la reserva (Checkout dejado abierto, o carrera de dos reservas). NUNCA en
// silencio: reembolso automático + correo al huésped + alerta al hotel y a Kora.
async function manejarPagoSinCuarto(
  session: Stripe.Checkout.Session,
  paymentRef: string,
  stripeAccount: string | null,
): Promise<void> {
  const md = session.metadata || {};
  const habitaciones = (md.rooms || "")
    .split("|")
    .map((s) => {
      const i = s.lastIndexOf(":");
      return (i > 0 ? s.slice(0, i) : s).trim();
    })
    .filter(Boolean);
  const monto = Number(md.depositPaid) || (session.amount_total ?? 0) / 100;

  // Reembolso automático (solo hubo cargo real en modo payment). OXXO no
  // admite reembolsos vía Stripe: en ese caso queda la alerta manual.
  let reembolsado = false;
  if (session.mode === "payment" && paymentRef.startsWith("pi_") && monto > 0) {
    try {
      await getStripe().refunds.create(
        { payment_intent: paymentRef },
        stripeAccount ? { stripeAccount } : undefined,
      );
      reembolsado = true;
    } catch (e) {
      console.error("reembolso automático falló (pago sin cuarto):", e);
    }
  }

  const hotel = md.slug ? await resolveHotel(md.slug).catch(() => null) : null;
  const args: PagoSinCuartoArgs = {
    hotelNombre: hotel?.nombre ?? md.slug ?? "el hotel",
    cliente: md.customerName || null,
    email: md.customerEmail || session.customer_details?.email || null,
    telefono: md.customerPhone || null,
    habitaciones,
    checkin: md.checkin || "",
    checkout: md.checkout || "",
    monto,
    reembolsado,
    lang: md.lang === "en" ? "en" : "es",
  };

  if (args.email) {
    await sendPagoSinCuartoHuesped(
      args.email,
      args,
      (hotel?.config?.email_from as string) || null,
    ).catch((e) => console.error("[h/webhooks/stripe] ignorado:", e));
  }
  if (hotel) {
    const avisoTo = await resolveHotelAvisoEmail(hotel).catch(() => "");
    if (avisoTo) await sendPagoSinCuartoHotel(avisoTo, args).catch((e) => console.error("[h/webhooks/stripe] ignorado:", e));
  }
  if (NOTIFY_EMAIL) await sendPagoSinCuartoHotel(NOTIFY_EMAIL, args).catch((e) => console.error("[h/webhooks/stripe] ignorado:", e));
}

// Crea la reserva (atómica e idempotente) a partir de una sesión de Checkout
// pagada o de una garantía de tarjeta completada, y envía la confirmación.
async function confirmarReserva(
  session: Stripe.Checkout.Session,
  origin: string,
  stripeAccount: string | null,
): Promise<NextResponse> {
  const md = session.metadata || {};
  const hotelId = md.hotel_id;
  // Sin hotel_id no es una sesión del motor (p.ej. suscripción SaaS): ignorar
  // con 200 para que Stripe no reintente en bucle.
  if (!hotelId) return NextResponse.json({ received: true, ignored: "sin-hotel" });

  const paymentRef = refOf(session);

  try {
    // Idempotencia.
    if (paymentRef) {
      const existing = await findBookingByPaymentIntent(hotelId, paymentRef);
      if (existing) return NextResponse.json({ received: true, already: existing.confirmacion });
    }

    const habitaciones = (md.rooms || "")
      .split("|")
      .map((s) => {
        const i = s.lastIndexOf(":");
        return (i > 0 ? s.slice(0, i) : s).trim();
      })
      .filter(Boolean);

    // Extras y experiencias contratados en el motor (metadata "nombre|nombre").
    // Se guardan en las notas de la reserva (registro durable para el hotelero)
    // y se listan en los correos de confirmación/aviso.
    const experiencias = (md.experiencias || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const addonsList = (md.addons || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const notasPartes: string[] = [];
    if (experiencias.length) notasPartes.push(`Experiencias: ${experiencias.join(", ")}`);
    if (addonsList.length) notasPartes.push(`Extras: ${addonsList.join(", ")}`);
    const bundleDiscount = Number(md.bundleDiscount) || 0;
    if (bundleDiscount > 0) notasPartes.push(`Descuento paquete: -$${bundleDiscount}`);
    // Que quede EN LA RESERVA, no sólo en un correo que se pierde: el hotelero
    // abre su panel, ve esta reserva y no encuentra el dinero en su Stripe
    // porque entró en el de Kora. Escrito aquí, la nota lo explica sola y sirve
    // para reconciliar después (K-21).
    if (md.cobroEn === "plataforma") {
      notasPartes.push("⚠️ Cobrado en la cuenta de Kora (el hotel no tenía Stripe listo)");
    }
    const notasReserva = notasPartes.join(" · ") || null;

    const hotel = md.slug ? await resolveHotel(md.slug) : null;

    // La sesión tiene que cuadrar con el hotel Y con la cuenta que la firmó.
    //
    // `hotelId` sale de `md.hotel_id`, o sea del propio cuerpo del evento. Quien
    // tenga una cuenta conectada bajo Kora puede crear una Checkout Session con
    // su llave y poner el `hotel_id` de OTRO hotel: al pagarla, este webhook le
    // crearía una reserva confirmada en el hotel ajeno y le bloquearía cuartos
    // reales. `event.account` —la cuenta que FIRMÓ el evento— es lo único que no
    // se puede falsificar desde el cuerpo.
    //
    // Se responde 200 (reintentar no arreglaría un desajuste de cuentas) y se
    // ALERTA con todo el detalle: si algún día esto rechazara una reserva
    // legítima —por ejemplo un hotel que rotó su cuenta de Stripe y todavía
    // tenía una sesión abierta de la anterior— el correo trae lo necesario para
    // crearla a mano en minutos, en vez de que el huésped pague y desaparezca.
    const cuentaNoCuadra =
      Boolean(stripeAccount) &&
      Boolean(hotel?.stripe_account_id) &&
      hotel!.stripe_account_id !== stripeAccount;
    if (!hotel || hotel.id !== hotelId || cuentaNoCuadra) {
      await alertar(
        "sesión de pago que no cuadra con su hotel",
        `metadata.hotel_id=${hotelId}, metadata.slug=${md.slug ?? "(ninguno)"}, ` +
          `hotel resuelto=${hotel?.id ?? "(ninguno)"}, cuenta del hotel=${hotel?.stripe_account_id ?? "(ninguna)"}, ` +
          `cuenta que firmó=${stripeAccount ?? "(plataforma)"}. NO se creó la reserva. ` +
          `Pago: ${paymentRef || "(sin referencia)"}, huésped: ${md.customerEmail || "(sin correo)"}.`,
      );
      return NextResponse.json({ received: true, ignored: "hotel-no-cuadra" });
    }

    const huespedes = (Number(md.adults) || 0) + (Number(md.children) || 0) || 1;
    const email = md.customerEmail || session.customer_details?.email || "";
    const esPagoHotel = md.payMode === "hotel";
    const anticipo = esPagoHotel ? 0 : Number(md.depositPaid) || 0;
    const total = Number(md.stayTotal) || 0;

    // El HOLD de esta sesión YA NO se borra antes de crear la reserva: ahora se le
    // pasa al RPC en `holdSession` y es él quien lo ignora al buscar solapes
    // (sql/kora-motor-fase4.sql). Borrarlo antes era el diseño frágil que costaba
    // reservas: si el DELETE fallaba —un timeout de Supabase bastaba— el RPC veía
    // el apartado del propio huésped como cuarto vendido y esto de abajo lo leía
    // como falta real de cuarto → reembolso de un pago bueno (K-03/K-47). Y si en
    // vez de eso se respondía 500, el cuarto quedaba libre durante toda la ventana
    // de reintentos de Stripe. Con el hold vivo hasta DESPUÉS de crear la reserva,
    // ninguno de los dos caminos existe.

    // El folio corto puede chocar con el índice único (hotel_id, confirmacion):
    // se reintenta con folio nuevo (el pago ya ocurrió; perderlo no es opción).
    let confirmacion = "";
    let result: CrearReservaResult = { ok: false };
    for (let intento = 0; intento < 3; intento++) {
      confirmacion = generarConfirmacion(hotel?.prefijo_confirmacion);
      result = await createBookingAtomic(hotelId, {
        habitaciones,
        checkin: md.checkin,
        checkout: md.checkout,
        confirmacion,
        cliente: md.customerName || null,
        telefono: md.customerPhone || null,
        email: email || null,
        total,
        anticipo,
        huespedes,
        paymentIntentId: paymentRef || null,
        estado: "CONFIRMADA",
        // origen "bot" = reserva cerrada por Camila (WhatsApp); si no, motor web.
        origen: esPagoHotel ? "web-pago-hotel" : md.origen === "bot" ? "bot" : "web",
        ratePlan: md.ratePlan === "nrf" ? "nrf" : "flex",
        notas: notasReserva,
        holdSession: md.holdSession || null,
      });
      if (result.ok || !/duplicate key|confirmacion/i.test(result.error ?? "")) break;
    }

    if (!result.ok) {
      // Conflicto REAL de disponibilidad: el cuarto se ocupó entre el pago y la
      // reserva. Reembolso automático + avisos (huésped, hotel, Kora) y 200:
      // reintentar no ayuda, el cuarto ya no existe.
      if (result.unavailable) {
        console.error("pago sin cuarto disponible:", result.error);
        await manejarPagoSinCuarto(session, paymentRef, stripeAccount);
        return NextResponse.json({ received: true, unavailable: true });
      }
      // Error transitorio (BD caída, timeout): 500 para que Stripe REINTENTE.
      // El RPC es idempotente por payment_intent, así que reintentar es seguro
      // — jamás perder en silencio una reserva ya pagada.
      //
      // El hold sigue vivo: ya no hay que devolverlo, porque no se borró. Sólo se
      // le estira la caducidad para que cubra los reintentos de Stripe (el primero
      // tarda del orden de una hora). Si esto falla, el hold caduca solo y como
      // mucho se pierde el apartado; antes, en cambio, el cuarto quedaba libre
      // desde el primer instante y otro huésped se lo llevaba.
      if (md.holdSession) {
        await extendHold(hotelId, md.holdSession, 4).catch((e) =>
          console.error("[h/webhooks/stripe] no pude estirar el hold:", e),
        );
      }
      await alertar(
        "no se pudo crear una reserva ya pagada",
        `Hotel ${hotelId}. Error: ${result.error}. El apartado sigue en pie y se responde 500 ` +
          `para que Stripe reintente. Si los reintentos se agotan, hay un huésped que pagó sin reserva.`,
      );
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // A partir de aquí manda el folio que dice LA BASE, no el que se generó arriba.
    // Cuando la idempotencia devolvió una reserva preexistente (reintento de
    // Stripe), el local es un folio que no existe: con él, el correo al huésped,
    // el aviso al hotel y el cupo de experiencias apuntaban a la nada (K-105/K-106).
    confirmacion = result.confirmacion ?? confirmacion;

    // Ahora sí: soltar el apartado temporal. La reserva ya existe y su block
    // 'RESERVADO' es la fuente de verdad de la ocupación, así que el HOLD sólo
    // estorba. Best-effort a propósito: si el borrado falla, el hold caduca solo
    // y mientras tanto ese cuarto se ve ocupado — molesto, pero nunca sobreventa,
    // y desde luego mejor que perder una reserva pagada por un DELETE fallido.
    if (md.holdSession) {
      const soltado = await releaseHold(hotelId, md.holdSession);
      if (!soltado) {
        console.error(
          `[h/webhooks/stripe] no pude soltar el hold ${md.holdSession} del hotel ${hotelId}; caducará solo`,
        );
      }
    }

    // Idioma con el que reservó: lo necesitan las secuencias pre/post estancia
    // para escribirle en su idioma (antes todo salía en español). Best-effort.
    await setBookingLang(hotelId, result.bookingId ?? "", md.lang === "en" ? "en" : "es");

    // Registrar los lugares de experiencias vendidos (cupo diario, Sprint 3).
    // Best-effort: nunca tumba el webhook — la reserva ya quedó creada.
    try {
      const data = JSON.parse(md.experiencias_data || "[]") as [string, number, string][];
      await registrarExperienciaVentas(
        hotelId,
        confirmacion,
        (Array.isArray(data) ? data : []).map((d) => ({
          experiencia: String(d?.[0] ?? ""),
          qty: Number(d?.[1]) || 0,
          fecha: String(d?.[2] ?? ""),
        })),
        // Si la caja ya había APARTADO estos lugares, esto es un ascenso (se les
        // pone el folio), no un alta. Insertarlos de nuevo los contaría dos
        // veces contra el cupo hasta que caducara el apartado.
        md.holdSession || null,
      );
    } catch {
      // Metadata ausente o malformada: la reserva queda sin registro de cupo.
    }

    // El intento de reserva quedó convertido: el cron de abandono ya no escribe.
    if (email.includes("@")) {
      try {
        await createAdminClient()
          .from("booking_intents")
          .update({ convertido: true, updated_at: new Date().toISOString() })
          .eq("hotel_id", hotelId)
          .eq("email", email.toLowerCase());
      } catch {
        // Tabla aún no creada o error transitorio: no afecta la reserva.
      }
    }

    // Email de confirmación (gated por RESEND dentro del helper).
    // El resultado NO se tira: este correo es el comprobante del huésped, y
    // perderlo en silencio es el fallo del que uno se entera por WhatsApp tres
    // días después. No se devuelve 500 a propósito —la reserva ya está creada y
    // reintentar duplicaría correos—; lo que faltaba era enterarse.
    const correoConfirmacionOk = await sendConfirmacionReserva(
      email,
      {
        hotelNombre: hotel?.nombre ?? "el hotel",
        confirmacion,
        habitaciones,
        checkin: md.checkin,
        checkout: md.checkout,
        anticipo,
        pendiente: Math.max(0, total - anticipo),
        cliente: md.customerName || null,
        huespedes,
        ratePlan: md.ratePlan || null,
        experiencias,
        portalUrl: `${origin}/reserva/consultar`,
        lang: md.lang === "en" ? "en" : "es",
        // Correo PREMIUM con marca del hotel + horas de check-in/out de su guía.
        brand: hotel ? bookingBrandFromHotel(hotel) : undefined,
        checkinTime: typeof hotel?.guia?.checkin === "string" ? hotel.guia.checkin : undefined,
        checkoutTime: typeof hotel?.guia?.checkout === "string" ? hotel.guia.checkout : undefined,
      },
      (hotel?.config?.email_from as string) || null,
    );
    if (!correoConfirmacionOk.ok) {
      await alertar(
        "confirmación de reserva NO enviada",
        `Reserva ${confirmacion} (hotel ${hotelId}, huésped ${email || "sin email"}). ` +
          `Motivo: ${correoConfirmacionOk.error}. La reserva SÍ se creó; lo que falló fue el ` +
          `correo. Reenviarlo desde el panel.`,
      );
    }

    // Aviso INMEDIATO al hotel (además del digest). Best-effort: nunca tumba
    // el webhook — la reserva ya quedó creada.
    if (hotel) {
      try {
        const avisoTo = await resolveHotelAvisoEmail(hotel);
        if (avisoTo) {
          await sendAvisoReservaHotel(avisoTo, {
            hotelNombre: hotel.nombre,
            panelUrl: `${origin}/panel/${hotel.slug}/reservas`,
            confirmacion,
            cliente: md.customerName || null,
            telefono: md.customerPhone || null,
            email: email || null,
            habitaciones,
            checkin: md.checkin,
            checkout: md.checkout,
            huespedes,
            total,
            anticipo,
            pagoEnHotel: esPagoHotel,
            ratePlan: md.ratePlan || null,
            experiencias,
          });
        }
      } catch (e) {
        console.error("aviso al hotel falló:", e);
      }
    }

    return NextResponse.json({ received: true, created: confirmacion });
  } catch (e) {
    console.error("webhook handler error:", e);
    return NextResponse.json({ error: "handler-error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET_RESERVAS && !process.env.STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT) {
    console.error("Secretos de webhook de reservas no configurados — webhook inactivo");
    return NextResponse.json({ error: "webhook-no-configurado" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  const event = verificarFirma(raw, sig || "");
  if (!event) {
    // Antes esto era un console.error que nadie miraba. Una firma inválida en el
    // webhook de reservas significa o que un secreto de Vercel está mal, o que
    // alguien está intentando inyectar eventos: en los dos casos hay que verlo.
    //
    // Pero un POST a esta URL SIN cabecera de firma no es ninguna de las dos: es
    // un robot rastreando internet, y esta ruta es pública. `alertar()` sólo
    // deduplica dentro de una invocación, así que cada robot mandaba un correo
    // idéntico al de un secreto mal puesto — que es el que sí hay que creerse.
    if (!pareceDeStripe(sig)) {
      console.error(
        "[h/webhooks/stripe] POST sin cabecera de firma de Stripe: no viene de Stripe, no se alerta",
      );
      return NextResponse.json({ error: "firma-invalida" }, { status: 400 });
    }
    await alertar("firma de webhook inválida (reservas)", diagnosticoFirma(raw, sig));
    return NextResponse.json({ error: "firma-invalida" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;

  try {
    return await manejarEvento(event, origin);
  } catch (e) {
    // Aquí caen las lecturas y escrituras que ahora LANZAN. 500 es lo correcto:
    // Stripe reintenta hasta 3 días, y estos eventos son idempotentes.
    await alertar(
      `webhook de reservas falló (${event.type})`,
      e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e),
    );
    return NextResponse.json({ error: "handler-error" }, { status: 500 });
  }
}

async function manejarEvento(event: Stripe.Event, origin: string): Promise<NextResponse> {
  switch (event.type) {
    // Pago inmediato (tarjeta) o garantía completada (pagar en hotel). Con OXXO
    // la sesión llega "completed" pero SIN pagar: se extiende el hold mientras
    // el huésped deposita (voucher de 1 día) y la reserva se crea al confirmarse
    // el pago (async_payment_succeeded).
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = session.metadata || {};
      if (!md.hotel_id) return NextResponse.json({ received: true, ignored: "sin-hotel" });
      if (session.mode === "setup" || session.payment_status === "paid") {
        return confirmarReserva(session, origin, event.account ?? null);
      }
      if (md.holdSession) await extendHold(md.hotel_id, md.holdSession, 48).catch((e) => console.error("[h/webhooks/stripe] ignorado:", e));
      return NextResponse.json({ received: true, pendingPayment: true });
    }

    // El pago diferido (OXXO) se acreditó → ahora sí, reserva confirmada.
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      return confirmarReserva(session, origin, event.account ?? null);
    }

    // El voucher venció o la sesión expiró sin pagar → soltar el cuarto.
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = session.metadata || {};
      if (md.hotel_id && md.holdSession) {
        await releaseHold(md.hotel_id, md.holdSession).catch((e) => console.error("[h/webhooks/stripe] ignorado:", e));
        // Y los lugares de experiencias que ese apartado tenía reservados: si no,
        // el cupo de un tour se queda ocupado por alguien que no pagó.
        await liberarExperienciaApartado(md.hotel_id, md.holdSession).catch((e) =>
          console.error("[h/webhooks/stripe] ignorado:", e),
        );
      }
      return NextResponse.json({ received: true, released: true });
    }

    // Estado de la cuenta conectada del hotel (onboarding, charges, payouts,
    // OXXO) → se persiste para que el checkout y el panel no consulten en vivo.
    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      let hotelId = acct.metadata?.hotel_id ?? null;
      if (!hotelId) {
        const fila = await leer<{ id: string }>(
          "hotel.porStripeAccount",
          createAdminClient()
            .from("hoteles")
            .select("id")
            .eq("stripe_account_id", acct.id)
            .maybeSingle(),
        );
        hotelId = fila?.id ?? null;
      }
      if (hotelId) await upsertConnectState(hotelId, deriveConnectState(acct));
      return NextResponse.json({ received: true, account: acct.id });
    }

    // Reembolso TOTAL → reserva REEMBOLSADA y se libera el inventario.
    // (charge.refunded es true solo cuando se devolvió todo; parciales se ignoran.)
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (!charge.refunded) return NextResponse.json({ received: true, partial: true });
      const pi =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : (charge.payment_intent?.id ?? "");
      if (!pi) return NextResponse.json({ received: true, ignored: "sin-pi" });

      const admin = createAdminClient();
      // Esta búsqueda recorre `bookings` ENTERA, sin filtro de hotel: es la única
      // del repo que no puede llevarlo, porque el evento no trae `hotel_id`. Lo
      // que ata el evento a su hotel es `event.account`, la cuenta conectada
      // desde la que llegó, y hay que comprobarlo ANTES de cancelar nada: marcar
      // REEMBOLSADA la reserva equivocada libera un cuarto vendido y de verdad.
      const booking = await leer<{
        id: string;
        hotel_id: string;
        estado: string;
        confirmacion: string | null;
      }>(
        "booking.porPaymentIntent",
        admin
          .from("bookings")
          .select("id, hotel_id, estado, confirmacion")
          .eq("payment_intent_id", pi)
          .maybeSingle(),
      );
      if (!booking) return NextResponse.json({ received: true, refunded: false });

      const hotelDeLaReserva = await leer<{ stripe_account_id: string | null }>(
        "hotel.cuentaStripe",
        admin
          .from("hoteles")
          .select("stripe_account_id")
          .eq("id", booking.hotel_id)
          .maybeSingle(),
      );
      const cuentaDelEvento = event.account ?? null;
      const cuentaDelHotel = hotelDeLaReserva?.stripe_account_id ?? null;
      if (cuentaDelEvento !== cuentaDelHotel) {
        // Se responde 200 y NO se toca nada: reintentar no arreglaría un
        // desajuste de cuentas. Puede ser legítimo (una reserva vieja cobrada en
        // la cuenta de Kora cuyo hotel se conectó a Connect después), y entonces
        // hay que marcarla a mano desde el panel; o puede ser el caso grave, y
        // entonces esta línea es la que impide cancelar una reserva ajena.
        await alertar(
          "reembolso que no cuadra con su hotel",
          `Cargo ${pi} llegó desde la cuenta ${cuentaDelEvento ?? "(plataforma)"} pero la ` +
            `reserva ${booking.confirmacion ?? booking.id} es del hotel ${booking.hotel_id}, ` +
            `cuya cuenta es ${cuentaDelHotel ?? "(ninguna)"}. NO se tocó la reserva.`,
        );
        return NextResponse.json({ received: true, ignored: "cuenta-no-coincide" });
      }

      if (booking.estado !== "REEMBOLSADA") {
        const { error } = await admin
          .from("bookings")
          .update({ estado: "REEMBOLSADA" })
          .eq("id", booking.id);
        // Si la BD aún no admite REEMBOLSADA (SQL fase 3 sin aplicar), cae a
        // CANCELADA. Este try SÍ es deliberado; el respaldo ya no es silencioso.
        if (error) {
          await escribir(
            "booking.reembolso.respaldoCancelada",
            admin.from("bookings").update({ estado: "CANCELADA" }).eq("id", booking.id),
          );
        }
        await escribir(
          "blocks.liberarPorReembolso",
          admin.from("blocks").delete().eq("hotel_id", booking.hotel_id).eq("booking_id", booking.id),
        );
        // Cupo de experiencias: reembolso total también libera los lugares.
        await liberarExperienciaVentas(booking.hotel_id, booking.confirmacion ?? "");
      }
      return NextResponse.json({ received: true, refunded: true });
    }

    // Cubierto por checkout.session.completed; se acusa recibo sin duplicar.
    case "payment_intent.succeeded":
      return NextResponse.json({ received: true, ignored: event.type });

    default:
      return NextResponse.json({ received: true, ignored: event.type });
  }
}
