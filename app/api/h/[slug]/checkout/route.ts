import { construirMetadataBase } from "@/lib/booking/metadata";
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { resolveHotel } from "@/lib/tenant";
import {
  hotelRooms,
  bookingRules,
  seasonMinNoches,
  calcCartSubtotal,
  calcNights,
  calcDepositAmount,
  calcAddonsTotal,
  calcExperienciasTotal,
  experienciaFechasDisponibles,
  experienciaCupoQty,
  calcExperienciasBundleDiscount,
  type ExperienciasBundleRule,
  calcNrfDiscount,
  type CartItem,
  type AddonRule,
  type ExperienciaRule,
  type ExperienciaSelection,
  validarCapacidadCarrito,
  asignarUnidades,
} from "@/lib/booking";
import { freeUnitsByType, createTemporaryHold, releaseHold } from "@/lib/db/availability";
import { ventasPorExperiencia } from "@/lib/db/experiencias";
import { accesoDelHotel } from "@/lib/suscripcion";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { getConnectState } from "@/lib/stripe/connect";
import { alertar } from "@/lib/alertas";

/**
 * Hoteles por los que YA se avisó en esta instancia de la función. Una función
 * serverless vive minutos u horas, así que esto colapsa una ráfaga en unos pocos
 * correos sin perder el aviso. No se guarda en la base a propósito: los hoteles
 * sin Connect no tienen fila en `hotel_stripe_accounts` donde marcarlo, y meter
 * una columna nueva en `hoteles` para un aviso sería peor que el problema.
 */
const hotelesYaAvisados = new Set<string>();

export const dynamic = "force-dynamic";

const MIN_CENTS = 1000; // $10 MXN mínimo de Stripe
const OXXO_MAX_CENTS = 10_000_00; // tope de OXXO por transacción ($10,000 MXN)

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// "2026-07-18" → "sáb 18 jul" (para anotar la agenda de una experiencia en la
// descripción de Stripe, las notas de la reserva y los correos — es para el
// hotelero, en español). Día de semana en UTC para no depender de la TZ.
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtFechaCorta(f: string): string {
  const [y, m, d] = f.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS_CORTOS[dow]} ${d} ${MESES_CORTOS[m - 1] ?? ""}`;
}

const CheckoutBody = z.object({
  cart: z
    .array(
      z.object({
        roomId: z.union([z.string(), z.number()]),
        guestCount: z.coerce.number().int().min(1).max(20),
        quantity: z.coerce.number().int().min(1).max(20).default(1),
      }),
    )
    .min(1)
    .max(10),
  addons: z.array(z.coerce.number().int().min(0).max(99)).max(20).default([]),
  experiencias: z
    .array(
      z.object({
        i: z.coerce.number().int().min(0).max(99),
        qty: z.coerce.number().int().min(1).max(99).default(1),
        // Agenda (opcional): día y horario elegidos; se validan contra el catálogo.
        fecha: z.string().regex(FECHA).optional(),
        hora: z.string().trim().max(30).optional(),
      }),
    )
    .max(20)
    .default([]),
  checkin: z.string().regex(FECHA),
  checkout: z.string().regex(FECHA),
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.email().max(160),
  customerPhone: z.string().trim().min(7).max(30),
  adults: z.coerce.number().int().min(1).max(40).default(1),
  children: z.coerce.number().int().min(0).max(40).default(0),
  ratePlan: z.enum(["flex", "nrf"]).default("flex"),
  payMode: z.enum(["online", "hotel"]).default("online"),
  aceptaPolitica: z.literal(true), // el huésped debe aceptar la política de cancelación
  lang: z.enum(["es", "en"]).default("es"),
});

// Crea la sesión de pago (Stripe Checkout hospedado) del motor público. El precio
// se calcula SIEMPRE en el servidor desde los cuartos del hotel; nunca se confía
// en el cliente. Si el hotel no tiene Stripe configurado, devuelve { whatsapp:true }
// para que el cliente caiga al flujo de reserva por WhatsApp.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  // Hotel de demostración: el cliente simula el pago y nunca llama aquí, pero
  // el endpoint es público — nadie debe poder cobrarle o apartarle al demo.
  if ((hotel.extras as { demo?: boolean } | null)?.demo === true) {
    return NextResponse.json({ error: "hotel-demo" }, { status: 403 });
  }

  // Prueba vencida sin plan, cuenta bloqueada, o hotel DESPUBLICADO → no se
  // cobra. La página del motor ya se muestra pausada; esto cierra la puerta
  // también por API. `puedeCobrar` = activo Y publicado: despublicar es la forma
  // que tiene un hotelero de decir "esto no está al público", y hasta hoy le
  // seguían entrando cobros con tarjeta por ahí (K-124, K-158).
  const acceso = await accesoDelHotel(hotel);
  if (!acceso.puedeCobrar) {
    // Que el motivo sea "está despublicado" merece aviso: es el único caso en
    // que el hotelero cree tener su sitio apagado y aun así alguien llegó hasta
    // la caja. Si le pasa a un hotel real, se sabe el mismo día.
    if (acceso.activo && !acceso.publicado) {
      await alertar(
        "un cobro se detuvo por hotel despublicado",
        `El hotel ${hotel.slug} tiene publicado=false y alguien llegó hasta el ` +
          `pago. Antes ese cobro SÍ se procesaba. Si el hotelero espera vender, ` +
          `tiene que publicar su sitio desde el panel.`,
      );
    }
    return NextResponse.json({ error: "motor-pausado" }, { status: 403 });
  }

  const parsed = CheckoutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de reserva inválidos" }, { status: 400 });
  }
  const { cart, addons, experiencias, checkin, checkout, customerName, customerEmail, customerPhone, adults, children, ratePlan, payMode, lang } =
    parsed.data;

  const rooms = hotelRooms(hotel);
  const cleanCart: CartItem[] = [];
  for (const item of cart) {
    const room = rooms.find((r) => String(r.id) === String(item.roomId));
    if (!room) continue;
    cleanCart.push({
      roomId: room.id,
      guestCount: Math.max(1, Math.min(item.guestCount, room.maxGuests)),
      quantity: Math.max(1, Math.min(item.quantity, room.cantidad)),
    });
  }
  if (cleanCart.length === 0) {
    return NextResponse.json({ error: "Carrito inválido" }, { status: 400 });
  }
  // Capacidad: son DOS preguntas, no una. La vieja sólo hacía la primera, y la
  // hacía con `maxGuests` —que siempre alcanza—, así que pasaba siempre. El
  // precio sale de `guestCount`, y `guestCount` LO MANDA EL NAVEGADOR: un cuarto
  // de 4 pedido con `guestCount: 1` y `adults: 4` pagaba la tarifa de UNA
  // persona (K-16). Los menores, además, no contaban para nada (K-99).
  const capacidad = validarCapacidadCarrito(rooms, cleanCart, adults, children);
  if (!capacidad.ok) {
    return NextResponse.json({ error: capacidad.motivo }, { status: 400 });
  }
  const nights = calcNights(checkin, checkout);
  if (nights <= 0) return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });

  // Nada de reservar el pasado (el formato ya lo validó zod; comparar strings
  // YYYY-MM-DD funciona). "Hoy" en la zona del hotel, no en UTC.
  const hoyMx = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  if (checkin < hoyMx) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  // Reglas del hotel (anticipo, mínimo de noches) — fuente autoritativa server-side.
  // El mínimo puede ser mayor si la estancia LLEGA en una temporada con min-noches.
  const rules = bookingRules(hotel);
  const minNochesEfectivo = Math.max(rules.minNoches, seasonMinNoches(hotel, checkin));
  if (nights < minNochesEfectivo) {
    return NextResponse.json(
      { error: "min-noches", minNoches: minNochesEfectivo },
      { status: 400 },
    );
  }

  // Asignación de UNIDADES concretas por tipo (asignación app-side). Cada unidad
  // es un nombre único; reservar esos nombres con el candado atómico existente
  // garantiza que no haya sobreventa. Esto también HACE de chequeo de disponibilidad:
  // si un tipo no tiene suficientes unidades libres para la cantidad pedida → 409.
  const typesAvail = await freeUnitsByType(hotel.id, hotel, checkin, checkout);
  // `asignarUnidades` lleva un cursor por tipo y comprueba el total PEDIDO de
  // cada uno. El bucle que había aquí hacía `freeUnitNames.slice(0, qty)` en
  // cada línea por separado: dos líneas del mismo tipo cogían los MISMOS
  // nombres, y como `calcCartSubtotal` cobra por línea, al huésped se le cobraban
  // 6 cabañas y se le apartaban 3 (K-17).
  const asignacion = asignarUnidades(cleanCart, typesAvail);
  if (!asignacion.ok) {
    return NextResponse.json(
      { error: "no-disponible", unavailableRooms: asignacion.tipoAgotado ? [asignacion.tipoAgotado] : [] },
      { status: 409 },
    );
  }
  const allocated = asignacion.unidades;
  const roomNames = allocated.map((a) => a.name);

  const opts = rules.nightOpts;
  const subtotal = calcCartSubtotal(rooms, cleanCart, checkin, checkout, opts);

  // Rate plan: la tarifa No Reembolsable solo aplica si el hotel la activó y el
  // huésped PREPAGA (sin prepago no hay descuento). El % sale de SUS reglas.
  const esNrf = ratePlan === "nrf" && rules.nrfActiva && payMode === "online";
  const nrfDiscount = esNrf ? calcNrfDiscount(subtotal, rules.nrfPct) : 0;

  // Extras vendibles: se recalculan SIEMPRE desde la lista del hotel (no se
  // confía en montos del cliente; solo en los índices seleccionados).
  const hotelAddons = (
    Array.isArray((hotel.extras as Record<string, unknown>)?.addons)
      ? (hotel.extras as Record<string, unknown>).addons
      : []
  ) as AddonRule[];
  const selectedAddons: number[] = addons.filter((n) => n < hotelAddons.length);
  const addonNames = selectedAddons.map((i) => hotelAddons[i]?.nombre).filter(Boolean) as string[];
  const addonsTotal = calcAddonsTotal(hotelAddons, selectedAddons, nights, adults);

  // Experiencias vendibles (tours, traslados, cena): mismo principio que los
  // add-ons — se recalculan SIEMPRE desde el catálogo del hotel; el cliente solo
  // manda {índice, cantidad}. El nombre para la reserva incluye la cantidad si
  // se cobra por unidad (p. ej. "Tour Tamul ×2").
  const hotelExperiencias = (
    Array.isArray((hotel.extras as Record<string, unknown>)?.experiencias)
      ? (hotel.extras as Record<string, unknown>).experiencias
      : []
  ) as ExperienciaRule[];
  const selectedExperiencias: ExperienciaSelection[] = experiencias.filter(
    (e) => e.i < hotelExperiencias.length,
  );
  // Agenda: si el huésped eligió día/horario, deben existir en el catálogo del
  // hotel (un tour de solo-sábados no se puede apartar en martes). Sin fecha se
  // acepta igual (clientes viejos): queda como pendiente que el hotel coordina.
  for (const sel of selectedExperiencias) {
    const e = hotelExperiencias[sel.i];
    if (!e) continue;
    if (sel.fecha && !experienciaFechasDisponibles(e.dias, checkin, checkout).includes(sel.fecha)) {
      return NextResponse.json({ error: "experiencia-agenda" }, { status: 400 });
    }
    if (sel.hora && Array.isArray(e.horarios) && e.horarios.length > 0 && !e.horarios.includes(sel.hora)) {
      return NextResponse.json({ error: "experiencia-agenda" }, { status: 400 });
    }
  }

  // Cupo diario (Sprint 3): las selecciones con día no deben rebasar los
  // lugares del hotel para ese día (lo ya vendido sale de experiencia_ventas;
  // sin tabla la lectura devuelve {} y el cupo simplemente no se aplica).
  // `ventaItems` registra lo que ESTA reserva consumirá (lo escribe el webhook).
  const ventaItems: { experiencia: string; fecha: string; qty: number }[] = [];
  const conCupo = new Set(
    hotelExperiencias.filter((e) => (e.cupoDia ?? 0) > 0).map((e) => e.nombre),
  );
  for (const sel of selectedExperiencias) {
    const e = hotelExperiencias[sel.i];
    if (!e || !sel.fecha) continue;
    const q = experienciaCupoQty(e, sel.qty, adults);
    if (q > 0) ventaItems.push({ experiencia: e.nombre, fecha: sel.fecha, qty: q });
  }
  if (ventaItems.some((v) => conCupo.has(v.experiencia))) {
    const vendidos = await ventasPorExperiencia(hotel.id, [...conCupo], checkin, checkout);
    for (const v of ventaItems) {
      const e = hotelExperiencias.find((x) => x.nombre === v.experiencia);
      const cupo = e?.cupoDia ?? 0;
      if (cupo <= 0) continue;
      const ya = vendidos[v.experiencia]?.[v.fecha] ?? 0;
      if (ya + v.qty > cupo) {
        return NextResponse.json(
          { error: "experiencia-cupo", experiencia: v.experiencia, fecha: v.fecha, restante: Math.max(0, cupo - ya) },
          { status: 409 },
        );
      }
    }
  }
  const experienciaNames = selectedExperiencias
    .map((sel) => {
      const e = hotelExperiencias[sel.i];
      if (!e) return null;
      const cap = e.cantidadMax && e.cantidadMax > 0 ? Math.floor(e.cantidadMax) : Infinity;
      const qty =
        e.cobro === "unidad" ? Math.min(cap, Math.max(1, Math.floor(Number(sel.qty) || 1))) : 1;
      const base = qty > 1 ? `${e.nombre} ×${qty}` : e.nombre;
      // El día/horario viaja DENTRO del nombre ("Tour ×2 (sáb 15 jul, 9:00 am)"):
      // así webhook, notas de la reserva y correos lo muestran sin cambios.
      // La hora se limpia de "|" porque es el separador del metadata.
      const agenda = [sel.fecha ? fmtFechaCorta(sel.fecha) : null, sel.hora?.replace(/\|/g, "").trim() || null]
        .filter(Boolean)
        .join(", ");
      return agenda ? `${base} (${agenda})` : base;
    })
    .filter(Boolean) as string[];
  const experienciasTotal = calcExperienciasTotal(
    hotelExperiencias,
    selectedExperiencias,
    nights,
    adults,
  );

  // Descuento de paquete (Sprint 3): N+ experiencias distintas → % sobre las
  // experiencias. La regla es DEL HOTEL (extras); el cliente no manda montos.
  const bundleRule = ((hotel.extras as Record<string, unknown>)?.experienciasBundle ?? null) as
    | ExperienciasBundleRule
    | null;
  const bundleDiscount = calcExperienciasBundleDiscount(
    experienciasTotal,
    selectedExperiencias.length,
    bundleRule,
  );

  const stayTotal = Math.max(0, subtotal - nrfDiscount + addonsTotal + experienciasTotal - bundleDiscount);
  const esPagoHotel = payMode === "hotel";
  // "Pagar en el hotel": hoy no se cobra nada; la tarjeta queda como garantía.
  const deposit = esPagoHotel
    ? 0
    : calcDepositAmount(stayTotal, nights, {
        pct: rules.anticipoPct,
        minNights: rules.anticipoMinNoches,
      });
  const pending = stayTotal - deposit;

  // Sin Stripe → flujo WhatsApp (degradación elegante).
  if (!stripeEnvReady) {
    return NextResponse.json({ whatsapp: true, whatsappNumber: hotel.whatsapp ?? null, stayTotal, deposit });
  }

  // Estado Connect del hotel (cache en BD; lo mantiene fresco account.updated).
  const connect = await getConnectState(hotel.id, hotel.stripe_account_id);
  const direct = Boolean(connect.chargesEnabled && connect.accountId);

  // La tarjeta-garantía se guarda en la cuenta Stripe DEL HOTEL: exige que el
  // hotel haya activado la opción y tenga su cuenta lista.
  if (esPagoHotel && (!rules.pagoEnHotel || !direct)) {
    return NextResponse.json({ error: "pago-hotel-no-disponible" }, { status: 400 });
  }

  // Validar el monto ANTES de apartar nada (si esto falla, no debe quedar hold).
  const amountCents = Math.round(deposit * 100);
  if (!esPagoHotel && amountCents < MIN_CENTS) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  // Hold de 35 min para los cuartos elegidos (lo libera el webhook al confirmar,
  // el huésped al cancelar en Stripe, o expira solo). El id es un UUID: solo
  // quien inició la sesión lo conoce. Si el huésped genera un voucher OXXO, el
  // webhook extiende el hold.
  const sessionId = `web_${crypto.randomUUID()}`;
  await createTemporaryHold(hotel.id, roomNames, checkin, checkout, sessionId, 35);

  // Metadata: una entrada por UNIDAD asignada ("Unidad:huespedes"). El webhook las
  // reserva por nombre con el candado atómico (igual que hoy con varios cuartos).
  const roomsMeta = allocated
    .map((a) => `${a.name}:${a.guestCount}`)
    .join("|")
    .slice(0, 480);

  const origin = new URL(req.url).origin;
  const stripe = getStripe();

  // Datos estructurados de experiencias para el webhook (registra el cupo en
  // experiencia_ventas). JSON compacto [[nombre, lugares, fecha], …], armado
  // incremental para no partir el JSON con el tope de 500 chars del metadata.
  let experienciasData = "[]";
  {
    const acc: [string, number, string][] = [];
    for (const v of ventaItems) {
      const next = JSON.stringify([...acc, [v.experiencia, v.qty, v.fecha]]);
      if (next.length > 480) break;
      acc.push([v.experiencia, v.qty, v.fecha]);
      experienciasData = next;
    }
  }

  // La parte compartida sale de `lib/booking/metadata.ts` — el mismo constructor
  // que usa Camila. Encima van sólo los extras que el motor web sí vende.
  const md: Record<string, string> = {
    ...construirMetadataBase({
      hotelId: hotel.id,
      slug,
      rooms: roomsMeta,
      checkin: String(checkin),
      checkout: String(checkout),
      nights,
      stayTotal,
      deposit,
      pending,
      anticipoPct: rules.anticipoPct,
      ratePlan: esNrf ? "nrf" : "flex",
      payMode: payMode === "hotel" ? "hotel" : "online",
      adults,
      children,
      customerName: customerName || "",
      customerEmail: customerEmail || "",
      customerPhone: customerPhone || "",
      holdSession: sessionId,
      lang,
    }),
    addons: addonNames.join("|").slice(0, 200),
    experiencias: experienciaNames.join("|").slice(0, 480),
    experiencias_data: experienciasData,
    bundleDiscount: String(bundleDiscount),
    nrfDiscount: String(nrfDiscount),
    // Deja escrito EN LA SESIÓN de Stripe en qué cuenta entró el dinero. Sin
    // esto, un cobro caído en la cuenta de Kora es indistinguible de uno normal:
    // la reserva se crea igual, el panel de Pagos del hotelero sólo consulta su
    // cuenta conectada, y ese dinero es invisible para él (K-21).
    cobroEn: direct ? "hotel" : "plataforma",
  };

  // Y que alguien se entere el mismo día. Cuatro de los seis hoteles publicados
  // estaban en este estado el 26 ago 2026 (dos con la cuenta a medias y dos sin
  // cuenta), así que NO se cierra la puerta devolviendo `{whatsapp:true}`: eso
  // les apagaría el motor a los cuatro. Primero se ve, luego se cierra.
  if (!direct && !hotelesYaAvisados.has(hotel.id)) {
    hotelesYaAvisados.add(hotel.id);
    await alertar(
      `cobro a la cuenta de Kora, no a la del hotel (${slug})`,
      `El hotel ${slug} (${hotel.id}) está publicado y vendiendo, pero su cuenta de Stripe ` +
        `no puede cobrar: ${connect.accountId ? `cuenta ${connect.accountId}, alta ${connect.onboardingStatus}` : "no tiene cuenta"}. ` +
        `El dinero de esta reserva entra a la cuenta de Kora y el hotelero no lo verá en su panel. ` +
        `Hay que reconciliarlo a mano y pedirle que termine su alta en Stripe.`,
    );
  }

  // DIRECT CHARGES: la sesión se crea EN la cuenta Stripe del hotel — el dinero
  // le entra directo y él absorbe la comisión de procesamiento (que es de
  // Stripe, no de Kora). Kora NO pone application_fee: $0 por reserva. Si el
  // hotel no tiene cuenta usable, el cobro cae a la cuenta plataforma
  // (degradado, reconciliable a mano) en vez de tronar el checkout.
  const requestOptions = direct ? { stripeAccount: connect.accountId as string } : undefined;

  const successUrl = `${origin}/h/${slug}/reservar/confirmacion?session_id={CHECKOUT_SESSION_ID}&lang=${lang}`;
  // El hs permite al cliente liberar SU hold al volver de un pago cancelado
  // (sin esto, el huésped se auto-bloqueaba el cuarto 30+ minutos).
  const cancelUrl = `${origin}/h/${slug}/reservar?cancelado=1&hs=${sessionId}&lang=${lang}`;

  // La sesión de Checkout no debe vivir más que el hold: sin esto, un huésped
  // podía pagar horas después con el cuarto ya revendido. (Mínimo de Stripe:
  // 30 min; el hold de 35 lo cubre.)
  const expiresAt = Math.floor(Date.now() / 1000) + 31 * 60;

  try {
    // "Pagar en el hotel": Checkout en modo setup — guarda la tarjeta como
    // garantía en la cuenta del hotel, sin cobrar nada hoy.
    if (esPagoHotel) {
      const customer = await stripe.customers.create(
        {
          email: customerEmail,
          name: customerName,
          phone: customerPhone,
          metadata: { hotel_id: hotel.id, slug },
        },
        requestOptions,
      );
      const session = await stripe.checkout.sessions.create(
        {
          mode: "setup",
          customer: customer.id,
          payment_method_types: ["card"],
          metadata: md,
          expires_at: expiresAt,
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
        requestOptions,
      );
      return NextResponse.json({ url: session.url });
    }

    // Métodos: tarjeta siempre; OXXO si la cuenta del hotel tiene la capability
    // activa y el monto cabe en el tope de OXXO.
    const conOxxo = direct && connect.oxxoEnabled && amountCents <= OXXO_MAX_CENTS;
    const pmTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = conOxxo
      ? ["card", "oxxo"]
      : ["card"];

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: pmTypes,
        // Voucher OXXO de 1 día: acota cuánto tiempo queda apartado el cuarto
        // mientras el huésped va a pagar en efectivo.
        ...(conOxxo ? { payment_method_options: { oxxo: { expires_after_days: 1 } } } : {}),
        line_items: [
          {
            price_data: {
              currency: "mxn",
              unit_amount: amountCents,
              product_data: {
                name: `Reserva · ${hotel.nombre}`,
                description: `${checkin} a ${checkout} · ${nights} noche(s) · ${roomNames.join(", ")}${
                  addonNames.length ? ` · Extras: ${addonNames.join(", ")}` : ""
                }${experienciaNames.length ? ` · Experiencias: ${experienciaNames.join(", ")}` : ""}${
                  bundleDiscount > 0 ? ` · Descuento paquete: -$${bundleDiscount}` : ""
                }${esNrf ? " · Tarifa no reembolsable" : ""}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: customerEmail || undefined,
        metadata: md,
        payment_intent_data: { metadata: md },
        expires_at: expiresAt,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      requestOptions,
    );
    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Si Stripe falló, el hold no debe quedarse apartando el cuarto.
    await releaseHold(hotel.id, sessionId).catch((e) => console.error("[h/[slug]/checkout] ignorado:", e));
    console.error("checkout session error:", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
