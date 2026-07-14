import { getCiudad } from "@/lib/ciudades";
import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Reservas directas para tu hotel — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad } = await params;
  const c = getCiudad(ciudad);
  return koraOG({
    eyebrow: "Reservas directas",
    title: c ? `Hoteles en ${c.ciudad}` : "Hoteles en México",
    subtitle: c?.resumen ?? "Sistema de reservas directas sin comisión para tu hotel.",
  });
}
