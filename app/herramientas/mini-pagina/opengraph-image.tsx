import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Crea la página de reservas de tu hotel gratis — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Gratis",
    title: "Tu página de reservas directas, gratis",
    subtitle:
      "Fotos, habitaciones, precios y botón de WhatsApp. Más una guía del huésped con QR. En minutos.",
  });
}
