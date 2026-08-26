import { negar } from "@/lib/panel/permisos";
// Documento branded de una COTIZACIÓN (imprimible / descargable). Usa la marca
// del hotel activo (bookingBrandFromHotel) + los datos de la cotización + los
// overrides guardados (columna doc). Reemplaza al viejo buildBookingHtml
// hardcodeado a Paraíso. `?download=1` → archivo .html; si no, auto-imprime.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getQuote } from "@/lib/db/admin";
import { assembleCotizacion } from "@/lib/docs/assemble";
import { buildCotizacionDoc } from "@/lib/docs/documento-branded";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "cotizaciones:leer");
  if (no) return no;

  const { id } = await params;
  const q = await getQuote(ctx.hotelId, id);
  if (!q) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const { brand, data } = assembleCotizacion(ctx.hotel, q);
  const download = new URL(req.url).searchParams.get("download");
  const html = buildCotizacionDoc(brand, data, { forPrint: !download });

  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${q.id}.html"`;
  return new NextResponse(html, { headers });
}
