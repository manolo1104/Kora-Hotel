import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { PRECIO_DESDE } from "@/lib/oferta";

// Sin este archivo /whatsapp salía SIN imagen al compartirla: su `openGraph`
// propio reemplaza al de la raíz y la imagen global no se hereda.
export const alt = "Bot de WhatsApp para hoteles con IA — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Bot de WhatsApp para hoteles",
    title: "Contesta en segundos, las 24 horas, y cierra la reserva",
    subtitle: `Camila cotiza con tu disponibilidad real y manda el link de pago. En el plan de $${PRECIO_DESDE.toLocaleString("es-MX")} MXN/mes.`,
  });
}
