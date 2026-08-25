// Canales OTA del panel operativo (multi-tenant). Portado de
// mi-hotel/app/admin/(dashboard)/canales. Server component: resuelve el hotel por
// slug, carga sus canales OTA y deriva la lista de cuartos desde
// hotel.habitaciones (ya no hay lista fija de cuartos como en Paraíso).

import { getAllOTACalendars } from "@/lib/db/admin";
import { requireHotelMember } from "@/lib/tenant";
import { tipoNamesOf } from "@/lib/booking";
import CanalesClient from "./CanalesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Canales OTA · Panel" };

export default async function CanalesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  const initial = await getAllOTACalendars(ctx.hotelId);
  const rooms = tipoNamesOf(ctx.hotel);

  return <CanalesClient initial={initial} rooms={rooms} slug={slug} />;
}
