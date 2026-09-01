import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getQuote, updateQuoteStatus } from "@/lib/db/admin";
import { createBookingAtomic, generarConfirmacion } from "@/lib/db/bookings";
import { bookingRules } from "@/lib/booking";
import { calcDepositAmount } from "@/lib/booking/engine";
import { parseNotas } from "@/lib/notas";
import { zId } from "@/lib/api/cuerpo";

export const dynamic = "force-dynamic";

// Convierte una COTIZACIÓN en RESERVA conservando su info. Usa el candado atómico
// (createBookingAtomic) para no sobrevender, genera un folio de reserva nuevo y
// marca la cotización ACEPTADA. Idempotente-ish: si ya está ACEPTADA, no repite.

/** Huéspedes totales del bloque de habitaciones (fallback suites*2). */
function huespedesDeNotas(notas: string, nSuites: number): number {
  {
    const suma = parseNotas(notas).habitaciones.reduce(
      (s, h) => s + (Number(h?.huespedes) || 0),
      0,
    );
    if (suma > 0) return suma;
  }
  return Math.max(1, nSuites * 2);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return rutaSegura("admin.cotizaciones.convertir.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "reservas:escribir");
  if (no) return no;

  const { id } = await params;
  if (!zId.safeParse(id).success) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }
  const q = await getQuote(ctx.hotelId, id);
  if (!q) return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
  if (q.estado === "ACEPTADA") {
    return NextResponse.json({ error: "Esta cotización ya se convirtió en reserva." }, { status: 409 });
  }
  if (!q.checkin || !q.checkout || new Date(q.checkout) <= new Date(q.checkin)) {
    return NextResponse.json({ error: "La cotización no tiene fechas válidas." }, { status: 400 });
  }

  // Cuartos: mismo saneo que las rutas de email (quita el sufijo "(Xp)").
  const habitaciones = q.suite
    .split(",")
    .map((s) => s.replace(/\s*\([^)]*\)/g, "").trim())
    .filter(Boolean);
  if (!habitaciones.length) {
    return NextResponse.json({ error: "La cotización no tiene habitaciones." }, { status: 400 });
  }

  const rules = bookingRules(ctx.hotel);
  const anticipo = calcDepositAmount(q.precioTotal, q.noches || 1, {
    pct: rules.anticipoPct,
    minNights: rules.anticipoMinNoches,
  });
  const crearDesdeCotizacion = (folio: string) => createBookingAtomic(ctx.hotelId, {
    habitaciones,
    checkin: q.checkin,
    checkout: q.checkout,
    confirmacion: folio,
    cliente: q.cliente || null,
    telefono: q.telefono || null,
    email: q.email || null,
    total: q.precioTotal,
    anticipo,
    huespedes: huespedesDeNotas(q.notas || "", habitaciones.length),
    estado: "MANUAL",
    origen: "cotizacion",
    notas: q.notas || null, // se copia entero: los bloques de máquina los necesitan el render y el correo
  });

  // El folio son 4 caracteres al azar: si choca con el índice único
  // (hotel_id, confirmacion), se reintenta con uno nuevo. Es el mismo bucle que
  // ya usa el webhook del motor; aquí faltaba, así que una colisión le decía al
  // hotelero que su cotización no se podía convertir.
  let confirmacion = "";
  let res: Awaited<ReturnType<typeof createBookingAtomic>> = { ok: false };
  for (let intento = 0; intento < 3; intento++) {
    confirmacion = generarConfirmacion(ctx.hotel.prefijo_confirmacion);
    res = await crearDesdeCotizacion(confirmacion);
    if (res.ok || !/duplicate key|confirmacion/i.test(res.error ?? "")) break;
  }

  if (!res.ok) {
    if (res.unavailable) {
      return NextResponse.json(
        { error: "Uno o más cuartos ya no están disponibles en esas fechas." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "No se pudo crear la reserva. Intenta de nuevo." }, { status: 500 });
  }

  await updateQuoteStatus(ctx.hotelId, q.id, "ACEPTADA");
  return NextResponse.json({ ok: true, confirmacion, bookingId: res.bookingId });
  });
}
