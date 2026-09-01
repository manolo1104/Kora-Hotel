import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getResenasHotel, responderResena, ocultarResena } from "@/lib/db/reviews";
import { leerCuerpo, zTextoLargo, zId } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Reseñas VERIFICADAS (tabla reviews) del hotel activo, para el panel. Auth por
// sesión (getActiveHotel); el hotelId sale de la sesión, nunca del body.

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:leer");
  if (no) return no;
  const resenas = await getResenasHotel(ctx.hotelId);
  return NextResponse.json({ resenas });
}

const RESENA_SCHEMA = z.object({
  action: z.enum(["responder", "ocultar"]),
  id: zId,
  respuesta: zTextoLargo.optional(),
  publicada: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:editar");
  if (no) return no;

  // La respuesta del hotelero a una reseña sale publicada en su página: sin tope
  // de longitud, cabía ahí un texto de cualquier tamaño.
  const c = await leerCuerpo(req, RESENA_SCHEMA);
  if (!c.ok) return c.respuesta;

  if (c.datos.action === "responder") {
    const res = await responderResena(ctx.hotelId, c.datos.id, c.datos.respuesta ?? "");
    return NextResponse.json(res, { status: res.ok ? 200 : 500 });
  }
  const res = await ocultarResena(ctx.hotelId, c.datos.id, c.datos.publicada ?? false);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
