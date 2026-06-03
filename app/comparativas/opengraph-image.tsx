import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const alt = "Comparativas para hoteles — reservas directas vs OTAs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return koraOG({
    eyebrow: "Comparativas",
    title: "Reservas directas vs. OTAs",
    subtitle: "Compara comisiones, control y atención para decidir cómo llenar tu hotel.",
  });
}
