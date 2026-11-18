// Canales OTA del panel operativo (multi-tenant). Portado de
// mi-hotel/app/admin/(dashboard)/canales. Server component: resuelve el hotel por
// slug, carga sus canales OTA y deriva la lista de cuartos desde
// hotel.habitaciones (ya no hay lista fija de cuartos como en Paraíso).

import { getAllOTACalendars } from "@/lib/db/admin";
import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { unitNamesOf } from "@/lib/booking";
import CanalesClient from "./CanalesClient";
import { redirect } from "next/navigation";
import { CANALES_OTA_DISPONIBLES } from "@/lib/panel/canales-ota";

export const dynamic = "force-dynamic";
export const metadata = { title: "Canales · Panel" };

export default async function CanalesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // `requireHotelMember` sólo comprueba MEMBRESÍA. Sin esto, cualquier rol
  // del hotel abría esta pantalla — y las que cargan datos en el servidor
  // (ingresos, facturación, cotizaciones, canales) se los enseñaban.
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "canales");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Canales OTA"
        quien="encargada"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }
  // Interruptor único (lib/panel/canales-ota.ts).
  if (!CANALES_OTA_DISPONIBLES) redirect(`/panel/${slug}/calendario`);

  const initial = await getAllOTACalendars(ctx.hotelId);
  // Unidades físicas, no tipos: cada anuncio de una OTA es un cuarto concreto.
  const rooms = unitNamesOf(ctx.hotel);

  return <CanalesClient initial={initial} rooms={rooms} slug={slug} />;
}
