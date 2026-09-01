import { redirect } from "next/navigation";
import { requireHotelMember } from "@/lib/tenant";
import { puedeCtx } from "@/lib/panel/permisos";
import { pantallaDe } from "@/components/panel/SinPermiso";
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
  //
  // Se pregunta por el PERMISO y no por `rol !== "dueno"` para que el día que
  // cambie la matriz esta pantalla cambie con ella — y para que el chivato
  // (scripts/check-permisos.mjs) la reconozca como puerta.
  if (!puedeCtx(ctx, "equipo:gestionar")) {
    redirect(pantallaDe(ctx.rol, slug, ctx.pantallas));
  }

  return <EquipoClient inicial={await getEquipo(ctx.hotelId)} hotelNombre={ctx.hotel.nombre} />;
}
