import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Reservas directas para hoteles en la Huasteca — Kora";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Hoteles en México",
    title: "Reservas directas en la Huasteca Potosina",
    subtitle: "Motor de reservas sin comisión y WhatsApp con IA para tu hotel o cabaña.",
  });
}
