import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { NextRequest, NextResponse } from "next/server";
import { limitado, ipDe } from "@/lib/api/rate-limit";
import { z } from "zod";
import { findGuestBooking } from "@/lib/db/portal";
import { sendConfirmacionReserva } from "@/lib/email/reserva";

export const dynamic = "force-dynamic";

const Body = z.object({
  folio: z.string().trim().min(4).max(20),
  email: z.email().max(160),
});

// Reenvía la confirmación al correo de la reserva (el mismo con el que se
// consultó: no se puede desviar a otro destinatario).
export async function POST(req: NextRequest) {
  // Reenviar es un disparador de correo gratuito: sin límite, cualquiera con un
// folio y un correo válidos puede inundar la bandeja de ese huésped y quemar la
// reputación del dominio desde el que salen TODAS las confirmaciones de Kora.
  if (await limitado("reserva.reenviar", ipDe(req), { max: 3, ventanaMs: 600000 })) {
    return NextResponse.json({ error: "demasiados-intentos" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "datos-invalidos" }, { status: 400 });

  const booking = await findGuestBooking(parsed.data.folio, parsed.data.email);
  if (!booking) return NextResponse.json({ error: "no-encontrada" }, { status: 404 });
  // También las REEMBOLSADAS: reenviarle su confirmación a alguien al que ya se
  // le devolvió el dinero es decirle que su reserva sigue en pie. Se conserva el
  // código de error "cancelada" para no cambiarle el mensaje al portal.
  if (!reservaCuenta(booking.row.estado)) {
    return NextResponse.json({ error: "cancelada" }, { status: 409 });
  }

  const origin = new URL(req.url).origin;
  const sent = await sendConfirmacionReserva(
    booking.row.email ?? "",
    {
      hotelNombre: booking.row.hoteles?.nombre ?? "el hotel",
      confirmacion: booking.row.confirmacion,
      habitaciones: booking.row.habitaciones.split(",").map((s) => s.trim()).filter(Boolean),
      checkin: booking.row.checkin,
      checkout: booking.row.checkout,
      anticipo: Number(booking.row.anticipo) || 0,
      pendiente: Math.max(0, (Number(booking.row.total) || 0) - (Number(booking.row.anticipo) || 0)),
      cliente: booking.row.cliente,
      ratePlan: booking.row.rate_plan,
      portalUrl: `${origin}/reserva/consultar`,
    },
    (booking.row.hoteles?.config?.email_from as string) || null,
  );

  if (!sent.ok) {
    console.error("[reserva/reenviar] no salió el correo:", sent.error);
    return NextResponse.json({ error: "email-no-disponible" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
