import { negar } from "@/lib/panel/permisos";
// Comprobante branded de una RESERVA (imprimible / descargable). Usa la marca
// del hotel activo + los datos de la reserva + los overrides guardados (columna
// doc). Reemplaza al viejo buildBookingHtml hardcodeado a Paraíso.
// `?download=1` → archivo .html; si no, auto-imprime.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getBookingByConfirmacion } from "@/lib/db/admin";
import { assembleReserva } from "@/lib/docs/assemble";
import { buildReservaDoc } from "@/lib/docs/documento-branded";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "reservas:leer");
  if (no) return no;

  const { id } = await params; // confirmación (folio)
  const b = await getBookingByConfirmacion(ctx.hotelId, id);
  if (!b) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

  const { brand, data } = assembleReserva(ctx.hotel, b);
  const download = new URL(req.url).searchParams.get("download");
  const html = buildReservaDoc(brand, data, { forPrint: !download });

  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (download) headers["Content-Disposition"] = `attachment; filename="${b.confirmacion}.html"`;
  return new NextResponse(html, { headers });
}
