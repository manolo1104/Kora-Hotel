import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "El plan de 90 días para dejar de depender de Booking — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Guía gratis",
    title: "El plan de 90 días para dejar de depender de Booking",
    subtitle: "Semana por semana, con las plantillas de WhatsApp que usé en mi hotel.",
  });
}
