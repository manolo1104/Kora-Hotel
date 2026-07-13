import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getResenasHotel, responderResena, ocultarResena } from "@/lib/db/reviews";

export const dynamic = "force-dynamic";

// Reseñas VERIFICADAS (tabla reviews) del hotel activo, para el panel. Auth por
// sesión (getActiveHotel); el hotelId sale de la sesión, nunca del body.

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const resenas = await getResenasHotel(ctx.hotelId);
  return NextResponse.json({ resenas });
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { action?: string; id?: string; respuesta?: string; publicada?: boolean }
    | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "id-requerido" }, { status: 400 });

  if (body?.action === "responder") {
    const res = await responderResena(ctx.hotelId, id, String(body.respuesta ?? ""));
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }
  if (body?.action === "ocultar") {
    const res = await ocultarResena(ctx.hotelId, id, Boolean(body.publicada));
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }
  return NextResponse.json({ ok: false, error: "accion-invalida" }, { status: 400 });
}
