import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, createManualBooking } from '@/lib/db/admin';
import { checkAvailability } from '@/lib/db/availability';
import type { HotelRow } from '@/lib/tenant';
import {
  resolveHotelAvisoEmail,
  sendAvisoReservaHotel,
  sendConfirmacionReserva,
} from '@/lib/email/reserva';
import { bookingBrandFromHotel } from '@/lib/email/booking-branded';

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
    }, ctx.hotel.prefijo_confirmacion);

    // TODO loyalty: en Paraíso se llamaba checkAndEnrollLoyalty aquí. Kora aún no
    // tiene módulo de lealtad → se omite.

    // Correos post-reserva (best-effort: nunca tumban la creación de la reserva).
    // Mismo patrón que el webhook del motor (app/api/h/webhooks/stripe): aviso al
    // hotel con destinatario RESUELTO (panel → config → cuenta del dueño) y
    // confirmación PREMIUM al huésped con la marca del hotel.
    notifyBookingEmails(req, ctx.hotel, confirmacion, data).catch(() => {});

    return NextResponse.json({ ok: true, confirmacion });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

interface ManualBookingData {
  cliente?: string; telefono?: string; email?: string; habitacion?: string;
  checkin?: string; checkout?: string; huespedes?: number | string;
  total?: number | string; anticipo?: number | string;
}

async function notifyBookingEmails(
  req: NextRequest,
  hotel: HotelRow,
  confirmacion: string,
  data: ManualBookingData,
) {
  const origin = new URL(req.url).origin;
  const num = (v: unknown) => Number(v) || 0;
  // El CSV de habitaciones puede traer varias suites separadas por coma y con
  // sufijos entre paréntesis: los limpiamos igual que en la verificación de arriba.
  const habitaciones = String(data.habitacion ?? '')
    .split(',')
    .map((r) => r.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);
  const total = num(data.total);
  const anticipo = num(data.anticipo);
  const huespedes = num(data.huespedes) || 1;

  // 1) Aviso al hotel — destinatario resuelto correctamente (no a Kora).
  const avisoTo = await resolveHotelAvisoEmail(hotel).catch(() => '');
  if (avisoTo) {
    await sendAvisoReservaHotel(avisoTo, {
      hotelNombre: hotel.nombre,
      panelUrl: `${origin}/panel/${hotel.slug}/reservas`,
      confirmacion,
      cliente: data.cliente || null,
      telefono: data.telefono || null,
      email: data.email || null,
      habitaciones,
      checkin: data.checkin || '',
      checkout: data.checkout || '',
      huespedes,
      total,
      anticipo,
      pagoEnHotel: anticipo <= 0,
    }).catch(() => {});
  }

  // 2) Confirmación al huésped (gated por email válido dentro del helper).
  if ((data.email ?? '').includes('@')) {
    await sendConfirmacionReserva(
      data.email!,
      {
        hotelNombre: hotel.nombre,
        confirmacion,
        habitaciones,
        checkin: data.checkin || '',
        checkout: data.checkout || '',
        anticipo,
        pendiente: Math.max(0, total - anticipo),
        cliente: data.cliente || null,
        huespedes,
        portalUrl: `${origin}/reserva/consultar`,
        lang: 'es',
        brand: bookingBrandFromHotel(hotel),
      },
      (hotel.config?.email_from as string) || null,
    ).catch(() => {});
  }
}
