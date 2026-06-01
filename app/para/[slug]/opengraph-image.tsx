import { getPersona } from "@/lib/personas";
import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Kora para tu tipo de hotel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getPersona(slug);
  return koraOG({
    eyebrow: "Para tu hotel",
    title: p?.titulo ?? "Sistema hotelero con IA",
    subtitle: p?.resumen ?? "Reservas directas, WhatsApp 24/7 y PMS. En español.",
  });
}
