import { articles } from "@/lib/articles";
import { herramientasDisponibles } from "@/lib/herramientas";
import { glosario } from "@/lib/glosario";
import { comparativas } from "@/lib/comparativas";
import { personas } from "@/lib/personas";
import { AYUDA } from "@/lib/ayuda";
import { faqs } from "@/lib/faqs";
import { PRECIO_DESDE } from "@/lib/oferta";

// llms-full.txt dinámico: enumeración exhaustiva de todo el contenido del sitio,
// generada de los mismos datos que renderizan las páginas. Se regenera en cada build.
export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

function buildFull(): string {
  const L: string[] = [];
  L.push("# Kora — detalle completo");
  L.push("");
  L.push(
    "Kora es el sistema hotelero todo-en-uno con IA para hoteles independientes en México. Reservas directas 0% comisión, Camila (WhatsApp con IA 24/7), PMS, dashboard y CRM. Plan único $" +
      PRECIO_DESDE.toLocaleString("es-MX") +
      " MXN/mes, todo incluido, sin permanencia. Prueba 30 días gratis sin tarjeta. Arranque llave en mano gratis; solo 5 hoteles nuevos al mes."
  );
  L.push("");

  L.push(`## Preguntas frecuentes (${faqs.length})`);
  faqs.forEach((f) => {
    L.push(`### ${f.question}`);
    L.push(f.answer);
    L.push("");
  });

  L.push(`## Herramientas gratis para hoteles (${herramientasDisponibles.length})`);
  herramientasDisponibles.forEach((h) => {
    L.push(`- ${h.titulo} — ${h.resumen} — ${BASE}/herramientas/${h.slug}`);
  });
  L.push("");

  L.push(`## Comparativas (${comparativas.length})`);
  comparativas.forEach((c) => {
    L.push(`- ${c.titulo} — ${c.resumen} — ${BASE}/comparativas/${c.slug}`);
  });
  L.push("");

  L.push(`## Páginas por tipo de hotel (${personas.length})`);
  personas.forEach((p) => {
    L.push(`- ${p.titulo} — ${p.resumen} — ${BASE}/para/${p.slug}`);
  });
  L.push("");

  L.push(`## Glosario hotelero (${glosario.length})`);
  glosario.forEach((t) => {
    L.push(`- ${t.termino}: ${t.resumen} — ${BASE}/glosario/${t.slug}`);
  });
  L.push("");

  L.push(`## Blog (${articles.length})`);
  articles.forEach((a) => {
    L.push(`- ${a.title} — ${a.excerpt} — ${BASE}/blog/${a.slug}`);
  });
  L.push("");

  L.push(`## Centro de ayuda (${AYUDA.length})`);
  AYUDA.forEach((a) => {
    L.push(`- ${a.titulo} — ${a.resumen} — ${BASE}/ayuda/${a.slug}`);
  });
  L.push("");

  L.push("## Contacto");
  L.push("- WhatsApp: +52 489 125 1458");
  L.push(`- Sitio: ${BASE}`);
  L.push("");
  return L.join("\n");
}

export function GET() {
  return new Response(buildFull(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
