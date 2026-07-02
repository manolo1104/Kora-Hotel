import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllQuotes, createQuote } from '@/lib/db/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const quotes = await getAllQuotes(ctx.hotelId);
  return NextResponse.json(quotes);
}

export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
