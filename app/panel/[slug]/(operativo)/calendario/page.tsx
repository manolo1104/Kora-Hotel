// Calendario del panel operativo (multi-tenant). Portado de
// mi-hotel/app/admin/(dashboard)/calendario. Server component: resuelve el hotel
// por slug, carga las reservas de ESE hotel y deriva la lista de cuartos +
// precios base desde hotel.habitaciones (ya no hay listas fijas).

import { getAllBookings } from "@/lib/admin/sheets-admin";
import { requireHotelMember } from "@/lib/tenant";
import { hotelRooms, getRoomBasePrice } from "@/lib/booking";
import CalendarioClient from "./CalendarioClient";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  const bookings = await getAllBookings(ctx.hotelId);
  const rooms = hotelRooms(ctx.hotel);

  // Nombres + precio base por cuarto (a máxima ocupación), para el footer del grid.
  const roomNames = rooms.map((r) => r.name);
  const roomPrices: Record<string, number> = {};
  for (const r of rooms) roomPrices[r.name] = getRoomBasePrice(r, r.maxGuests);

  return (
    <CalendarioClient
      slug={slug}
      initialBookings={bookings}
      rooms={roomNames}
      roomPrices={roomPrices}
      bookingRooms={rooms}
    />
  );
}
