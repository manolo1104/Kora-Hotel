import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, updateBooking, cancelBooking, splitRooms } from '@/lib/db/admin';
import { getOccupiedRoomNames } from '@/lib/db/availability';
import { liberarExperienciaVentas } from '@/lib/db/experiencias';

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

  // ANTI-SOBREVENTA AL EDITAR: si cambian fechas o cuartos (y la reserva no está
  // cancelada), revalidar disponibilidad ANTES de aplicar. updateBooking borra y
  // re-crea los blocks sin revisar solape, así que sin este chequeo el panel podía
  // sobrevender al mover una reserva a fechas/cuartos ya ocupados por otra.
  const cambiaFechas   = raw.checkin !== undefined || raw.checkout !== undefined;
  const cambiaCuartos  = raw.habitaciones !== undefined;
  const estadoFinal    = raw.estado ?? booking.estado;
  if ((cambiaFechas || cambiaCuartos) && estadoFinal !== 'CANCELADA') {
    const roomsNuevos = splitRooms(String(raw.habitaciones ?? booking.habitaciones ?? ''));
    if (roomsNuevos.length && newCheckin && newCheckout) {
      try {
        // Excluir los blocks de esta misma reserva (si no, chocaría consigo misma).
        const ocupados = await getOccupiedRoomNames(
          ctx.hotelId, newCheckin, newCheckout, null, booking.id,
        );
        const choque = roomsNuevos.filter((r) => ocupados.includes(r));
        if (choque.length) {
          return NextResponse.json(
            { error: `No se puede guardar: ${choque.join(', ')} ya está(n) ocupado(s) en esas fechas.` },
            { status: 409 },
          );
        }
      } catch (e) {
        // Fail-closed: ante error de disponibilidad NO aplicamos el cambio
        // (sobrevender es peor que pedir reintentar).
        console.error('PATCH reserva revalidación disponibilidad error:', e);
        return NextResponse.json(
          { error: 'No se pudo verificar la disponibilidad. Intenta de nuevo.' },
          { status: 503 },
        );
      }
    }
  }

  // updateBooking re-sincroniza los bloqueos RESERVADO (por booking_id) cuando
  // cambian fechas/cuartos; por eso NO usamos block/unblockRooms aquí (evita
  // mezclar estados RESERVADO/BLOQUEADO y dejar fechas viejas ocupadas).
  await updateBooking(ctx.hotelId, booking.id, raw);
  // Cancelada desde el panel → sus lugares de experiencias quedan libres.
  if (raw.estado === 'CANCELADA' && booking.estado !== 'CANCELADA') {
    await liberarExperienciaVentas(ctx.hotelId, booking.confirmacion);
  }
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
  await liberarExperienciaVentas(ctx.hotelId, booking.confirmacion);
  return NextResponse.json({ ok: true });
}
