import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Caso de éxito: Hotel Paraíso Encantado con Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    eyebrow: "Caso de éxito",
    title: "Hotel Paraíso Encantado",
    subtitle: "Reservas directas sin comisiones y WhatsApp 24/7 con IA. Xilitla, SLP.",
  });
}
