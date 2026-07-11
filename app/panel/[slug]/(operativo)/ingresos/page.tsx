import { getAllBookings } from "@/lib/admin/sheets-admin";
import { calcKPIs } from "@/lib/admin/kpis";
import { requireHotelMember } from "@/lib/tenant";
import { totalUnits } from "@/lib/booking";
import IngresosClient from "./IngresosClient";

export const dynamic = "force-dynamic";

export default async function IngresosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);
  const bookings = await getAllBookings(ctx.hotelId);
  const kpis = calcKPIs(bookings, totalUnits(ctx.hotel) || undefined);
  return <IngresosClient kpis={kpis} />;
}
