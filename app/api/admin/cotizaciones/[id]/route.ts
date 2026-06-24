import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getQuote, updateQuote, deleteQuote, type AdminQuote } from '@/lib/db/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { id } = await params;
  const changes = await req.json();

  const quote = await getQuote(ctx.hotelId, id);
  if (!quote) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // Solo pasamos los campos editables conocidos (mapeo 1:1; precioTotal lo
  // traduce updateQuote a precio_total).
  const allowed: (keyof AdminQuote)[] = [
    'cliente', 'telefono', 'email', 'suite', 'checkin', 'checkout',
    'noches', 'precioTotal', 'estado', 'notas',
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in changes) patch[key] = changes[key];
  }

  await updateQuote(ctx.hotelId, id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { id } = await params;
  const quote = await getQuote(ctx.hotelId, id);
  if (!quote) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  await deleteQuote(ctx.hotelId, id);
  return NextResponse.json({ ok: true });
}
