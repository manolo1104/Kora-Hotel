import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { GARANTIA } from "@/lib/oferta";

// Decía «Tu hotel operando en 24 horas · Lo instalamos llave en mano». Desde el
// 15 sep 2026 el alta es por cuenta propia («lo configuras tú y te ayudamos si
// quieres»), así que la tarjeta que sale al compartir la página en WhatsApp
// tiene que prometer lo mismo que la página. Los días salen de la constante.
export const alt = `Cómo funciona Kora — regístrate y pruébalo gratis ${GARANTIA.diasPrueba} días con tu hotel`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    eyebrow: "Cómo funciona",
    title: "Regístrate y prueba Kora con tu hotel",
    subtitle: `${GARANTIA.diasPrueba} días gratis, sin tarjeta. Lo configuras tú y te ayudamos si quieres.`,
  });
}
