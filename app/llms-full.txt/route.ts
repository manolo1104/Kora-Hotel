import type { Article } from "@/lib/articles";
import { getAllArticles } from "@/lib/blog-db";
import { herramientasDisponibles } from "@/lib/herramientas";
import { glosario } from "@/lib/glosario";
import { comparativas } from "@/lib/comparativas";
import { personas } from "@/lib/personas";
import { ciudades } from "@/lib/ciudades";
import { paginasWhatsApp } from "@/lib/whatsapp";
import { AYUDA } from "@/lib/ayuda";
import { faqs } from "@/lib/faqs";
import { PRECIO_DESDE, GARANTIA, PASOS_ALTA, AYUDA_ALTA, RUTA_REGISTRO } from "@/lib/oferta";

// llms-full.txt dinámico: enumeración exhaustiva de todo el contenido del sitio,
// generada de los mismos datos que renderizan las páginas.
//
// Era `force-static` y leía sólo los 5 artículos de lib/articles.ts: los que el
// agente publica en la base (12+ al 22 oct 2026) no salían nunca, y el
// encabezado decía «Blog (5)». Ahora lee el blog completo con ISR diario, y
// /api/blog/create lo refresca al publicar.
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// 15 sep 2026: el resumen de arriba prometía «arranque llave en mano gratis;
// solo 5 hoteles nuevos al mes» y no había forma de saber dónde registrarse.
// Mismo cambio que en llms.txt: registro, pasos de PASOS_ALTA y WhatsApp sólo
// como apoyo.
const URL_REGISTRO = `${BASE}${RUTA_REGISTRO}`;

// Las páginas sueltas del sitio, con lo que el visitante encuentra en cada una.
// Sin cifras del caso: ésas viven en lib/caso-paraiso.ts y se leen en la página.
const PAGINAS_SUELTAS: { ruta: string; texto: string }[] = [
  { ruta: "/caracteristicas", texto: "Los módulos de Kora: motor de reservas, bot de WhatsApp, PMS, dashboard y CRM" },
  { ruta: "/como-funciona", texto: "Cómo empezar: crear la cuenta, cargar el hotel y probarlo por dentro" },
  { ruta: "/precios", texto: "El plan único, qué incluye y las recargas de mensajes de Camila" },
  { ruta: "/casos/paraiso-encantado", texto: "Caso de estudio del Hotel Paraíso Encantado (Xilitla, SLP), el hotel del fundador, con sus cifras medidas" },
  { ruta: "/guia", texto: "Guía gratis: el plan de 90 días, semana por semana, para depender menos de Booking" },
  { ruta: "/blog", texto: "Artículos sobre reservas directas, comisiones de OTAs, WhatsApp y operación hotelera" },
  { ruta: "/herramientas", texto: "Calculadoras y generadores gratis para hoteles" },
  { ruta: "/glosario", texto: "Glosario hotelero en español" },
  { ruta: "/comparativas", texto: "Kora frente a las OTAs, los chatbots genéricos y las hojas de cálculo" },
  { ruta: "/para", texto: "Kora según el tipo de alojamiento" },
  { ruta: "/hoteles-en", texto: "Reservas directas por destino de México" },
  { ruta: "/ayuda", texto: "Centro de ayuda: cuenta, página de reservas, pagos y soporte" },
  { ruta: "/contacto", texto: "Contacto y ayuda para dejar Kora listo con tu hotel" },
  { ruta: "/terminos", texto: "Términos de servicio" },
  { ruta: "/privacidad", texto: "Aviso de privacidad (LFPDPPP)" },
];

function buildFull(articulos: Article[]): string {
  const L: string[] = [];
  L.push("# Kora — detalle completo");
  L.push("");
  L.push(
    "Kora contesta el WhatsApp de tu hotel 24/7 con Camila, un agente de IA conectado al inventario real: cotiza con disponibilidad y precio reales y cierra la reserva con link de pago. Incluye además motor de reservas directas 0% comisión, PMS, dashboard y CRM, para hoteles independientes en México. Plan único $" +
      PRECIO_DESDE.toLocaleString("es-MX") +
      ` MXN/mes, todo incluido, sin permanencia. Prueba ${GARANTIA.diasPrueba} días gratis sin tarjeta, y si activas el plan y cancelas dentro de los ${GARANTIA.diasDevolucion} días siguientes al primer pago se devuelve esa mensualidad. Cada hotel se registra en ${URL_REGISTRO} y lo configura desde su panel, con ayuda por WhatsApp si la quiere.`
  );
  L.push("");

  L.push(`## Cómo empezar (${PASOS_ALTA.length} pasos)`);
  L.push(`Crear cuenta y empezar la prueba gratis: ${URL_REGISTRO}`);
  PASOS_ALTA.forEach((p, i) => L.push(`${i + 1}. ${p.titulo}: ${p.texto}`));
  L.push(`Ayuda humana, opcional: ${AYUDA_ALTA}`);
  L.push("");

  L.push(`## Preguntas frecuentes (${faqs.length})`);
  faqs.forEach((f) => {
    L.push(`### ${f.question}`);
    L.push(f.answer);
    L.push("");
  });

  L.push("## Motor de reservas y PMS");
  L.push(
    `- Motor de reservas para hoteles: el huésped ve la disponibilidad real, elige su cuarto y paga en línea (tarjeta u OXXO vía Stripe) en la web del hotel; Kora no cobra comisión por reserva. ${BASE}/motor-de-reservas`
  );
  L.push(
    `- PMS para hoteles pequeños: calendario de reservas, check-in y check-out, limpieza y mantenimiento por cuarto, huéspedes y equipo con permisos por puesto, en español. Sin channel manager: no se sincroniza con Booking, Airbnb ni Expedia. ${BASE}/pms`
  );
  L.push("");

  L.push(`## Bot de WhatsApp con IA para hoteles — Camila (${paginasWhatsApp.length} guías)`);
  L.push(`Página principal: ${BASE}/whatsapp`);
  paginasWhatsApp.forEach((w) => {
    L.push(`### ${w.pregunta}`);
    L.push(w.respuesta);
    L.push(`Leer: ${BASE}/whatsapp/${w.slug}`);
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

  L.push(`## Reservas directas por ciudad (${ciudades.length})`);
  ciudades.forEach((c) => {
    L.push(`- ${c.titulo} — ${c.resumen} — ${BASE}/hoteles-en/${c.slug}`);
  });
  L.push("");

  L.push(`## Glosario hotelero (${glosario.length})`);
  glosario.forEach((t) => {
    L.push(`### ${t.pregunta}`);
    L.push(t.definicion);
    L.push(`Leer: ${BASE}/glosario/${t.slug}`);
    L.push("");
  });
  L.push("");

  L.push(`## Blog (${articulos.length})`);
  articulos.forEach((a) => {
    L.push(`- ${a.title} — ${a.excerpt} — ${BASE}/blog/${a.slug}`);
  });
  L.push("");

  L.push(`## Centro de ayuda (${AYUDA.length})`);
  AYUDA.forEach((a) => {
    L.push(`- ${a.titulo} — ${a.resumen} — ${BASE}/ayuda/${a.slug}`);
  });
  L.push("");

  L.push("## Otras páginas del sitio");
  PAGINAS_SUELTAS.forEach((p) => L.push(`- ${p.texto}: ${BASE}${p.ruta}`));
  L.push("");

  L.push("## Empezar y contacto");
  L.push(`- Crear cuenta y probar gratis: ${URL_REGISTRO}`);
  L.push("- Dudas o ayuda para dejar el hotel listo (apoyo opcional, no hace falta para empezar): WhatsApp +52 489 125 1458");
  L.push(`- Sitio: ${BASE}`);
  L.push("");
  return L.join("\n");
}

export async function GET() {
  return new Response(buildFull(await getAllArticles()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
