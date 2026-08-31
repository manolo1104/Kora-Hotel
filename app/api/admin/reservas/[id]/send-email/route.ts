import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getBookingByConfirmacion, logAgentActivity } from '@/lib/db/admin';
import { parseNotas } from '@/lib/notas';
import { buildBrandedBookingEmailHtml, bookingBrandFromHotel, bookingFromHotel } from '@/lib/email/booking-branded';
import { enviarEmailOFallar } from '@/lib/email/resend';
import { rutaSegura } from '@/lib/api/responder';

export const dynamic = 'force-dynamic';

// El parser vive en `lib/notas.ts`. La copia que había aquí cortaba los tours
// por ||PAQUETES|| pero NO por ||HABS||: una reserva con tours y habitaciones y
// sin paquetes —el caso normal— reventaba el JSON.parse y el `catch` devolvía
// []. Los tours que el huésped PAGÓ no salían en su correo de confirmación.
const parseTours = (notas: string) => parseNotas(notas).tours;
const parseNotasCliente = (notas: string) => parseNotas(notas).cliente;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return rutaSegura('admin.reservas.sendEmail', async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "marketing:enviar");
  if (no) return no;

  const { id } = await params; // confirmación (folio)
  const b = await getBookingByConfirmacion(ctx.hotelId, id);
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
