import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveHotel } from "@/lib/tenant";
import { freeUnitsByType } from "@/lib/db/availability";

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
  return NextResponse.json({
    available: unavailableRooms.length === 0,
    unavailableRooms,
    totalRooms,
    availableCount,
    types,
    totalUnits,
    availableUnits,
  });
}
