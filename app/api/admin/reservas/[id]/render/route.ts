import { negar } from "@/lib/panel/permisos";
// Comprobante branded de una RESERVA (imprimible / descargable). Usa la marca
// del hotel activo + los datos de la reserva + los overrides guardados (columna
// doc). Reemplaza al viejo buildBookingHtml hardcodeado a Paraíso.
// `?download=1` → archivo .html; si no, auto-imprime.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getBookingByConfirmacion } from "@/lib/db/admin";
import { assembleReserva } from "@/lib/docs/assemble";
import { buildReservaDoc, buildTicketDoc, type AnchoTicket } from "@/lib/docs/documento-branded";

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
  const q = new URL(req.url).searchParams;
  const download = q.get("download");

  // `?formato=ticket` → rollo térmico de mostrador en vez de hoja carta. El
  // ancho se acota a los dos que existen: cualquier otra cosa cae a 58 mm, que
  // es la impresora chica. Se lee del hotel (`config.ticket_ancho`) para que el
  // hotelero lo configure una vez y el botón no tenga que preguntárselo nunca.
  const esTicket = q.get("formato") === "ticket";
  const anchoPedido = q.get("ancho") ?? anchoDelHotel(ctx.hotel);
  const ancho: AnchoTicket = anchoPedido === "80" || anchoPedido === "80mm" ? "80mm" : "58mm";

  const html = esTicket
    ? buildTicketDoc(brand, data, { forPrint: !download, ancho })
    : buildReservaDoc(brand, data, { forPrint: !download });

  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (download) {
    const sufijo = esTicket ? "-ticket" : "";
    headers["Content-Disposition"] = `attachment; filename="${b.confirmacion}${sufijo}.html"`;
  }
  return new NextResponse(html, { headers });
}

/** El ancho de rollo que el hotel dejó configurado, si dejó alguno. */
function anchoDelHotel(hotel: { config?: Record<string, unknown> | null }): string {
  const v = hotel.config?.ticket_ancho;
  return typeof v === "string" ? v : "";
}
