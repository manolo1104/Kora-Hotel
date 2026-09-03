// Calendario del panel operativo (multi-tenant). Portado de
// mi-hotel/app/admin/(dashboard)/calendario. Server component: resuelve el hotel
// por slug, carga las reservas de ESE hotel y deriva la lista de cuartos +
// precios base desde hotel.habitaciones (ya no hay listas fijas).

import { getAllBookings } from "@/lib/admin/sheets-admin";
import { requireHotelMember } from "@/lib/tenant";
import { puedeCtx } from "@/lib/panel/permisos";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { nightOpts, hotelRooms, getRoomBasePrice } from "@/lib/booking";
import CalendarioClient from "./CalendarioClient";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // Esta pantalla la ve todo el equipo por su puesto, pero el dueño puede
  // esconderla persona por persona desde "Quién trabaja aquí".
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "calendario");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Calendario"
        quien="recepcion"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }

  const bookings = await getAllBookings(ctx.hotelId);
  const rooms = hotelRooms(ctx.hotel);

  // Una fila por CUARTO FÍSICO ("Cabaña", "Cabaña 2", "Cabaña 3"), no por tipo.
  //
  // El grid dibuja una fila por nombre y el POST de bloqueo manda ese nombre, así
  // que mientras la lista fueran tipos, el hotelero con 3 cabañas gestionaba 1 y
  // las otras 2 eran fantasmas: no existía la fila, no había forma de bloquear la
  // cabaña 2 desde el panel. El GET de /api/admin/disponibilidad ya devolvía los
  // datos indexados por unidad y la interfaz los descartaba en silencio.
  //
  // `bookingRooms` sigue siendo la lista de TIPOS: es la que usa el formulario de
  // reserva manual, donde se elige un tipo y no una unidad concreta.
  const roomNames = rooms.flatMap((r) => r.unidades);
  const roomPrices: Record<string, number> = {};
  for (const r of rooms) {
    const precio = getRoomBasePrice(r, r.maxGuests);
    for (const unidad of r.unidades) roomPrices[unidad] = precio;
  }

  return (
    <CalendarioClient
      slug={slug}
      initialBookings={bookings}
      rooms={roomNames}
      roomPrices={roomPrices}
      bookingRooms={rooms}
      nightOpts={nightOpts(ctx.hotel)}
      verDinero={puedeCtx(ctx, "reservas:dinero")}
    />
  );
}
