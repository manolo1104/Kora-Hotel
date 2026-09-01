import { getAllBookings } from "@/lib/admin/sheets-admin";
import { calcKPIs } from "@/lib/admin/kpis";
import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
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
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "ingresos");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Ingresos"
        quien="encargada"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }
  const bookings = await getAllBookings(ctx.hotelId);
  const kpis = calcKPIs(bookings, totalUnits(ctx.hotel) || undefined);
  return <IngresosClient kpis={kpis} />;
}
