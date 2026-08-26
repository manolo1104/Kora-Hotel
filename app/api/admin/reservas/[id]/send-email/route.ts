import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, logAgentActivity } from '@/lib/db/admin';
import { type TourItem } from '@/lib/booking-html';
import { buildBrandedBookingEmailHtml, bookingBrandFromHotel, bookingFromHotel } from '@/lib/email/booking-branded';
import { enviarEmailOFallar } from '@/lib/email/resend';
import { rutaSegura } from '@/lib/api/responder';

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
  return rutaSegura('admin.reservas.sendEmail', async () => {
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
  const FROM = bookingFromHotel(ctx.hotel);

  const suites = b.habitaciones
    .split(',')
    .map(s => s.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);
  const anticipo = b.anticipo || 0;

  const html = buildBrandedBookingEmailHtml(bookingBrandFromHotel(ctx.hotel), {
    kind: 'reserva',
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
    notasCliente: parseNotasCliente(b.notas || ''),
    tourItems: parseTours(b.notas || ''),
  });

  // Mismo bug que en el reenvío de cotizaciones: el SDK de Resend no lanza, así
  // que este `{ok:true}` se devolvía igual con el correo perdido. Y aquí el
  // hotelero cree que su huésped ya recibió la confirmación.
  await enviarEmailOFallar({
    from: FROM,
    to: b.email,
    subject: `Tu estadía está confirmada — ${b.confirmacion}`,
    html,
  });
  await logAgentActivity(ctx.hotelId, 'email_confirmacion', b.confirmacion);
  return NextResponse.json({ ok: true });
  });
}
