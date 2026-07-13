import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { resolveHotel } from "@/lib/tenant";
import {
  createBookingAtomic,
  findBookingByPaymentIntent,
  generarConfirmacion,
  type CrearReservaResult,
} from "@/lib/db/bookings";
import { releaseHold, extendHold } from "@/lib/db/availability";
import { registrarExperienciaVentas, liberarExperienciaVentas } from "@/lib/db/experiencias";
import { createAdminClient } from "@/lib/supabase/admin";
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

function verificarFirma(raw: string, sig: string): Stripe.Event | null {
  const stripe = getStripe();
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS,
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT,
  ].filter(Boolean) as string[];
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(raw, sig, secret);
    } catch {
      // probar el siguiente secreto
    }
  }
  return null;
}

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
    ).catch(() => {});
  }
  if (hotel) {
    const avisoTo = await resolveHotelAvisoEmail(hotel).catch(() => "");
    if (avisoTo) await sendPagoSinCuartoHotel(avisoTo, args).catch(() => {});
  }
  if (NOTIFY_EMAIL) await sendPagoSinCuartoHotel(NOTIFY_EMAIL, args).catch(() => {});
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
    const notasReserva = notasPartes.join(" · ") || null;

    const hotel = md.slug ? await resolveHotel(md.slug) : null;
    const huespedes = (Number(md.adults) || 0) + (Number(md.children) || 0) || 1;
    const email = md.customerEmail || session.customer_details?.email || "";
    const esPagoHotel = md.payMode === "hotel";
    const anticipo = esPagoHotel ? 0 : Number(md.depositPaid) || 0;
    const total = Number(md.stayTotal) || 0;

    // CLAVE anti-overbooking: liberar el HOLD de ESTA sesión ANTES de crear la
    // reserva, para que el RPC no lo cuente como solape contra sí mismo.
    if (md.holdSession) await releaseHold(hotelId, md.holdSession).catch(() => {});

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
      console.error("createBookingAtomic falló en webhook (transitorio):", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

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
    await sendConfirmacionReserva(
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
        // Correo PREMIUM con logo + color del hotel (antes era básico).
        brand: hotel ? bookingBrandFromHotel(hotel) : undefined,
      },
      (hotel?.config?.email_from as string) || null,
    );

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
    console.error("Firma de webhook inválida (reservas)");
    return NextResponse.json({ error: "firma-invalida" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;

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
      if (md.holdSession) await extendHold(md.hotel_id, md.holdSession, 48).catch(() => {});
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
        await releaseHold(md.hotel_id, md.holdSession).catch(() => {});
      }
      return NextResponse.json({ received: true, released: true });
    }

    // Estado de la cuenta conectada del hotel (onboarding, charges, payouts,
    // OXXO) → se persiste para que el checkout y el panel no consulten en vivo.
    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      let hotelId = acct.metadata?.hotel_id ?? null;
      if (!hotelId) {
        const { data } = await createAdminClient()
          .from("hoteles")
          .select("id")
          .eq("stripe_account_id", acct.id)
          .maybeSingle();
        hotelId = (data as { id: string } | null)?.id ?? null;
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
      const { data } = await admin
        .from("bookings")
        .select("id, hotel_id, estado, confirmacion")
        .eq("payment_intent_id", pi)
        .maybeSingle();
      const booking = data as { id: string; hotel_id: string; estado: string; confirmacion: string | null } | null;
      if (booking && booking.estado !== "REEMBOLSADA") {
        const { error } = await admin
          .from("bookings")
          .update({ estado: "REEMBOLSADA" })
          .eq("id", booking.id);
        // Si la BD aún no admite REEMBOLSADA (SQL fase 3 sin aplicar), cae a CANCELADA.
        if (error) {
          await admin.from("bookings").update({ estado: "CANCELADA" }).eq("id", booking.id);
        }
        await admin.from("blocks").delete().eq("hotel_id", booking.hotel_id).eq("booking_id", booking.id);
        // Cupo de experiencias: reembolso total también libera los lugares.
        await liberarExperienciaVentas(booking.hotel_id, booking.confirmacion ?? "");
      }
      return NextResponse.json({ received: true, refunded: Boolean(booking) });
    }

    // Cubierto por checkout.session.completed; se acusa recibo sin duplicar.
    case "payment_intent.succeeded":
      return NextResponse.json({ received: true, ignored: event.type });

    default:
      return NextResponse.json({ received: true, ignored: event.type });
  }
}
