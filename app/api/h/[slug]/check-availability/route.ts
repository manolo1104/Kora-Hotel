import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveHotel } from "@/lib/tenant";
import { checkAvailability } from "@/lib/db/availability";
import { normalizeRoomName, roomNamesOf } from "@/lib/booking";

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

  const { checkin, checkout, rooms } = parsed.data;
  const roomNames = (rooms && rooms.length > 0 ? rooms : roomNamesOf(hotel)).map((r) =>
    normalizeRoomName(hotel, typeof r === "string" ? r : (r?.name ?? "")),
  );
  const result = await checkAvailability(hotel.id, checkin, checkout, roomNames);
  const totalRooms = roomNames.length;
  const availableCount = Math.max(0, totalRooms - result.unavailableRooms.length);
  return NextResponse.json({ ...result, totalRooms, availableCount });
}
