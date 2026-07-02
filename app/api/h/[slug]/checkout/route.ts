import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { resolveHotel } from "@/lib/tenant";
import {
  hotelRooms,
  bookingRules,
  calcCartSubtotal,
  calcNights,
  calcDepositAmount,
  calcAddonsTotal,
  calcNrfDiscount,
  type CartItem,
  type AddonRule,
} from "@/lib/booking";
import { checkAvailability, createTemporaryHold } from "@/lib/db/availability";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { getConnectState } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

const MIN_CENTS = 1000; // $10 MXN mínimo de Stripe
const OXXO_MAX_CENTS = 10_000_00; // tope de OXXO por transacción ($10,000 MXN)

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const CheckoutBody = z.object({
  cart: z
    .array(
      z.object({
        roomId: z.union([z.string(), z.number()]),
        guestCount: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(10),
  addons: z.array(z.coerce.number().int().min(0).max(99)).max(20).default([]),
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

  const parsed = CheckoutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de reserva inválidos" }, { status: 400 });
  }
  const { cart, addons, checkin, checkout, customerName, customerEmail, customerPhone, adults, children, ratePlan, payMode, lang } =
    parsed.data;

  const rooms = hotelRooms(hotel);
  const cleanCart: CartItem[] = [];
  for (const item of cart) {
    const room = rooms.find((r) => String(r.id) === String(item.roomId));
    if (!room) continue;
    cleanCart.push({
      roomId: room.id,
      guestCount: Math.max(1, Math.min(item.guestCount, room.maxGuests)),
    });
  }
  if (cleanCart.length === 0) {
    return NextResponse.json({ error: "Carrito inválido" }, { status: 400 });
  }
  const nights = calcNights(checkin, checkout);
  if (nights <= 0) return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });

  // Reglas del hotel (anticipo, mínimo de noches) — fuente autoritativa server-side.
  const rules = bookingRules(hotel);
  if (nights < rules.minNoches) {
    return NextResponse.json(
      { error: "min-noches", minNoches: rules.minNoches },
      { status: 400 },
    );
  }

  const roomNames = cleanCart.map((c) => rooms.find((r) => r.id === c.roomId)!.name);

  // Disponibilidad real antes de cobrar.
  const avail = await checkAvailability(hotel.id, checkin, checkout, roomNames);
  if (!avail.available) {
    return NextResponse.json(
      { error: "no-disponible", unavailableRooms: avail.unavailableRooms },
      { status: 409 },
    );
  }

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

  const stayTotal = Math.max(0, subtotal - nrfDiscount + addonsTotal);
  const esPagoHotel = payMode === "hotel";
  // "Pagar en el hotel": hoy no se cobra nada; la tarjeta queda como garantía.
  const deposit = esPagoHotel
    ? 0
    : calcDepositAmount(stayTotal, nights, {
        pct: rules.anticipoPct,
        minNights: rules.anticipoMinNoches,
      });
  const pending = stayTotal - deposit;
  const isDeposit = deposit > 0 && deposit < stayTotal;

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

  // Hold de 30 min para los cuartos elegidos (lo libera el webhook al confirmar;
  // si el huésped genera un voucher OXXO, el webhook lo extiende).
  const sessionId = `web_${Date.now().toString(36)}_${Math.round(Number(`0.${checkin.replace(/\D/g, "")}`) * 1e6)}`;
  await createTemporaryHold(hotel.id, roomNames, checkin, checkout, sessionId, 30);

  const roomsMeta = cleanCart
    .map((c) => `${rooms.find((r) => r.id === c.roomId)!.name}:${c.guestCount}`)
    .join("|")
    .slice(0, 480);

  const amountCents = Math.round(deposit * 100);
  if (!esPagoHotel && amountCents < MIN_CENTS) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const stripe = getStripe();

  const md: Record<string, string> = {
    hotel_id: hotel.id,
    slug,
    rooms: roomsMeta,
    addons: addonNames.join("|").slice(0, 200),
    checkin: String(checkin),
    checkout: String(checkout),
    nights: String(nights),
    stayTotal: String(stayTotal),
    depositPaid: String(deposit),
    pending: String(pending),
    isDeposit: String(isDeposit),
    anticipoPct: String(rules.anticipoPct),
    ratePlan: esNrf ? "nrf" : "flex",
    nrfDiscount: String(nrfDiscount),
    payMode,
    adults: String(adults),
    children: String(children),
    customerName: customerName || "",
    customerEmail: customerEmail || "",
    customerPhone: customerPhone || "",
    holdSession: sessionId,
    lang,
  };

  // DIRECT CHARGES: la sesión se crea EN la cuenta Stripe del hotel — el dinero
  // le entra directo y él absorbe la comisión de procesamiento (que es de
  // Stripe, no de Kora). Kora NO pone application_fee: $0 por reserva. Si el
  // hotel no tiene cuenta usable, el cobro cae a la cuenta plataforma
  // (degradado, reconciliable a mano) en vez de tronar el checkout.
  const requestOptions = direct ? { stripeAccount: connect.accountId as string } : undefined;

  const successUrl = `${origin}/h/${slug}/reservar/confirmacion?session_id={CHECKOUT_SESSION_ID}&lang=${lang}`;
  const cancelUrl = `${origin}/h/${slug}/reservar?cancelado=1&lang=${lang}`;

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
                }${esNrf ? " · Tarifa no reembolsable" : ""}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: customerEmail || undefined,
        metadata: md,
        payment_intent_data: { metadata: md },
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      requestOptions,
    );
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("checkout session error:", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
