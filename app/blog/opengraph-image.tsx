import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Blog de Kora — ideas para llenar tu hotel sin comisiones";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    eyebrow: "Blog",
    title: "Llena tu hotel sin depender de las OTAs",
    subtitle: "Guías prácticas de reservas directas, WhatsApp y revenue para hoteles boutique en México.",
  });
}
