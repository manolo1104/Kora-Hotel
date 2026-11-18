import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Sincronizar Airbnb, Booking y Expedia (Vrbo) con Kora por iCal";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Airbnb · Booking · Vrbo",
    title: "Un solo calendario, sin vender dos veces el mismo cuarto",
    subtitle: "Kora enlaza por iCal los calendarios de tus OTAs con tu motor de reservas directas y con Camila.",
  });
}
