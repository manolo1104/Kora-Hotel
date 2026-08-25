import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findGuestBooking, cancelGuestBooking, serializeGuestBooking } from "@/lib/db/portal";
import {
  resolveHotelAvisoEmail,
  sendAvisoCancelacionHotel,
  sendCancelacionHuesped,
} from "@/lib/email/reserva";
import { bookingBrandFromHotel, bookingFromHotel } from "@/lib/email/booking-branded";
import type { HotelRow } from "@/lib/tenant";

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

  // Comprobante al HUÉSPED. Antes solo se avisaba al hotel y el huésped se
  // quedaba sin constancia de su propia cancelación. Best-effort.
  try {
    const h = booking.row.hoteles;
    if (h && booking.row.email) {
      const hotelParaMarca = {
        nombre: h.nombre,
        ubicacion: null,
        whatsapp: h.whatsapp,
        config: h.config,
        extras: h.extras,
      };
      await sendCancelacionHuesped(
        booking.row.email,
        {
          hotelNombre: h.nombre,
          confirmacion: booking.row.confirmacion,
          cliente: booking.row.cliente,
          habitaciones: booking.row.habitaciones,
          checkin: booking.row.checkin,
          checkout: booking.row.checkout,
          anticipo: booking.row.anticipo,
          // Llegó aquí porque la política lo permitía: cancelación sin cargo.
          reembolsable: booking.row.rate_plan !== "nrf",
          brand: bookingBrandFromHotel(hotelParaMarca),
        },
        bookingFromHotel({ config: h.config } as HotelRow),
      );
    }
  } catch (e) {
    console.error("comprobante de cancelación al huésped falló:", e);
  }

  booking.row.estado = "CANCELADA";
  booking.cancelable = false;
  booking.motivoNoCancelable = "estado";
  return NextResponse.json({ ok: true, booking: serializeGuestBooking(booking) });
}
