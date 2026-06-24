import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getQuote } from '@/lib/db/admin';
import { buildBookingHtml, calcCancelDate72h, fmtDateFull, type TourItem } from '@/lib/booking-html';

export const dynamic = 'force-dynamic';

interface PaqueteItem { nombre: string; habitacion: string; noches: number; personas: number; precio: number }

function parseTours(notas: string): TourItem[] {
  const idx = notas.indexOf('||TOURS||');
  if (idx === -1) return [];
  try { return JSON.parse(notas.slice(idx + 9).split('||PAQUETES||')[0]); } catch { return []; }
}
function parsePaquetes(notas: string): PaqueteItem[] {
  const idx = notas.indexOf('||PAQUETES||');
  if (idx === -1) return [];
  try { return JSON.parse(notas.slice(idx + 12).split('||HABS||')[0]); } catch { return []; }
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

  const { id } = await params;
  const q = await getQuote(ctx.hotelId, id);
  if (!q) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const suites = q.suite
    .split(',')
    .map(s => s.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);

  // Tours + paquetes se muestran como líneas extra (los paquetes se modelan como
  // un "tour" de 1 persona cuyo precio es el total del paquete).
  const tours = parseTours(q.notas || '');
  const paquetes = parsePaquetes(q.notas || '');
  const tourItems: TourItem[] = [
    ...tours,
    ...paquetes.map(p => ({ nombre: `🎁 ${p.nombre}`, personas: 1, precio: p.precio })),
  ];

  const html = buildBookingHtml({
    confirmacion: q.id,
    cliente: q.cliente || '—',
    suites,
    checkin: q.checkin,
    checkout: q.checkout,
    noches: q.noches || 1,
    huespedes: suites.length * 2,
    total: q.precioTotal,
    cancelDateStr: calcCancelDate72h(q.checkin),
    fechaLimiteStr: fmtDateFull(q.checkin),
    notasClienteText: parseNotasCliente(q.notas || ''),
    forPrint: true,
    tourItems,
    compact: false,
  });

  const download = new URL(req.url).searchParams.get('download');
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
  if (download) headers['Content-Disposition'] = `attachment; filename="${q.id}.html"`;

  return new NextResponse(html, { headers });
}
