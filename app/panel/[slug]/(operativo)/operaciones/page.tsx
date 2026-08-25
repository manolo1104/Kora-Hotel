import { requireHotelMember } from "@/lib/tenant";
import { getCleaningTasks, getMaintenanceTasks } from "@/lib/db/admin";
import { tipoNamesOf } from "@/lib/booking";
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
  const roomNames = tipoNamesOf(ctx.hotel);

  return (
    <OperacionesClient
      initialCleaning={cleaning}
      initialMaintenance={maintenance}
      suites={roomNames}
      today={todayMX()}
    />
  );
}
