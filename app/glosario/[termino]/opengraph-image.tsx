import { getTermino } from "@/lib/glosario";
import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Glosario hotelero — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ termino: string }>;
}) {
  const { termino } = await params;
  const t = getTermino(termino);
  return koraOG({
    eyebrow: "Glosario hotelero",
    title: t?.pregunta ?? "Glosario hotelero",
    subtitle: t?.resumen ?? "Los términos del hotel, explicados claro y en español.",
  });
}
