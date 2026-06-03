import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Precios de Kora — desde $1,990 MXN/mes + sitio web gratis";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Precios",
    title: "Tu hotel completo, desde $1,990 MXN/mes",
    subtitle:
      "Para los primeros 10 hoteles: te construimos tu sitio web profesional GRATIS (valor $30,000).",
  });
}
