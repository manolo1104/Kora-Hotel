import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo económico y rápido para generación de texto corto.
const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 700;
const MAX_INPUT_CHARS = 2500; // tope de entrada para acotar costo/abuso

// Rate limit best-effort por IP (en memoria; se reinicia con cada instancia).
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 8;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const ahora = Date.now();
  const previos = (hits.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  hits.set(ip, previos);
  return previos.length > MAX_POR_VENTANA;
}

type Tipo = "resena" | "whatsapp" | "descripcion" | "huesped";

interface Config {
  system: string;
  buildUser: (d: Record<string, string>) => string;
}

const D = (v?: string) => (v && v.trim() ? v.trim() : "—");

const CONFIGS: Record<Tipo, Config> = {
  resena: {
    system:
      "Eres el encargado de un hotel boutique mexicano y respondes reseñas de huéspedes en español de México. Responde breve (máximo 5–6 líneas), agradece de forma genuina, personaliza con detalles de la reseña, y si es negativa reconoce el punto con empatía y sin ponerte a la defensiva, ofreciendo mejorar. No inventes datos ni hagas promesas concretas que no se te hayan dado. Cierra invitando a regresar y firma como 'el equipo de [hotel]'.",
    buildUser: (d) =>
      `Hotel: ${D(d.hotel)}\nCalificación recibida: ${D(d.calificacion)}\nTono deseado: ${D(d.tono)}\n\nReseña del huésped:\n"""${D(d.resena)}"""\n\nEscribe la respuesta del hotel.`,
  },
  whatsapp: {
    system:
      "Eres recepcionista de un hotel boutique mexicano. Escribes mensajes de WhatsApp en español de México: cálidos, claros y breves, con emojis moderados (1–3). No inventes precios, fechas ni datos que no te den; si falta un dato, deja un espacio entre corchetes para que el hotelero lo complete.",
    buildUser: (d) =>
      `Hotel: ${D(d.hotel)}\nSituación: ${D(d.situacion)}\nDetalles: ${D(d.detalle)}\n\nEscribe el mensaje de WhatsApp.`,
  },
  descripcion: {
    system:
      "Eres copywriter de turismo. Escribes descripciones de hotel atractivas y honestas en español de México, listas para Booking o una web propia. Entre 120 y 180 palabras, vende sin exagerar ni inventar amenidades. Resalta la experiencia y la zona. No uses datos que no se te den.",
    buildUser: (d) =>
      `Hotel: ${D(d.hotel)}\nZona y atractivos cercanos: ${D(d.zona)}\nAmenidades: ${D(d.amenidades)}\nEstilo del hotel: ${D(d.estilo)}\n\nEscribe la descripción.`,
  },
  huesped: {
    system:
      "Eres el anfitrión de un hotel boutique mexicano. Escribes mensajes para el huésped según la etapa de su estancia, en español de México: cálidos, útiles y breves, con emojis moderados. No inventes datos; deja [espacios] entre corchetes donde falte información para que el hotelero la complete.",
    buildUser: (d) =>
      `Hotel: ${D(d.hotel)}\nEtapa de la estancia: ${D(d.etapa)}\nDetalles (horarios, indicaciones, etc.): ${D(d.detalle)}\n\nEscribe el mensaje para el huésped.`,
  },
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "La herramienta de IA aún no está configurada. Vuelve más tarde." },
      { status: 503 }
    );
  }

  // IP para rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Vas muy rápido. Espera un minuto e inténtalo de nuevo." },
      { status: 429 }
    );
  }

  let body: { tipo?: string; datos?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const tipo = body.tipo as Tipo;
  const datos = body.datos || {};
  const config = CONFIGS[tipo];
  if (!config) {
    return NextResponse.json({ error: "Tipo de herramienta no válido." }, { status: 400 });
  }

  // Tope de longitud de entrada
  const totalChars = Object.values(datos).join(" ").length;
  if (totalChars > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { error: "El texto es demasiado largo. Acórtalo e inténtalo de nuevo." },
      { status: 413 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: config.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: config.buildUser(datos) }],
    });

    const texto = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ texto });
  } catch (e) {
    console.error("Error generando con Anthropic:", e);
    return NextResponse.json(
      { error: "No pudimos generar el texto. Inténtalo de nuevo en un momento." },
      { status: 500 }
    );
  }
}
