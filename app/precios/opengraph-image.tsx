import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Precios de Kora — sistema hotelero desde $2,990 MXN/mes";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Precios",
    title: "Todo tu hotel, desde $2,990 MXN/mes",
    subtitle:
      "Un solo plan, todo incluido. O tu página 100% a la medida desde $10,000. Sin contrato anual.",
  });
}
