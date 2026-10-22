import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { PRECIO_DESDE } from "@/lib/oferta";

export const alt = "Motor de reservas para hoteles sin comisión — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Motor de reservas directas",
    title: "Tus huéspedes reservan y pagan directo, sin comisión",
    subtitle: `Tarjeta u OXXO, confirmación automática y el dinero en tu cuenta. $${PRECIO_DESDE.toLocaleString("es-MX")} MXN/mes.`,
  });
}
