import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { getAllBookings } from "@/lib/db/admin";
import { facturamaConfigured, facturamaIsSandbox } from "@/lib/admin/facturama";
import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import FacturacionClient from "./FacturacionClient";

export const dynamic = "force-dynamic";

export default async function FacturacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // `requireHotelMember` sólo comprueba MEMBRESÍA. Sin esto, cualquier rol
  // del hotel abría esta pantalla — y las que cargan datos en el servidor
  // (ingresos, facturación, cotizaciones, canales) se los enseñaban.
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "facturacion");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Facturación"
        quien="encargada"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }

  const bookings = await getAllBookings(ctx.hotelId);
  // Solo reservas facturables: confirmadas/manuales con monto.
  const facturables = bookings
    .filter((b) => reservaCuenta(b.estado) && b.total > 0)
    .slice(0, 100);

  return (
    <FacturacionClient
      bookings={facturables}
      facturama={{
        configured: facturamaConfigured(),
        sandbox: facturamaIsSandbox(),
      }}
    />
  );
}
