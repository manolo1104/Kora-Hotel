import { requireHotelMember } from '@/lib/tenant';
import { puedeCtx } from '@/lib/panel/permisos';
import { motivoCierre } from '@/lib/panel/pantallas';
import { SinPermiso, pantallaDe } from '@/components/panel/SinPermiso';
import { getAllBookings } from '@/lib/db/admin';
import { hotelRooms, nightOpts } from '@/lib/booking';
import ReservasClient from './ReservasClient';

export const dynamic = 'force-dynamic';

export default async function ReservasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // Todo el equipo ve las reservas por su puesto, pero el dueño puede
  // esconderle la pestaña a una persona concreta.
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, 'reservas');
  if (cierre) {
    return (
      <SinPermiso
        titulo="Reservas"
        quien="recepcion"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }

  const bookings = await getAllBookings(ctx.hotelId);
  const rooms = hotelRooms(ctx.hotel);

  // El DINERO se decide en el servidor, no en el cliente. Limpieza y cocina ven
  // quién llega y a qué cuarto, sin el importe; y la SUMA del periodo es de
  // mando (`ingresos:ver`), porque es la cifra del negocio, no la de una noche.
  return (
    <ReservasClient
      initialBookings={bookings}
      rooms={rooms}
      nightOpts={nightOpts(ctx.hotel)}
      slug={slug}
      verDinero={puedeCtx(ctx, 'reservas:dinero')}
      verTotalPeriodo={puedeCtx(ctx, 'ingresos:ver')}
      verAcciones={puedeCtx(ctx, 'reservas:escribir')}
    />
  );
}
