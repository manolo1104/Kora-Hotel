import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Cómo funciona Kora — tu hotel operando en 48 horas";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    eyebrow: "Cómo funciona",
    title: "Tu hotel operando en 48 horas",
    subtitle: "Lo instalamos llave en mano y capacitamos a tu equipo. Sin saber de tecnología.",
  });
}
