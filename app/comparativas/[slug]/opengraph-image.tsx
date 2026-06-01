import { getComparativa } from "@/lib/comparativas";
import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Comparativa — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getComparativa(slug);
  return koraOG({
    eyebrow: "Comparativa",
    title: c ? `${c.competidor} vs reservas directas` : "OTAs vs reservas directas",
    subtitle: c?.resumen ?? "Qué ganas y qué cedes con cada canal de venta.",
  });
}
