import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, updateBooking, cancelBooking } from '@/lib/db/admin';

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

  // Validación de fechas: si se editan, la salida debe ser posterior a la llegada.
  const newCheckin  = raw.checkin  ?? booking.checkin;
  const newCheckout = raw.checkout ?? booking.checkout;
  if ((raw.checkin || raw.checkout) && newCheckin && newCheckout && newCheckout <= newCheckin) {
    return NextResponse.json({ error: 'La salida debe ser posterior a la llegada.' }, { status: 400 });
  }

  // updateBooking re-sincroniza los bloqueos RESERVADO (por booking_id) cuando
  // cambian fechas/cuartos; por eso NO usamos block/unblockRooms aquí (evita
  // mezclar estados RESERVADO/BLOQUEADO y dejar fechas viejas ocupadas).
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
