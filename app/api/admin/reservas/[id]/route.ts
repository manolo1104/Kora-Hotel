import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import {
  getAllBookings,
  updateBooking,
  cancelBooking,
  blockRooms,
  unblockRooms,
} from '@/lib/db/admin';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { id } = await params; // el cliente envía la confirmación (folio)
  const raw = await req.json();

  // El modal envía "habitacion" (singular) pero updateBooking espera "habitaciones".
  if (raw.habitacion && !raw.habitaciones) {
    raw.habitaciones = raw.habitacion;
    delete raw.habitacion;
  }

  const bookings = await getAllBookings(ctx.hotelId);
  const booking = bookings.find(b => b.confirmacion === id);
  if (!booking) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // Detectar si cambiaron habitaciones o fechas → reasignar bloqueos.
  const oldRooms    = booking.habitaciones || '';
  const oldCheckin  = booking.checkin || '';
  const oldCheckout = booking.checkout || '';
  const newRooms    = raw.habitaciones ?? oldRooms;
  const newCheckin  = raw.checkin  ?? oldCheckin;
  const newCheckout = raw.checkout ?? oldCheckout;

  const roomsChanged = newRooms !== oldRooms;
  const datesChanged = newCheckin !== oldCheckin || newCheckout !== oldCheckout;

  if ((roomsChanged || datesChanged) && oldRooms && oldCheckin && oldCheckout) {
    await unblockRooms(ctx.hotelId, oldRooms, oldCheckin, oldCheckout);
    if (newRooms && newCheckin && newCheckout) {
      await blockRooms(ctx.hotelId, newRooms, newCheckin, newCheckout);
    }
  }

  await updateBooking(ctx.hotelId, booking.id, raw);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { id } = await params;

  const bookings = await getAllBookings(ctx.hotelId);
  const booking = bookings.find(b => b.confirmacion === id);
  if (!booking) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // cancelBooking marca CANCELADA y borra los blocks ligados (libera disponibilidad).
  await cancelBooking(ctx.hotelId, booking.id);
  return NextResponse.json({ ok: true });
}
