import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { puedeCtx } from "@/lib/panel/permisos";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { getCleaningTasks, getMaintenanceTasks } from "@/lib/db/admin";
import { unitNamesOf } from "@/lib/booking";
import { hoyHotel } from "@/lib/fecha-hotel";
import OperacionesClient from "./OperacionesClient";

export const dynamic = "force-dynamic";

export default async function OperacionesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // Esta pantalla la ve todo el equipo por su puesto, pero el dueño puede
  // esconderla persona por persona desde "Quién trabaja aquí".
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "operaciones");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Operaciones"
        quien="recepcion"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }

  const [cleaning, maintenance] = await Promise.all([
    getCleaningTasks(ctx.hotelId),
    getMaintenanceTasks(ctx.hotelId),
  ]);

  // Los cuartos salen del hotel (NO de ALL_SUITES de Paraíso).
  // Por cuarto FÍSICO: limpieza y mantenimiento se hacen en la cabaña 2, no en
  // "el tipo Cabaña". Con tipos, las unidades 2..N no aparecían en la lista.
  const roomNames = unitNamesOf(ctx.hotel);

  return (
    <OperacionesClient
      initialCleaning={cleaning}
      initialMaintenance={maintenance}
      suites={roomNames}
      today={hoyHotel()}
      slug={slug}
      // El botón de walk-in lleva a dar de alta una reserva: si el puesto no
      // puede escribirlas (la camarista entra aquí a ver la limpieza), ni
      // siquiera se le enseña. Un botón que lleva a un 403 se lee como que el
      // panel se descompuso.
      puedeReservar={puedeCtx(ctx, "reservas:escribir")}
    />
  );
}
