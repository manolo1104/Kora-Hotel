import { getAllBookings } from "@/lib/admin/sheets-admin";
import { calcKPIs } from "@/lib/admin/kpis";
import { requireHotelMember } from "@/lib/tenant";
import { puede } from "@/lib/panel/permisos";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
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

  // `requireHotelMember` sólo comprueba MEMBRESÍA. Sin esto, cualquier rol
  // del hotel abría esta pantalla — y las que cargan datos en el servidor
  // (ingresos, facturación, cotizaciones, canales) se los enseñaban.
  if (!puede(ctx.rol, "ingresos:ver")) {
    return <SinPermiso titulo="Ingresos" quien="encargada" volverA={pantallaDe(ctx.rol, slug)} />;
  }
  const bookings = await getAllBookings(ctx.hotelId);
  const kpis = calcKPIs(bookings, totalUnits(ctx.hotel) || undefined);
  return <IngresosClient kpis={kpis} />;
}
