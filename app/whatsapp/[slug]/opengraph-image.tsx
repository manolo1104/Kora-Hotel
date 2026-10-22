import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { getPaginaWhatsApp } from "@/lib/whatsapp";

export const alt = "Guía del WhatsApp de tu hotel — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getPaginaWhatsApp(slug);
  return koraOG({
    eyebrow: "WhatsApp para hoteles",
    title: p?.titulo ?? "El WhatsApp de tu hotel, contestado 24/7",
    subtitle: p?.resumen ?? "Guías para que el WhatsApp sea tu canal más rentable.",
  });
}
