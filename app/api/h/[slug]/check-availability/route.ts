import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveHotel } from "@/lib/tenant";
import { freeUnitsByType } from "@/lib/db/availability";
import { ventasPorExperiencia } from "@/lib/db/experiencias";
import { experienciaFechasDisponibles } from "@/lib/booking";
import type { Experiencia } from "@/lib/mini";

export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const Body = z.object({
  checkin: z.string().regex(FECHA),
  checkout: z.string().regex(FECHA),
  rooms: z
    .array(z.union([z.string(), z.object({ name: z.string() })]))
    .max(60)
    .optional(),
});

// Disponibilidad pública del motor embebible. Resuelve el hotel por slug (sin
// auth) y consulta blocks por hotel_id. Devuelve además cuántas habitaciones
// quedan libres para las señales de urgencia (calculadas, nunca inventadas).
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "datos-invalidos" }, { status: 400 });

  const { checkin, checkout } = parsed.data;

  // Disponibilidad POR TIPO (cada tipo puede tener varias unidades).
  const typesAvail = await freeUnitsByType(hotel.id, hotel, checkin, checkout);
  const types = typesAvail.map((t) => ({
    id: t.id,
    name: t.name,
    freeCount: t.freeCount,
    cantidad: t.cantidad,
  }));
  const availableUnits = typesAvail.reduce((s, t) => s + t.freeCount, 0);
  const totalUnits = typesAvail.reduce((s, t) => s + t.cantidad, 0);
  // Campos legacy (compat): un tipo "no disponible" = 0 unidades libres.
  const unavailableRooms = typesAvail.filter((t) => t.freeCount === 0).map((t) => t.name);
  const totalRooms = typesAvail.length;
  const availableCount = typesAvail.filter((t) => t.freeCount > 0).length;

  // Cupo de experiencias por día (Sprint 3): para cada experiencia con cupo,
  // cuántos lugares QUEDAN en cada día de la estancia (cupoDia − vendidos).
  // El motor capea el stepper y marca días agotados; el checkout revalida.
  const hotelExps = (
    Array.isArray((hotel.extras as Record<string, unknown>)?.experiencias)
      ? (hotel.extras as Record<string, unknown>).experiencias
      : []
  ) as Experiencia[];
  const conCupo = hotelExps
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => (e.cupoDia ?? 0) > 0 && e.cobro !== "noche");
  const experienciasCupo: Record<number, Record<string, number>> = {};
  if (conCupo.length > 0) {
    const vendidos = await ventasPorExperiencia(
      hotel.id,
      conCupo.map(({ e }) => e.nombre),
      checkin,
      checkout,
    );
    for (const { e, i } of conCupo) {
      const porFecha: Record<string, number> = {};
      for (const f of experienciaFechasDisponibles(e.dias, checkin, checkout)) {
        porFecha[f] = Math.max(0, (e.cupoDia as number) - (vendidos[e.nombre]?.[f] ?? 0));
      }
      experienciasCupo[i] = porFecha;
    }
  }

  return NextResponse.json({
    available: unavailableRooms.length === 0,
    unavailableRooms,
    totalRooms,
    availableCount,
    types,
    totalUnits,
    availableUnits,
    experienciasCupo,
  });
}
