import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

// Imagen que se muestra al compartir el sitio en WhatsApp, Facebook, X, etc.
export const alt =
  "Kora — Sistema hotelero con IA para hoteles boutique en México";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    title: "Tu hotel lleno. Sin depender de Booking.",
    subtitle:
      "Te construimos tu sitio web profesional gratis · desde $1,990 MXN/mes. Reservas directas, WhatsApp 24/7 y PMS, en español.",
  });
}
