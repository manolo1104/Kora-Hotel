import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings } from '@/lib/db/admin';
import { buildBookingHtml, calcCancelDate72h, fmtDateFull, type TourItem } from '@/lib/booking-html';

export const dynamic = 'force-dynamic';

function parseTours(notas: string): TourItem[] {
  const idx = notas.indexOf('||TOURS||');
  if (idx === -1) return [];
  try { return JSON.parse(notas.slice(idx + 9).split('||PAQUETES||')[0]); } catch { return []; }
}

function parseNotasCliente(notas: string): string {
  return (notas || '')
    .split('||INTERNO||')[0]
    .split('||TOURS||')[0]
    .split('||PAQUETES||')[0]
    .split('||HABS||')[0]
    .trim();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { id } = await params; // confirmación (folio)
  const bookings = await getAllBookings(ctx.hotelId);
  const b = bookings.find(x => x.confirmacion === id);
  if (!b) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });

  const suites = b.habitaciones
    .split(',')
    .map(s => s.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);
  const anticipo = b.anticipo || 0;

  const html = buildBookingHtml({
    confirmacion: b.confirmacion,
    cliente: b.cliente || '—',
    suites,
    checkin: b.checkin,
    checkout: b.checkout,
    noches: b.noches || 1,
    huespedes: b.huespedes || suites.length * 2,
    total: b.total,
    anticipo,
    restante: b.total - anticipo,
    cancelDateStr: calcCancelDate72h(b.checkin),
    fechaLimiteStr: fmtDateFull(b.checkin),
    notasClienteText: parseNotasCliente(b.notas || ''),
    forPrint: true,
    tourItems: parseTours(b.notas || ''),
    compact: false,
  });

  const download = new URL(req.url).searchParams.get('download');
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${b.confirmacion}.html"`;

  return new NextResponse(html, { headers });
}
