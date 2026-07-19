import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { buildHotelKnowledge } from "@/lib/bot/knowledge";
import { buildBotSystemPrompt } from "@/lib/bot/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chat de PRUEBA de Camila para la landing (público, sin auth). Usa el mismo
// cerebro que el bot real, pero contra el hotel DEMO (Paraíso Encantado) y en
// modo prueba (sin reservar de verdad). Patrón de /api/soporte: haiku + rate
// limit por IP + tope de entrada + system con caché.

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 500;
const MAX_INPUT_CHARS = 1000;
const MAX_TURNOS = 12;
const DEMO_SLUG = "paraiso-encantado";

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const ahora = Date.now();
  const previos = (hits.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  hits.set(ip, previos);
  return previos.length > MAX_POR_VENTANA;
}

// El system prompt del demo casi no cambia: lo cacheamos en memoria del proceso.
let cache: { prompt: string; exp: number } | null = null;
const CACHE_MS = 5 * 60_000;

async function getDemoPrompt(): Promise<string | null> {
  if (cache && cache.exp > Date.now()) return cache.prompt;
  const hotel = await resolveHotel(DEMO_SLUG);
  if (!hotel) return null;
  const knowledge = buildHotelKnowledge(hotel);
  const base = buildBotSystemPrompt(knowledge, { modoPrueba: true });
  const prompt = `${base}

DEMOSTRACIÓN EN LA WEB DE KORA
- Estás en una DEMO dentro de la página de Kora, para que un HOTELERO vea cómo trabajarías con SUS huéspedes.
- Da precios "desde" orientativos y, cuando te pidan disponibilidad o cerrar, explica con naturalidad que en la versión en vivo confirmarías la disponibilidad real y le mandarías aquí mismo el link de pago.
- Mantente breve y encantadora. No pidas datos personales reales.`;
  cache = { prompt, exp: Date.now() + CACHE_MS };
  return prompt;
}

interface Turno {
  rol: "user" | "assistant";
  texto: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "La demo no está disponible ahora. Escríbenos y con gusto te la mostramos." },
      { status: 503 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Vas muy rápido. Espera un momento e inténtalo de nuevo." },
      { status: 429 }
    );
  }

  let body: { mensajes?: Turno[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const turnos = (Array.isArray(body.mensajes) ? body.mensajes : [])
    .filter(
      (m): m is Turno =>
        !!m &&
        (m.rol === "user" || m.rol === "assistant") &&
        typeof m.texto === "string" &&
        m.texto.trim().length > 0
    )
    .slice(-MAX_TURNOS)
    .map((m) => ({ rol: m.rol, texto: m.texto.trim().slice(0, MAX_INPUT_CHARS) }));

  if (turnos.length === 0 || turnos[turnos.length - 1].rol !== "user") {
    return NextResponse.json({ error: "Escribe tu mensaje." }, { status: 400 });
  }

  const systemPrompt = await getDemoPrompt();
  if (!systemPrompt) {
    return NextResponse.json(
      { error: "La demo no está disponible ahora. Inténtalo más tarde." },
      { status: 503 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: turnos.map((t) => ({
        role: t.rol === "user" ? ("user" as const) : ("assistant" as const),
        content: t.texto,
      })),
    });

    const texto = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ texto });
  } catch (e) {
    console.error("[agent-demo] error de IA:", e);
    return NextResponse.json(
      { error: "No pudimos responder. Inténtalo de nuevo en un momento." },
      { status: 500 }
    );
  }
}
