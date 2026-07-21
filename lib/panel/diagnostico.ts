// Diagnóstico de configuración de un hotel. Fuente ÚNICA que consumen:
//   - la página de Camila (etapa "Lo que Camila sabe") — /panel/[slug]/camila
//   - el checklist "Primeros pasos" del Inicio — /panel/[slug]/insights
// SOLO servidor (lee la fila del hotel). Cada consumidor elige qué items mostrar.

import { hotelRooms, temporadasDe } from "@/lib/booking";
import type { HotelRow } from "@/lib/tenant";

export interface DiagnosticoItem {
  ok: boolean;
  label: string;
  detalle?: string; // texto extra (ej. "3 tipos")
  aviso?: string; // advertencia cuando algo está incompleto o por vencer
  tab?: string; // pestaña del editor a la que enlazar (?tab=...) en /panel/[slug]/sitio
}

export type EstadoTemporadas = "ok" | "sin-temporadas" | "vencida" | "por-vencer";

export interface CoberturaTemporadas {
  tiene: boolean;
  hastaMax?: string; // ISO YYYY-MM-DD de la última fecha cubierta
  hastaTexto?: string; // dd/mm/aaaa legible
  estado: EstadoTemporadas;
  mensaje: string; // explicación lista para mostrar al hotelero
}

export interface DiagnosticoHotel {
  habitaciones: DiagnosticoItem;
  precios: DiagnosticoItem;
  camas: DiagnosticoItem;
  fotos: DiagnosticoItem;
  amenidades: DiagnosticoItem;
  politicas: DiagnosticoItem;
  reglas: DiagnosticoItem;
  faqs: DiagnosticoItem;
  guia: DiagnosticoItem;
  accesibilidad: DiagnosticoItem;
  experiencias: DiagnosticoItem;
  cobros: DiagnosticoItem;
  botEntrenado: DiagnosticoItem;
  publicado: DiagnosticoItem;
  temporadas: CoberturaTemporadas;
}

function hoyMexicoISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Analiza hasta qué fecha llegan los precios de temporada y en qué estado están. */
export function coberturaTemporadas(hotel: HotelRow): CoberturaTemporadas {
  const temporadas = temporadasDe(hotel);
  if (temporadas.length === 0) {
    return {
      tiene: false,
      estado: "sin-temporadas",
      mensaje:
        "No cargaste precios de temporada. Camila cotiza el precio base para cualquier fecha; en temporada alta podrías estar cobrando de menos.",
    };
  }
  const hastaMax = temporadas.reduce((max, t) => (t.hasta > max ? t.hasta : max), temporadas[0].hasta);
  const hoy = hoyMexicoISO();
  const hastaTexto = fechaLegible(hastaMax);

  // Días entre hoy y la última fecha cubierta (comparación por string ISO ordenable).
  const msPorDia = 86400000;
  const diffDias = Math.round((Date.parse(hastaMax) - Date.parse(hoy)) / msPorDia);

  if (hastaMax < hoy) {
    return {
      tiene: true,
      hastaMax,
      hastaTexto,
      estado: "vencida",
      mensaje: `Tus precios de temporada terminaron el ${hastaTexto}. A partir de hoy Camila cotiza el precio base. Extiende tus temporadas para las próximas fechas.`,
    };
  }
  if (diffDias <= 30) {
    return {
      tiene: true,
      hastaMax,
      hastaTexto,
      estado: "por-vencer",
      mensaje: `Tus precios de temporada llegan hasta el ${hastaTexto} (menos de 30 días). Cárgalas para las siguientes fechas para no cotizar de menos.`,
    };
  }
  return {
    tiene: true,
    hastaMax,
    hastaTexto,
    estado: "ok",
    mensaje: `Tus precios de temporada llegan hasta el ${hastaTexto}.`,
  };
}

/** Diagnóstico completo del hotel. Cada consumidor toma los items que necesita. */
export function diagnosticarHotel(hotel: HotelRow): DiagnosticoHotel {
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const rooms = hotelRooms(hotel);
  const conPrecio = rooms.filter((r) => r.price > 0);
  const conCamas = rooms.filter((r) => Array.isArray(r.camas) && r.camas.length > 0);
  const amenidades = Array.isArray(extras.amenidades) ? (extras.amenidades as unknown[]) : [];
  const faqsPanel = Array.isArray(extras.faqs) ? (extras.faqs as unknown[]) : [];
  const bot = (extras.bot ?? {}) as Record<string, unknown>;
  const faqsBot = Array.isArray(bot.faqs) ? (bot.faqs as unknown[]) : [];
  const politicas = (extras.politicas ?? {}) as Record<string, unknown>;
  const reglas = (extras.reglas ?? {}) as Record<string, unknown>;
  const experiencias = Array.isArray(extras.experiencias) ? (extras.experiencias as unknown[]) : [];
  const guia = (hotel.guia ?? {}) as Record<string, unknown>;
  const accesibilidadHotel = typeof extras.accesibilidad === "string" && extras.accesibilidad.trim();
  const accesibilidadCuartos = rooms.some((r) => Boolean(r.accesibilidad));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  // Criterio honesto: "entrenada" = tiene identidad/instrucciones Y el hotelero
  // la probó de verdad (probadoAt se marca a las 3 interacciones de prueba).
  const botConTexto =
    Boolean(bot.entrenadoAt) || Boolean(str(bot.tono) || str(bot.saludo) || str(bot.instrucciones));
  const botEntrenado = botConTexto && Boolean(bot.probadoAt);

  return {
    habitaciones: {
      ok: rooms.length > 0,
      label: "Habitaciones",
      detalle: rooms.length ? `${rooms.length} tipo(s)` : undefined,
      aviso: rooms.length ? undefined : "Agrega al menos un tipo de habitación.",
      tab: "habitaciones",
    },
    precios: {
      ok: conPrecio.length === rooms.length && rooms.length > 0,
      label: "Precio por noche en cada habitación",
      aviso:
        rooms.length && conPrecio.length < rooms.length
          ? "Hay habitaciones sin precio: Camila no las puede cotizar."
          : undefined,
      tab: "habitaciones",
    },
    camas: {
      ok: conCamas.length > 0,
      label: "Camas por habitación",
      detalle: conCamas.length ? `${conCamas.length}/${rooms.length} con camas` : undefined,
      aviso: conCamas.length ? undefined : "Agrega las camas para que Camila responda cuántas hay.",
      tab: "habitaciones",
    },
    fotos: {
      ok: (hotel.fotos?.length ?? 0) > 0,
      label: "Fotos del hotel",
      detalle: hotel.fotos?.length ? `${hotel.fotos.length} foto(s)` : undefined,
      aviso: hotel.fotos?.length ? undefined : "Sube fotos: tu motor y tu página se ven vacíos sin ellas.",
      tab: "contenido",
    },
    amenidades: {
      ok: amenidades.length > 0,
      label: "Amenidades del hotel",
      detalle: amenidades.length ? `${amenidades.length}` : undefined,
      aviso: amenidades.length
        ? undefined
        : "Márcalas para que Camila pueda presumir alberca, wifi, estacionamiento…",
      tab: "contenido",
    },
    politicas: {
      ok: Object.keys(politicas).length > 0,
      label: "Políticas",
      aviso: Object.keys(politicas).length
        ? undefined
        : "Sin esto, Camila no sabe responder sobre cancelaciones, mascotas o niños.",
      tab: "avanzado",
    },
    reglas: {
      ok: Object.keys(reglas).length > 0,
      label: "Reglas de reserva e impuestos",
      aviso: Object.keys(reglas).length
        ? undefined
        : "Define anticipo y cancelación para que Camila explique cómo se paga.",
      tab: "avanzado",
    },
    faqs: {
      ok: faqsPanel.length + faqsBot.length > 0,
      label: "Preguntas frecuentes",
      detalle: faqsPanel.length + faqsBot.length ? `${faqsPanel.length + faqsBot.length}` : undefined,
      aviso:
        faqsPanel.length + faqsBot.length
          ? undefined
          : "Son las respuestas exactas de tu hotel a lo que más preguntan.",
      tab: "resenas",
    },
    guia: {
      ok: Object.keys(guia).length > 0,
      label: "Guía / recomendaciones",
      aviso: Object.keys(guia).length
        ? undefined
        : "Con la guía, Camila responde check-in, check-out, wifi y qué visitar.",
      tab: "contenido",
    },
    accesibilidad: {
      ok: Boolean(accesibilidadHotel || accesibilidadCuartos),
      label: "Accesibilidad",
      aviso:
        accesibilidadHotel || accesibilidadCuartos
          ? undefined
          : "Di cuántos escalones hay a cada cuarto y qué apoyos tiene el hotel: Camila lo usa con huéspedes de movilidad reducida.",
      tab: "habitaciones",
    },
    experiencias: {
      ok: experiencias.length > 0,
      label: "Experiencias vendibles",
      detalle: experiencias.length ? `${experiencias.length}` : undefined,
      aviso: experiencias.length
        ? undefined
        : "Agrega tours, cenas o traslados: el huésped los suma a su reserva y vendes más en cada estancia.",
      tab: "avanzado",
    },
    cobros: {
      ok: Boolean(hotel.stripe_account_id),
      label: "Cobros conectados (Stripe)",
      aviso: hotel.stripe_account_id ? undefined : "Conecta tus cobros para recibir pagos de las reservas.",
    },
    botEntrenado: {
      ok: botEntrenado,
      label: "Camila entrenada y probada",
      aviso: botEntrenado
        ? undefined
        : botConTexto
          ? "Ya la entrenaste; ahora hazle 3 preguntas en el chat de prueba para confirmar que responde bien."
          : "Entrena a Camila para que suene como tu hotel y pruébala con 3 preguntas.",
    },
    publicado: {
      ok: hotel.publicado !== false,
      label: "Sitio publicado",
      aviso: hotel.publicado !== false ? undefined : "Publica tu sitio para que sea visible.",
    },
    temporadas: coberturaTemporadas(hotel),
  };
}
