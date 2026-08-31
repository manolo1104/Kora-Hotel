import { NextRequest, NextResponse } from "next/server";
import { rateLimited, ipDe } from "@/lib/api/rate-limit";
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
  // Cancelar es irreversible y manda dos correos. El límite es la segunda red,
// después del UPDATE condicionado de `cancelGuestBooking`.
  if (rateLimited("reserva.cancelar", ipDe(req), { max: 3, ventanaMs: 600000 })) {
    return NextResponse.json({ error: "demasiados-intentos" }, { status: 429 });
  }

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

  const res = await cancelGuestBooking(booking);
  // 409, no 500: la reserva SÍ está cancelada, sólo que la canceló la petición
  // anterior. El portal ya sabe pintar el 409 como "esta reserva ya no se puede
  // cancelar", y salir por aquí es lo que evita el segundo par de correos.
  if (res.yaCancelada) {
    return NextResponse.json({ error: "no-cancelable", motivo: "estado" }, { status: 409 });
  }
  if (!res.ok) return NextResponse.json({ error: "error-interno" }, { status: 500 });

  // Los dos avisos son mejor-esfuerzo (la cancelación ya quedó hecha), pero su
  // resultado viaja en la respuesta: el portal puede decir "cancelada, pero no
  // pudimos avisar al hotel" en vez de un ✓ que no distingue las dos cosas.
  let avisoHotel = true;
  let comprobanteHuesped = true;
  // Se reutiliza como `replyTo` del comprobante del huésped: ese correo le dice
  // "responde este correo y te ayudamos", y sale del dominio de Kora.
  let avisoTo = "";

  // Aviso inmediato al hotel: sin esto solo se enteraría revisando el panel.
  try {
    const h = booking.row.hoteles;
    if (h) {
      avisoTo = await resolveHotelAvisoEmail({
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
    avisoHotel = false;
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
          hotelEmail: avisoTo || undefined,
        },
        bookingFromHotel({ config: h.config } as HotelRow),
      );
    }
  } catch (e) {
    console.error("comprobante de cancelación al huésped falló:", e);
    comprobanteHuesped = false;
  }

  booking.row.estado = "CANCELADA";
  booking.cancelable = false;
  booking.motivoNoCancelable = "estado";
  // La cancelación se hizo pase lo que pase, pero el portal necesita saber si los
  // avisos salieron: si no, el huésped se va creyendo que el hotel ya se enteró.
  return NextResponse.json({
    ok: true,
    avisoHotel,
    comprobanteHuesped,
    booking: serializeGuestBooking(booking),
  });
}
