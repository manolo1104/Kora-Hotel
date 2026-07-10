import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { getFullyBookedDates } from "@/lib/db/availability";
import { hotelRooms } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Fechas con TODAS las habitaciones ocupadas (próximos 6 meses) para que el
// calendario del motor las pinte como no disponibles. Cache corto en CDN: la
// verdad final siempre la valida check-availability + el RPC atómico al pagar.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  const rooms = hotelRooms(hotel);
  const dates = await getFullyBookedDates(
    hotel.id,
    rooms.length,
    6,
    rooms.map((r) => r.name),
  );
  return NextResponse.json(
    { dates },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
