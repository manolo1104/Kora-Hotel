import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { releaseHold } from "@/lib/db/availability";

export const dynamic = "force-dynamic";

// Libera el hold del carrito cuando el huésped regresa de un Checkout
// cancelado (?cancelado=1&hs=...). Sin esto, su propio hold le bloqueaba el
// cuarto ~30 min a él y a cualquier otro visitante. El id es un UUID que solo
// conoce quien inició esa sesión: no se puede liberar el hold de un tercero.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { session?: unknown } | null;
  const session = typeof body?.session === "string" ? body.session : "";
  if (!/^web_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(session)) {
    return NextResponse.json({ error: "session-invalida" }, { status: 400 });
  }

  await releaseHold(hotel.id, session);
  return NextResponse.json({ ok: true });
}
