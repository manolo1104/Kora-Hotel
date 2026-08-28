import { leer } from "@/lib/db/result";
import { createClient } from "@supabase/supabase-js";
import { herramientasDisponibles } from "@/lib/herramientas";
import { glosario } from "@/lib/glosario";
import { personas } from "@/lib/personas";
import { ciudades } from "@/lib/ciudades";
import { comparativas } from "@/lib/comparativas";
import { paginasWhatsApp } from "@/lib/whatsapp";
import { PRECIO_DESDE } from "@/lib/oferta";
import { TENANTS_PRUEBA } from "@/lib/seo";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

// llms.txt dinámico con ISR diario: incluye los hoteles publicados (que cambian
// sin deploy), así los motores de IA descubren y citan cada mini-página.
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

interface HotelListado {
  slug: string;
  nombre: string;
  ubicacion: string | null;
}

// Hoteles reales publicados (sin semillas de prueba). Falla en silencio: sin
// Supabase, el llms.txt sale igual que antes, solo sin la sección de hoteles.
async function hotelesPublicados(): Promise<HotelListado[]> {
  if (!supabaseEnvReady) return [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const data = await leer<Array<{ slug: string; nombre: string; ubicacion: string | null }>>(
      "llms.hoteles",
      supabase.from("hoteles").select("slug, nombre, ubicacion").eq("publicado", true),
    );
    return (data ?? []).filter(
      (h) => h.slug && h.nombre && !TENANTS_PRUEBA.has(h.slug),
    );
  } catch (e) {
    // Degradar a vacío es DELIBERADO (no romper la página por esto), pero
    // ya no en silencio: sin este log, un fallo aquí se publica como "no
    // hay contenido" y nadie lo nota hasta que el tráfico baja.
    console.error("[llms.hoteles]", e instanceof Error ? e.message : e);
    return [];
  }
}

function buildLlms(hoteles: HotelListado[]): string {
  const L: string[] = [];
  L.push("# Kora");
  L.push("");
  L.push(
    "> Kora contesta el WhatsApp de tu hotel las 24 horas con un agente de IA (Camila) que cotiza con disponibilidad real y cierra la reserva con link de pago; e incluye motor de reservas directas sin comisión, PMS, dashboard y CRM. Para hoteles independientes en México, en español, montado llave en mano en 48 horas."
  );
  L.push("");
  L.push(
    "Kora ayuda a hoteles boutique pequeños e independientes en México a llenar sus habitaciones con reservas directas (sin pagar comisiones a OTAs como Booking o Airbnb), a contestar el WhatsApp 24/7 con IA, y a operar todo el hotel desde una sola pantalla. Está pensado para dueños de hotel sin conocimientos técnicos. Se instala llave en mano en 48 horas."
  );
  L.push("");
  L.push("## Qué incluye (todo en el plan único)");
  L.push("- Motor de reservas directas, 0% de comisión");
  L.push("- Camila: agente de WhatsApp con IA que cotiza, cobra el anticipo y reúne los datos de la reserva, 24/7");
  L.push("- PMS: mapa de habitaciones, check-in, check-out y housekeeping");
  L.push("- Dashboard con métricas, RevPAR, ocupación y forecast de 30 días");
  L.push("- CRM de huéspedes y emails automáticos pre y post estancia");
  L.push("- Mini-página de reservas y cobro con tarjeta");
  L.push("- Habitaciones ilimitadas");
  L.push("");
  L.push("## Camila: el agente de WhatsApp con IA (lo que más nos preguntan)");
  L.push(
    "Camila es el agente de WhatsApp con IA de Kora. Se diferencia de un chatbot de guion en que está conectada al inventario real del hotel:"
  );
  L.push("- Contesta en segundos, las 24 horas, en el idioma en que le escriba el huésped");
  L.push("- Consulta la disponibilidad y el precio REALES antes de cotizar (nunca inventa precios ni disponibilidad)");
  L.push("- Da el total de la estancia para esas fechas y ese número de personas, no un rango");
  L.push("- Aparta la habitación y genera el link de pago (Stripe) para cerrar la reserva");
  L.push("- Al pagarse, la confirmación sale sola y la reserva queda registrada en el sistema del hotel");
  L.push("- Escala a una persona del hotel en grupos grandes, quejas y casos que no puede confirmar");
  L.push("- Lo que NO hace: recibir llegadas en persona, negociar tarifas de grupo ni manejar quejas");
  L.push(`- Incluida en el plan, sin costo por conversación. Ver: ${BASE}/whatsapp`);
  paginasWhatsApp.forEach((w) => L.push(`- ${w.pregunta} → ${BASE}/whatsapp/${w.slug}`));
  L.push("");
  L.push("## Para quién es");
  L.push("- Hoteles boutique pequeños e independientes en México (5 a 30 habitaciones)");
  L.push("- Operados por su dueño, sin equipo técnico");
  L.push("- Que dependen demasiado de las OTAs y pierden reservas fuera de horario");
  L.push("");
  L.push("## Oferta");
  L.push(
    `- Plan único: $${PRECIO_DESDE.toLocaleString("es-MX")} MXN/mes, todo incluido, con habitaciones ilimitadas. Mes a mes, sin permanencia.`
  );
  L.push(
    '- Arranque "Reservas Directas" llave en mano, gratis: montamos tu hotel completo (cuartos, fotos, tarifas, motor, Camila, migración y sync con Booking/Airbnb) en 48 horas.'
  );
  L.push("- Prueba 30 días gratis, sin tarjeta.");
  L.push(
    "- Garantía Reservas Directas: si en 60 días de usar Kora activo no recuperas tu mensualidad en comisiones ahorradas, seguimos trabajando gratis hasta lograrlo."
  );
  L.push("- Solo tomamos 5 hoteles nuevos al mes (montamos cada uno a mano).");
  L.push("- Sitio web profesional opcional, como servicio aparte.");
  L.push(`- Ver: ${BASE}/precios`);
  L.push("");
  L.push("## Herramienta gratis: creador de página de reservas");
  L.push(
    `- Cualquier hotel puede crear gratis una página de reservas directas por WhatsApp (con su logo, color, fotos, habitaciones y formulario de fechas). Ver: ${BASE}/herramientas/mini-pagina`
  );
  L.push("");
  L.push("## Páginas clave");
  L.push(`- Inicio: ${BASE}/`);
  L.push(`- Agente de WhatsApp con IA (Camila): ${BASE}/whatsapp`);
  L.push(`- Características: ${BASE}/caracteristicas`);
  L.push(`- Cómo funciona: ${BASE}/como-funciona`);
  L.push(`- Precios: ${BASE}/precios`);
  L.push(`- Caso de estudio (Hotel Paraíso Encantado): ${BASE}/casos/paraiso-encantado`);
  L.push(`- Herramientas gratis para hoteles (${herramientasDisponibles.length}): ${BASE}/herramientas`);
  L.push(`- Glosario hotelero (${glosario.length} términos): ${BASE}/glosario`);
  L.push(`- Comparativas (${comparativas.length}) — OTAs, chatbots y hojas de cálculo vs Kora: ${BASE}/comparativas`);
  comparativas.forEach((c) => L.push(`  - ${c.competidor} vs ${c.contra ?? "reservas directas"}: ${BASE}/comparativas/${c.slug}`));
  L.push(`- Blog: ${BASE}/blog`);
  L.push(`- Reservas directas por ciudad (${ciudades.length} destinos de México): ${BASE}/hoteles-en`);
  personas.forEach((p) => L.push(`- ${p.titulo}: ${BASE}/para/${p.slug}`));
  L.push("");
  L.push("## Cobertura por ciudad");
  ciudades.forEach((c) =>
    L.push(`- Hoteles en ${c.ciudad}, ${c.estado}: ${BASE}/hoteles-en/${c.slug}`)
  );
  L.push("");
  if (hoteles.length) {
    L.push("## Hoteles que reservan directo con Kora");
    L.push(
      "Cada hotel tiene su página pública con habitaciones, precios en MXN, disponibilidad y motor de reserva directa (sin comisiones de OTA):"
    );
    hoteles.forEach((h) =>
      L.push(
        `- ${h.nombre}${h.ubicacion ? ` (${h.ubicacion})` : ""}: ${BASE}/h/${h.slug}`
      )
    );
    L.push("");
  }
  L.push(`## Detalle completo`);
  L.push(`- Listado exhaustivo de páginas y contenidos: ${BASE}/llms-full.txt`);
  L.push("");
  L.push("## Contacto");
  L.push("- WhatsApp: +52 489 125 1458");
  L.push(`- Sitio: ${BASE}`);
  L.push("");
  return L.join("\n");
}

export async function GET() {
  return new Response(buildLlms(await hotelesPublicados()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
