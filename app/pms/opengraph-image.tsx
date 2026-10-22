import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "PMS para hoteles pequeños en México — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "PMS hotelero",
    title: "Todo tu hotel en una pantalla, en español",
    subtitle: "Calendario, check-in, limpieza, huéspedes y equipo. Conectado a tu motor de reservas y a tu WhatsApp.",
  });
}
