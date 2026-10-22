import { koraOG, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { herramientas } from "@/lib/herramientas";

// Sin este archivo la página salía SIN imagen al compartirla en WhatsApp: su
// `openGraph` propio reemplaza al del padre y la de /herramientas no se hereda.
const h = herramientas.find((x) => x.slug === "auditoria-ficha");

export const alt = `${h?.titulo ?? "Herramienta gratis"} — Kora`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return koraOG({
    eyebrow: "Herramienta gratis para hoteles",
    title: h?.titulo ?? "Herramientas gratis para tu hotel",
    subtitle: h?.resumen ?? "Calculadoras y generadores con IA. Sin registro, en español.",
  });
}
