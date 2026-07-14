import { herramientasDisponibles } from "@/lib/herramientas";
import { glosario } from "@/lib/glosario";
import { personas } from "@/lib/personas";
import { PRECIO_DESDE } from "@/lib/oferta";

// llms.txt dinámico: se regenera en cada build a partir de los datos de contenido,
// así nunca se desactualiza cuando se agregan herramientas, personas o términos.
export const dynamic = "force-static";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

function buildLlms(): string {
  const L: string[] = [];
  L.push("# Kora");
  L.push("");
  L.push(
    "> Kora es el sistema hotelero todo-en-uno con IA para hoteles independientes en México: reservas directas sin comisiones, Camila (agente de WhatsApp con IA 24/7), PMS, dashboard y CRM. En español, montado llave en mano en 48 horas."
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
  L.push(`- Características: ${BASE}/caracteristicas`);
  L.push(`- Cómo funciona: ${BASE}/como-funciona`);
  L.push(`- Precios: ${BASE}/precios`);
  L.push(`- Caso de estudio (Hotel Paraíso Encantado): ${BASE}/casos/paraiso-encantado`);
  L.push(`- Herramientas gratis para hoteles (${herramientasDisponibles.length}): ${BASE}/herramientas`);
  L.push(`- Glosario hotelero (${glosario.length} términos): ${BASE}/glosario`);
  L.push(`- Comparativas — OTAs vs reservas directas: ${BASE}/comparativas`);
  L.push(`- Blog: ${BASE}/blog`);
  personas.forEach((p) => L.push(`- ${p.titulo}: ${BASE}/para/${p.slug}`));
  L.push("");
  L.push(`## Detalle completo`);
  L.push(`- Listado exhaustivo de páginas y contenidos: ${BASE}/llms-full.txt`);
  L.push("");
  L.push("## Contacto");
  L.push("- WhatsApp: +52 489 125 1458");
  L.push(`- Sitio: ${BASE}`);
  L.push("");
  return L.join("\n");
}

export function GET() {
  return new Response(buildLlms(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
