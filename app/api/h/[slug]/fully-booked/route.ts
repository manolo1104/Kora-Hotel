import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { getFullyBookedDates } from "@/lib/db/availability";
import { totalUnits, unitNamesOf } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Fechas con TODAS las habitaciones ocupadas (próximos 6 meses) para que el
// calendario del motor las pinte como no disponibles. Cache corto en CDN: la
// verdad final siempre la valida check-availability + el RPC atómico al pagar.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  // Se cuenta por UNIDAD física, no por tipo de habitación. `blocks` guarda una
  // fila por unidad ("Jungla 2"), así que antes pasaba lo siguiente: el filtro de
  // nombres sólo dejaba pasar la primera unidad de cada tipo —las demás no están
  // en la lista de tipos y se descartaban— y el total a comparar era el número de
  // tipos. Resultado: en un hotel de 4 tipos y 11 unidades bastaba vender 4
  // cuartos (uno de cada tipo) para que el calendario pintara el día como lleno
  // con 7 unidades libres. Ventas perdidas sin ningún error a la vista.
  const dates = await getFullyBookedDates(hotel.id, totalUnits(hotel), 6, unitNamesOf(hotel));
  return NextResponse.json(
    { dates },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
  );
}
