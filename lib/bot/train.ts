// Entrenamiento con IA de Camila: propone personalidad/saludo/instrucciones para
// la asistente de WhatsApp de UN hotel, basándose ESTRICTAMENTE en los datos
// reales de ese hotel. SOLO servidor. Separado del route para probar sin HTTP
// (mismo patrón que lib/offers.ts).

import Anthropic from "@anthropic-ai/sdk";
import { hotelRooms } from "@/lib/booking";
import type { HotelRow } from "@/lib/tenant";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 900;

export interface BotTrainingDraft {
  nombre: string;
  tono: string;
  saludo: string;
  instrucciones: string;
}

/**
 * Pide a la IA un borrador de configuración de la asistente, SOLO a partir de
 * los datos del hotel. Lanza si falta la llave o la IA no responde JSON usable.
 */
export async function draftBotTraining(hotel: HotelRow): Promise<BotTrainingDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");

  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const rooms = hotelRooms(hotel);
  const amen = Array.isArray(extras.amenidades) ? (extras.amenidades as string[]) : [];
  const pol = (extras.politicas ?? {}) as Record<string, unknown>;
  const guia = (hotel.guia ?? {}) as Record<string, unknown>;

  const perfil = [
    `Nombre del hotel: ${hotel.nombre}`,
    hotel.ubicacion ? `Ubicación: ${hotel.ubicacion}` : "",
    hotel.descripcion ? `Descripción: ${hotel.descripcion}` : "",
    rooms.length ? `Tipos de cuarto: ${rooms.map((r) => r.name).join(", ")}` : "",
    amen.length ? `Amenidades: ${amen.join(", ")}` : "",
    Object.keys(pol).length
      ? `Políticas: ${Object.entries(pol)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")}`
      : "",
    Object.keys(guia).length
      ? `Guía/recomendaciones: ${Object.entries(guia)
          .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sys =
    'Eres experto en experiencia de cliente para hoteles boutique en México. Diseñas la "personalidad" de la asistente de WhatsApp de un hotel, basándote ÚNICAMENTE en los datos reales del hotel que te doy. Español de México, de "tú". NUNCA inventes servicios, precios ni amenidades que no estén en los datos.';

  const userMsg = `Con estos datos REALES del hotel, propón la configuración de su asistente de reservas por WhatsApp:

${perfil}

Devuelve SOLO JSON válido, sin nada más, con esta forma EXACTA:
{"nombre":"<nombre corto para la asistente, p.ej. Camila, Sofía; acorde al hotel>","tono":"<2 a 4 líneas describiendo su personalidad y estilo, acorde al tipo de hotel>","saludo":"<un saludo cálido de primer contacto, 1 a 2 líneas, que mencione el hotel>","instrucciones":"<3 a 6 puntos con instrucciones útiles y ESPECÍFICAS de este hotel para la asistente: qué destacar, cómo tratar dudas comunes, qué recomendar; SIN inventar nada fuera de los datos. Usa saltos de línea con guiones>"}`;

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: sys,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvió JSON");
  const p = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;

  const asStr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x)).join("\n") : String(v ?? "").trim();

  const draft: BotTrainingDraft = {
    nombre: asStr(p.nombre).slice(0, 60) || "Camila",
    tono: asStr(p.tono).slice(0, 2000),
    saludo: asStr(p.saludo).slice(0, 600),
    instrucciones: asStr(p.instrucciones).slice(0, 4000),
  };
  if (!draft.tono && !draft.saludo && !draft.instrucciones) {
    throw new Error("La IA devolvió un borrador vacío");
  }
  return draft;
}
