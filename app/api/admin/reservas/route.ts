import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, createManualBooking } from '@/lib/db/admin';
import { checkAvailability } from '@/lib/db/availability';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const suite = searchParams.get('suite') || '';

  const bookings = await getAllBookings(ctx.hotelId);
  const filtered = bookings.filter(b => {
    if (search && !b.cliente.toLowerCase().includes(search) &&
        !b.email.toLowerCase().includes(search) &&
        !b.confirmacion.toLowerCase().includes(search)) return false;
    if (suite && !b.habitaciones.includes(suite)) return false;
    return true;
  });

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  try {
    const data = await req.json();

    // Verificar disponibilidad en Supabase antes de crear
    if (data.checkin && data.checkout && data.habitacion) {
      // El CSV de habitaciones puede traer varias suites separadas por coma.
      const rooms = String(data.habitacion)
        .split(',')
        .map((r: string) => r.replace(/\s*\([^)]*\)/g, '').trim())
        .filter(Boolean);
      const avail = await checkAvailability(ctx.hotelId, data.checkin, data.checkout, rooms);
      if (avail.unavailableRooms.length > 0) {
        return NextResponse.json(
          { error: `${avail.unavailableRooms.join(', ')} no está disponible del ${data.checkin} al ${data.checkout}. Verifica el calendario.` },
          { status: 409 }
        );
      }
    }

    const confirmacion = await createManualBooking(ctx.hotelId, {
      cliente: data.cliente,
      telefono: data.telefono,
      email: data.email,
      habitacion: data.habitacion,
      checkin: data.checkin,
      checkout: data.checkout,
      noches: data.noches,
      huespedes: data.huespedes,
      total: data.total,
      notas: data.notas,
      anticipo: data.anticipo,
    });

    // TODO loyalty: en Paraíso se llamaba checkAndEnrollLoyalty aquí. Kora aún no
    // tiene módulo de lealtad → se omite.

    // Notificación por email al equipo del hotel (no bloqueante, solo si hay envs).
    notifyTeamNewBooking(ctx.hotel.nombre, { confirmacion, ...data }).catch(() => {});

    return NextResponse.json({ ok: true, confirmacion });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function notifyTeamNewBooking(hotelName: string, data: {
  confirmacion: string; cliente?: string; habitacion?: string;
  checkin?: string; checkout?: string; total?: number; email?: string;
}) {
  if (!process.env.RESEND_API_KEY) return; // no-op sin envs
  const hotelEmail = process.env.RESEND_FROM || process.env.OWNER_EMAIL;
  if (!hotelEmail) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: hotelEmail,
      to: hotelEmail,
      subject: `🏨 Nueva reserva: ${data.confirmacion} — ${data.cliente || 'Sin nombre'}`,
      html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;">
        <h2 style="color:#2a2218;margin:0 0 16px;">🏨 Nueva reserva en ${hotelName}</h2>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Folio</td><td style="padding:8px 0;font-weight:600;">${data.confirmacion}</td></tr>
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Cliente</td><td style="padding:8px 0;">${data.cliente || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Suite</td><td style="padding:8px 0;">${data.habitacion || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Check-in</td><td style="padding:8px 0;">${data.checkin || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Check-out</td><td style="padding:8px 0;">${data.checkout || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#888;font-size:13px;">Total</td><td style="padding:8px 0;font-weight:600;color:#2d7a34;">$${Number(data.total || 0).toLocaleString('es-MX')} MXN</td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#aaa;">Reserva creada desde el panel admin.</p>
      </div>`,
    });
  } catch { /* non-blocking */ }
}
