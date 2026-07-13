import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { getBooking } from "@/lib/db/bookings";
import { crearResena } from "@/lib/db/reviews";
import { logAgentActivity } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// Captura de una reseña REAL del huésped. La verificación es la atadura al folio:
// `r` es el id (uuid) de una reserva real de ESTE hotel — inadivinable, viaja en
// el correo del día 7. Sin una reserva válida no se guarda nada. Una reseña por
// folio (crearResena la sobrescribe si el huésped reenvía).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ ok: false, error: "hotel-no-encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { r?: unknown; estrellas?: unknown; texto?: unknown }
    | null;
  const bookingId = typeof body?.r === "string" ? body.r : "";
  const estrellas = Math.round(Number(body?.estrellas));
  const texto = typeof body?.texto === "string" ? body.texto : "";

  if (!bookingId) return NextResponse.json({ ok: false, error: "reserva-requerida" }, { status: 400 });
  if (!(estrellas >= 1 && estrellas <= 5)) {
    return NextResponse.json({ ok: false, error: "estrellas-invalidas" }, { status: 400 });
  }

  // La reserva debe existir y ser de ESTE hotel (verificación). Cancelada/
  // reembolsada no puede reseñar.
  const booking = (await getBooking(hotel.id, bookingId)) as
    | { id: string; confirmacion: string | null; cliente: string | null; estado: string | null }
    | null;
  if (!booking) return NextResponse.json({ ok: false, error: "reserva-no-encontrada" }, { status: 404 });
  if (booking.estado === "CANCELADA" || booking.estado === "REEMBOLSADA") {
    return NextResponse.json({ ok: false, error: "reserva-no-elegible" }, { status: 400 });
  }

  const res = await crearResena(hotel.id, {
    bookingId: booking.id,
    confirmacion: booking.confirmacion,
    cliente: booking.cliente,
    estrellas,
    texto,
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: "no-guardada" }, { status: 500 });

  // Métrica del foso: reseña capturada (best-effort, nunca tumba la respuesta).
  await logAgentActivity(hotel.id, "resena_capturada", `${estrellas}★`, false);

  return NextResponse.json({ ok: true, actualizada: Boolean(res.actualizada) });
}
