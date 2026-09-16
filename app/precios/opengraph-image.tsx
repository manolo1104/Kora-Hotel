import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { GARANTIA, PRECIO_DESDE } from "@/lib/oferta";

// El precio estaba escrito a mano en la tarjeta que sale al compartir /precios.
// Sale de lib/oferta.ts, junto con los días de prueba, que es lo primero que
// quiere saber quien la ve en WhatsApp.
const PRECIO = PRECIO_DESDE.toLocaleString("es-MX");

export const alt = `Precios de Kora — $${PRECIO} MXN/mes, habitaciones ilimitadas`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Precios",
    title: `Tu hotel completo, $${PRECIO} MXN/mes`,
    subtitle: `Pruébalo ${GARANTIA.diasPrueba} días gratis, sin tarjeta. Plan mes a mes, sin permanencia.`,
  });
}
