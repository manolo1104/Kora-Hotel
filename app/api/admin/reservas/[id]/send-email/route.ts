import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, logAgentActivity } from '@/lib/db/admin';
import { buildBookingHtml, calcCancelDate72h, fmtDateFull, type TourItem } from '@/lib/booking-html';
import { Resend } from 'resend';

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { id } = await params; // confirmación (folio)
  const bookings = await getAllBookings(ctx.hotelId);
  const b = bookings.find(x => x.confirmacion === id);
  if (!b) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  if (!b.email || b.email === 'N/A') return NextResponse.json({ error: 'Sin email registrado' }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email no configurado en este hotel (falta RESEND_API_KEY)' }, { status: 503 });
  }
  const FROM = process.env.RESEND_FROM || process.env.OWNER_EMAIL;
  if (!FROM) return NextResponse.json({ error: 'Falta el remitente (RESEND_FROM)' }, { status: 503 });

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
    forPrint: false,
    tourItems: parseTours(b.notas || ''),
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM,
      to: b.email,
      subject: `Tu estadía está confirmada — ${b.confirmacion}`,
      html,
    });
    await logAgentActivity(ctx.hotelId, 'email_confirmacion', b.confirmacion);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
