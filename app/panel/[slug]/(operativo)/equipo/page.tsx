import { redirect } from "next/navigation";
import { requireHotelMember } from "@/lib/tenant";
import { getEquipo } from "@/lib/db/equipo";
import EquipoClient from "./EquipoClient";

export const dynamic = "force-dynamic";

export default async function EquipoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // Segunda cerradura, además de la del API: sin esto la pantalla se pintaría
  // (vacía) para una recepcionista y parecería un error del sistema.
  if (ctx.rol !== "dueno") redirect(`/panel/${slug}/operaciones`);

  return <EquipoClient inicial={await getEquipo(ctx.hotelId)} hotelNombre={ctx.hotel.nombre} />;
}
