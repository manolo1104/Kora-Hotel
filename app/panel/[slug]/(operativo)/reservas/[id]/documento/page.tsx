// Editor del DOCUMENTO branded de una reserva ("modificar antes de descargar").
// Server: resuelve el hotel + la reserva (por confirmación) y arma los datos por
// defecto. El editor vive en el cliente.

import { notFound } from "next/navigation";
import { requireHotelMember } from "@/lib/tenant";
import { puedeCtx } from "@/lib/panel/permisos";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { getAllBookings } from "@/lib/db/admin";
import { assembleReserva } from "@/lib/docs/assemble";
import DocumentoEditor from "@/components/panel/DocumentoEditor";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const ctx = await requireHotelMember(slug);

  // Este documento es la reserva ENTERA con su importe y su desglose. Bastaba
  // ser miembro: la camarista llegaba por el icono de descarga de la lista y
  // veía justo lo que el hotelero pidió esconderle.
  if (!puedeCtx(ctx, "reservas:dinero")) {
    return (
      <SinPermiso
        titulo="Documento de la reserva"
        quien="recepcion"
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }

  const bookings = await getAllBookings(ctx.hotelId);
  const b = bookings.find((x) => x.confirmacion === id);
  if (!b) notFound();

  const { brand, data } = assembleReserva(ctx.hotel, b);
  return <DocumentoEditor kind="reserva" slug={slug} id={id} brand={brand} data={data} />;
}
