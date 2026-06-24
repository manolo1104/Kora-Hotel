import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { checkAvailability } from "@/lib/db/availability";
import { normalizeRoomName } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Disponibilidad pública del motor embebible. Resuelve el hotel por slug (sin
// auth) y consulta blocks por hotel_id.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  const { checkin, checkout, rooms } = await req.json();
  const roomNames = (Array.isArray(rooms) ? rooms : []).map((r: string | { name: string }) =>
    normalizeRoomName(hotel, typeof r === "string" ? r : r?.name ?? ""),
  );
  const result = await checkAvailability(hotel.id, checkin, checkout, roomNames);
  return NextResponse.json(result);
}
