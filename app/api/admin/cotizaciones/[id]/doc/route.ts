import { negar } from "@/lib/panel/permisos";
// Guarda los overrides del documento de una COTIZACIÓN (editor "modificar antes
// de descargar") en la columna doc. Auth por getActiveHotel().

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { saveQuoteDoc } from "@/lib/db/admin";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Son overrides libres del documento («modificar antes de descargar»), así que
// el contenido no se puede acotar campo por campo — pero sí que sea un objeto y
// que no pase de 40 KB, que es lo que revisa el guardado de abajo.
const DOC_SCHEMA = z.record(z.string(), z.unknown());

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "cotizaciones:escribir");
  if (no) return no;

  const { id } = await params;
  const c = await leerCuerpo(req, DOC_SCHEMA);
  if (!c.ok) return c.respuesta;
  // Acepta { doc: {...} } o el objeto directo.
  const doc: Record<string, unknown> =
    (c.datos.doc as Record<string, unknown> | undefined) ?? c.datos;
  if (JSON.stringify(doc).length > 40000) {
    return NextResponse.json({ error: "too-large" }, { status: 413 });
  }

  const res = await saveQuoteDoc(ctx.hotelId, id, doc);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error, hint: "¿Corriste sql/kora-documentos.sql en Supabase?" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
