import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findGuestBooking, cancelGuestBooking, serializeGuestBooking } from "@/lib/db/portal";
import { resolveHotelAvisoEmail, sendAvisoCancelacionHotel } from "@/lib/email/reserva";

export const dynamic = "force-dynamic";

const Body = z.object({
  folio: z.string().trim().min(4).max(20),
  email: z.email().max(160),
  confirmar: z.literal(true), // doble confirmación explícita desde la UI
});

// Cancelación self-service del huésped. Solo si la política del hotel lo
// permite (tarifa flexible, dentro del plazo). El reembolso del anticipo lo
// coordina el hotel (la automatización con Stripe llega en la fase de pagos).
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "datos-invalidos" }, { status: 400 });

  const booking = await findGuestBooking(parsed.data.folio, parsed.data.email);
  if (!booking) return NextResponse.json({ error: "no-encontrada" }, { status: 404 });

  if (!booking.cancelable) {
    return NextResponse.json(
      { error: "no-cancelable", motivo: booking.motivoNoCancelable },
      { status: 409 },
    );
  }

  const ok = await cancelGuestBooking(booking);
  if (!ok) return NextResponse.json({ error: "error-interno" }, { status: 500 });

  // Aviso inmediato al hotel: sin esto solo se enteraría revisando el panel.
  // Best-effort: la cancelación ya quedó hecha.
  try {
    const h = booking.row.hoteles;
    if (h) {
      const avisoTo = await resolveHotelAvisoEmail({
        id: booking.row.hotel_id,
        extras: h.extras,
        config: h.config,
      });
      if (avisoTo) {
        await sendAvisoCancelacionHotel(avisoTo, {
          hotelNombre: h.nombre,
          panelUrl: `${new URL(req.url).origin}/panel/${h.slug}/reservas`,
          confirmacion: booking.row.confirmacion,
          cliente: booking.row.cliente,
          email: booking.row.email,
          habitaciones: booking.row.habitaciones,
          checkin: booking.row.checkin,
          checkout: booking.row.checkout,
          anticipo: booking.row.anticipo,
        });
      }
    }
  } catch (e) {
    console.error("aviso de cancelación al hotel falló:", e);
  }

  booking.row.estado = "CANCELADA";
  booking.cancelable = false;
  booking.motivoNoCancelable = "estado";
  return NextResponse.json({ ok: true, booking: serializeGuestBooking(booking) });
}
