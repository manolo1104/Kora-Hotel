import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { catalogoTours, catalogoPaquetes } from "@/lib/admin/cotizaciones-catalogo";

export const dynamic = "force-dynamic";

// Catálogo de tours y paquetes del hotel activo: SÓLO lo que el hotelero dio de
// alta en `extras.cotizaciones`. Sin fallback — un hotel que no configuró nada
// recibe listas vacías y las secciones se ocultan solas.
export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "reservas:leer");
  if (no) return no;
  const cot = (ctx.hotel.extras as Record<string, unknown> | null)?.cotizaciones;
  return NextResponse.json({
    tours: catalogoTours(cot),
    paquetes: catalogoPaquetes(cot),
  });
}
