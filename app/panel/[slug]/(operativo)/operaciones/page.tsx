import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { getCleaningTasks, getMaintenanceTasks } from "@/lib/db/admin";
import { unitNamesOf } from "@/lib/booking";
import OperacionesClient from "./OperacionesClient";

export const dynamic = "force-dynamic";

function todayMX(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
      today={todayMX()}
    />
  );
}
