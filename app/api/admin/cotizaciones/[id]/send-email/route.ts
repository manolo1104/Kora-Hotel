import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getQuote, updateQuoteStatus, logAgentActivity } from '@/lib/db/admin';
import { type TourItem } from '@/lib/booking-html';
import { buildBrandedBookingEmailHtml, bookingBrandFromHotel, bookingFromHotel } from '@/lib/email/booking-branded';
import { Resend } from 'resend';

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { id } = await params;
  const q = await getQuote(ctx.hotelId, id);
  if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  if (!q.email) return NextResponse.json({ error: 'Sin email en esta cotización' }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email no configurado en este hotel (falta RESEND_API_KEY)' }, { status: 503 });
  }
  const FROM = bookingFromHotel(ctx.hotel);

  const suites = q.suite
    .split(',')
    .map(s => s.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);
  const tours = parseTours(q.notas || '');
  const paquetes = parsePaquetes(q.notas || '');
  const tourItems: TourItem[] = [
    ...tours,
    ...paquetes.map(p => ({ nombre: `🎁 ${p.nombre}`, personas: 1, precio: p.precio })),
  ];

  const html = buildBrandedBookingEmailHtml(bookingBrandFromHotel(ctx.hotel), {
    kind: 'cotizacion',
    confirmacion: q.id,
    cliente: q.cliente || '—',
    suites,
    checkin: q.checkin,
    checkout: q.checkout,
    noches: q.noches || 1,
    huespedes: suites.length * 2,
    total: q.precioTotal,
    notasCliente: parseNotasCliente(q.notas || ''),
    tourItems,
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to: q.email,
      subject: `Tu cotización ${q.id} — ${ctx.hotel.nombre}`,
      html,
    });
    await updateQuoteStatus(ctx.hotelId, q.id, 'ENVIADA');
    await logAgentActivity(ctx.hotelId, 'email_confirmacion', q.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
