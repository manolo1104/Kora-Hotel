import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Glosario hotelero de Kora — términos clave en español";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    eyebrow: "Glosario hotelero",
    title: "Los términos del hotel, en español claro",
    subtitle: "PMS, RevPAR, OTA, overbooking y más, explicados para hoteleros.",
  });
}
