import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

// Imagen que se muestra al compartir el sitio en WhatsApp, Facebook, X, etc.
export const alt =
  "Kora — Sistema hotelero con IA para hoteles boutique en México";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    title: "Llena tu hotel con reservas directas. Sin depender de Booking.",
    subtitle:
      "Reservas directas sin comisión, WhatsApp 24/7 y tu hotel en una sola pantalla · desde $1,990 MXN/mes, en español.",
  });
}
