import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { resolveHotel } from "@/lib/tenant";
import {
  createBookingAtomic,
  findBookingByPaymentIntent,
  generarConfirmacion,
} from "@/lib/db/bookings";
import { releaseHold } from "@/lib/db/availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Webhook del motor público: cuando Stripe confirma el pago, crea la reserva de
// forma atómica (anti-overbooking) e idempotente. Verifica la firma con
// STRIPE_WEBHOOK_SECRET. El hotel_id viaja en la metadata (nunca del body abierto).
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET no configurado — webhook inactivo");
    return NextResponse.json({ error: "webhook-no-configurado" }, { status: 500 });
  }

  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig || "", secret);
  } catch (e) {
    console.error("Firma de webhook inválida:", e);
    return NextResponse.json({ error: "firma-invalida" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const md = session.metadata || {};
  const hotelId = md.hotel_id;
  if (!hotelId) return NextResponse.json({ error: "sin-hotel" }, { status: 400 });

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? "";

  try {
    // Idempotencia.
    if (paymentIntentId) {
      const existing = await findBookingByPaymentIntent(hotelId, paymentIntentId);
      if (existing) return NextResponse.json({ received: true, already: existing.confirmacion });
    }

    const habitaciones = (md.rooms || "")
      .split("|")
      .map((s) => {
        const i = s.lastIndexOf(":");
        return (i > 0 ? s.slice(0, i) : s).trim();
      })
      .filter(Boolean);

    const hotel = md.slug ? await resolveHotel(md.slug) : null;
    const confirmacion = generarConfirmacion(hotel?.prefijo_confirmacion);
    const huespedes = (Number(md.adults) || 0) + (Number(md.children) || 0) || 1;
    const email = md.customerEmail || session.customer_details?.email || "";

    // CLAVE anti-overbooking: liberar el HOLD de ESTA sesión ANTES de crear la
    // reserva, para que el RPC no lo cuente como solape contra sí mismo.
    if (md.holdSession) await releaseHold(hotelId, md.holdSession).catch(() => {});

    const result = await createBookingAtomic(hotelId, {
      habitaciones,
      checkin: md.checkin,
      checkout: md.checkout,
      confirmacion,
      cliente: md.customerName || null,
      telefono: md.customerPhone || null,
      email: email || null,
      total: Number(md.stayTotal) || 0,
      anticipo: Number(md.depositPaid) || 0,
      huespedes,
      paymentIntentId: paymentIntentId || null,
      estado: "CONFIRMADA",
      origen: "web",
    });

    if (!result.ok) {
      console.error("createBookingAtomic falló en webhook:", result.error);
      // 200 para no reintentar en bucle si fue conflicto de disponibilidad;
      // el pago ya ocurrió y queda por reconciliar manualmente.
      return NextResponse.json({ received: true, warning: result.error });
    }

    // Email de confirmación (gated por RESEND).
    if (process.env.RESEND_API_KEY && email.includes("@")) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM || (hotel?.config?.email_from as string) || "reservas@kora-hotel.com";
        await resend.emails.send({
          from,
          to: [email],
          subject: `Tu reserva está confirmada — ${confirmacion}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:480px;padding:24px;">
            <h2 style="color:#1B4332;">¡Reserva confirmada! 🎉</h2>
            <p>Gracias ${md.customerName || ""}. Tu reserva en <b>${hotel?.nombre ?? "el hotel"}</b> quedó confirmada.</p>
            <table style="border-collapse:collapse;width:100%;font-size:14px;">
              <tr><td style="padding:6px 0;color:#667;">Folio</td><td style="padding:6px 0;font-weight:600;">${confirmacion}</td></tr>
              <tr><td style="padding:6px 0;color:#667;">Habitación(es)</td><td style="padding:6px 0;">${habitaciones.join(", ")}</td></tr>
              <tr><td style="padding:6px 0;color:#667;">Llegada</td><td style="padding:6px 0;">${md.checkin}</td></tr>
              <tr><td style="padding:6px 0;color:#667;">Salida</td><td style="padding:6px 0;">${md.checkout}</td></tr>
              <tr><td style="padding:6px 0;color:#667;">Anticipo pagado</td><td style="padding:6px 0;font-weight:600;color:#1B4332;">$${Number(md.depositPaid).toLocaleString("es-MX")} MXN</td></tr>
              <tr><td style="padding:6px 0;color:#667;">Saldo al llegar</td><td style="padding:6px 0;">$${Number(md.pending).toLocaleString("es-MX")} MXN</td></tr>
            </table>
          </div>`,
        });
      } catch (e) {
        console.error("webhook email error:", e);
      }
    }

    return NextResponse.json({ received: true, created: confirmacion });
  } catch (e) {
    console.error("webhook handler error:", e);
    return NextResponse.json({ error: "handler-error" }, { status: 500 });
  }
}
