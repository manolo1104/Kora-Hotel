import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Herramientas gratis para hoteles — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Gratis para hoteleros",
    title: "Herramientas gratis para tu hotel",
    subtitle:
      "Calculadoras, generadores con IA y tu página de reservas. Sin registro, sin costo, en español.",
  });
}
