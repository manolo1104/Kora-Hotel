// Editor del DOCUMENTO branded de una cotización ("modificar antes de descargar").
// Server: resuelve el hotel + la cotización y arma los datos por defecto (marca
// del hotel + datos reales + overrides guardados). El editor vive en el cliente.

import { notFound } from "next/navigation";
import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { getQuote } from "@/lib/db/admin";
import { assembleCotizacion } from "@/lib/docs/assemble";
import DocumentoEditor from "@/components/panel/DocumentoEditor";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireHotelMember(slug);

  // La cotización con sus precios. Bastaba ser miembro, igual que pasaba con el
  // documento de una reserva.
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "cotizaciones");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Documento de la cotización"
        quien="recepcion"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }

  const q = await getQuote(ctx.hotelId, id);
  if (!q) notFound();

  const { brand, data } = assembleCotizacion(ctx.hotel, q);
  return <DocumentoEditor kind="cotizacion" slug={slug} id={id} brand={brand} data={data} />;
}
