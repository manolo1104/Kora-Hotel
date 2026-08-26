import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllQuotes, createQuote } from '@/lib/db/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "cotizaciones:leer");
  if (no) return no;

  const quotes = await getAllQuotes(ctx.hotelId);
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "cotizaciones:escribir");
  if (no) return no;

  try {
    const data = await req.json();
    const id = await createQuote(ctx.hotelId, {
      cliente: data.cliente,
      telefono: data.telefono,
      email: data.email,
      suite: data.suite,
      checkin: data.checkin,
      checkout: data.checkout,
      noches: data.noches,
      precioTotal: data.precioTotal,
      notas: data.notas,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    // El detalle (nombres de tabla, restricciones, columnas) se queda en el log
    // del servidor; al navegador sólo va un mensaje que el hotelero pueda leer.
    console.error("[admin.cotizaciones.crear]", e);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
}
