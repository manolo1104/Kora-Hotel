import { buildCRM } from "@/lib/admin/sheets-admin";
import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import ClientesClient from "./ClientesClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // `requireHotelMember` sólo comprueba MEMBRESÍA. Sin esto, cualquier rol
  // del hotel abría esta pantalla — y las que cargan datos en el servidor
  // (ingresos, facturación, cotizaciones, canales) se los enseñaban.
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "clientes");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Clientes"
        quien="recepcion"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }
  const crm = await buildCRM(ctx.hotelId);
  return <ClientesClient initialClientes={crm} slug={slug} />;
}
