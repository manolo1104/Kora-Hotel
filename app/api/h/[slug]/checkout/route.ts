import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { resolveHotel } from "@/lib/tenant";
import {
  hotelRooms,
  nightOpts,
  calcCartSubtotal,
  calcNights,
  calcDepositAmount,
  type CartItem,
} from "@/lib/booking";
import { checkAvailability, createTemporaryHold } from "@/lib/db/availability";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";

export const dynamic = "force-dynamic";

const MIN_CENTS = 1000; // $10 MXN mínimo de Stripe

// Crea la sesión de pago (Stripe Checkout hospedado) del motor público. El precio
// se calcula SIEMPRE en el servidor desde los cuartos del hotel; nunca se confía
// en el cliente. Si el hotel no tiene Stripe configurado, devuelve { whatsapp:true }
// para que el cliente caiga al flujo de reserva por WhatsApp.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  const body = await req.json();
  const { cart, checkin, checkout, customerName, customerEmail, customerPhone, adults, children } = body;

  const rooms = hotelRooms(hotel);
  const cleanCart: CartItem[] = [];
  for (const item of Array.isArray(cart) ? cart : []) {
    const room = rooms.find((r) => String(r.id) === String(item?.roomId));
    if (!room) continue;
    cleanCart.push({
      roomId: room.id,
      guestCount: Math.max(1, Math.min(Number(item?.guestCount) || 1, room.maxGuests)),
    });
  }
  if (cleanCart.length === 0 || !checkin || !checkout) {
    return NextResponse.json({ error: "Carrito o fechas inválidos" }, { status: 400 });
  }
  const nights = calcNights(checkin, checkout);
  if (nights <= 0) return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });

  const roomNames = cleanCart.map((c) => rooms.find((r) => r.id === c.roomId)!.name);

  // Disponibilidad real antes de cobrar.
  const avail = await checkAvailability(hotel.id, checkin, checkout, roomNames);
  if (!avail.available) {
    return NextResponse.json(
      { error: "no-disponible", unavailableRooms: avail.unavailableRooms },
      { status: 409 },
    );
  }

  const opts = nightOpts(hotel);
  const subtotal = calcCartSubtotal(rooms, cleanCart, checkin, checkout, opts);
  const stayTotal = Math.max(0, subtotal);
  const deposit = calcDepositAmount(stayTotal, nights);
  const pending = stayTotal - deposit;
  const isDeposit = nights >= 2;

  // Sin Stripe → flujo WhatsApp (degradación elegante).
  if (!stripeEnvReady) {
    return NextResponse.json({ whatsapp: true, whatsappNumber: hotel.whatsapp ?? null, stayTotal, deposit });
  }

  // Hold de 30 min para los cuartos elegidos (lo libera el webhook al confirmar).
  const sessionId = `web_${Date.now().toString(36)}_${Math.round(Number(`0.${checkin.replace(/\D/g, "")}`) * 1e6)}`;
  await createTemporaryHold(hotel.id, roomNames, checkin, checkout, sessionId, 30);

  const roomsMeta = cleanCart
    .map((c) => `${rooms.find((r) => r.id === c.roomId)!.name}:${c.guestCount}`)
    .join("|")
    .slice(0, 480);

  const amountCents = Math.round(deposit * 100);
  if (amountCents < MIN_CENTS) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const stripe = getStripe();

  const md: Record<string, string> = {
    hotel_id: hotel.id,
    slug,
    rooms: roomsMeta,
    checkin: String(checkin),
    checkout: String(checkout),
    nights: String(nights),
    stayTotal: String(stayTotal),
    depositPaid: String(deposit),
    pending: String(pending),
    isDeposit: String(isDeposit),
    adults: String(adults ?? ""),
    children: String(children ?? ""),
    customerName: customerName || "",
    customerEmail: customerEmail || "",
    customerPhone: customerPhone || "",
    holdSession: sessionId,
  };

  // Stripe Connect: si el hotel conectó su cuenta y puede cobrar (charges_enabled),
  // el pago se enruta a SU cuenta (destination charge). Comisión opcional con TOPE
  // [0,90]% (un fee > monto haría que Stripe rechace la sesión). Si la cuenta no
  // puede cobrar o la consulta falla, el pago va a la cuenta plataforma (degradado,
  // reconciliable) en vez de tronar el checkout.
  const piData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = { metadata: md };
  if (hotel.stripe_account_id) {
    try {
      const acct = await stripe.accounts.retrieve(hotel.stripe_account_id);
      if (acct.charges_enabled) {
        piData.transfer_data = { destination: hotel.stripe_account_id };
        const raw = hotel.config?.application_fee_pct;
        const feePct = typeof raw === "number" && isFinite(raw) ? Math.max(0, Math.min(raw, 90)) : 0;
        if (feePct > 0) piData.application_fee_amount = Math.round(amountCents * (feePct / 100));
      }
    } catch (e) {
      console.error("connect account retrieve error:", e);
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            unit_amount: amountCents,
            product_data: {
              name: `Reserva · ${hotel.nombre}`,
              description: `${checkin} a ${checkout} · ${nights} noche(s) · ${roomNames.join(", ")}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: customerEmail || undefined,
      metadata: md,
      payment_intent_data: piData,
      success_url: `${origin}/h/${slug}/reservar/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/h/${slug}/reservar?cancelado=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("checkout session error:", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
