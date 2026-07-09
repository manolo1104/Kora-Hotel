import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Precios de Kora — $550 MXN/mes, habitaciones ilimitadas";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Precios",
    title: "Tu hotel completo, $550 MXN/mes",
    subtitle:
      "Plan mes a mes, sin permanencia. Sitio web profesional opcional, como servicio aparte.",
  });
}
