// Editor del DOCUMENTO branded de una reserva ("modificar antes de descargar").
// Server: resuelve el hotel + la reserva (por confirmación) y arma los datos por
// defecto. El editor vive en el cliente.

import { notFound } from "next/navigation";
import { requireHotelMember } from "@/lib/tenant";
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
  const bookings = await getAllBookings(ctx.hotelId);
  const b = bookings.find((x) => x.confirmacion === id);
  if (!b) notFound();

  const { brand, data } = assembleReserva(ctx.hotel, b);
  return <DocumentoEditor kind="reserva" slug={slug} id={id} brand={brand} data={data} />;
}
