import { requireHotelMember } from "@/lib/tenant";
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
