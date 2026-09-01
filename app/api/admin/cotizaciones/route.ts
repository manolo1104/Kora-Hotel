import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllQuotes, createQuote } from '@/lib/db/admin';
import { leerCuerpo, zTextoCorto, zTextoLargo, zEmail, zFecha } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "cotizaciones:leer");
  if (no) return no;

  const quotes = await getAllQuotes(ctx.hotelId);
  return NextResponse.json(quotes);
}

const CREAR_SCHEMA = z.object({
  cliente: zTextoCorto,
  telefono: z.string().trim().max(40).default(""),
  email: z.union([zEmail, z.literal("")]).default(""),
  suite: zTextoCorto,
  checkin: zFecha,
  checkout: zFecha,
  noches: z.number().int().min(1).max(365),
  precioTotal: z.number().min(0).max(10_000_000),
  notas: zTextoLargo.default(""),
});

export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "cotizaciones:escribir");
  if (no) return no;

  // Todo esto acababa en la base sin mirarse: `noches` o `precioTotal` podían
  // llegar como texto, y `checkin` con cualquier forma.
  const c = await leerCuerpo(req, CREAR_SCHEMA);
  if (!c.ok) return c.respuesta;

  try {
    const id = await createQuote(ctx.hotelId, c.datos);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    // El detalle (nombres de tabla, restricciones, columnas) se queda en el log
    // del servidor; al navegador sólo va un mensaje que el hotelero pueda leer.
    console.error("[admin.cotizaciones.crear]", e);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
}
