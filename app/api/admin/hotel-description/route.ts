import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Genera la descripción del HOTEL con IA, a partir de lo que el hotelero escribe
// (notas) + los datos reales de su ficha (ubicación, amenidades y habitaciones).
// Autenticado por tenant. Devuelve { texto }.

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 500;

const TONOS: Record<string, string> = {
  evocadora: "evocadora y sensorial: transporta al lector con imágenes, texturas y ambiente, sin exagerar",
  emotiva: "cálida y emotiva: conecta con lo que sentirá el huésped en su estancia",
  vender: "persuasiva y orientada a reservar: resalta beneficios y el porqué elegir este hotel, sin sonar a anuncio barato",
  sencilla: "clara, sencilla y directa: informa lo esencial sin florituras",
  moderna: "moderna y fresca: ritmo ágil, tono actual y elegante",
};

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "La IA no está configurada (falta ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  let body: {
    nombre?: string;
    ubicacion?: string;
    amenidades?: unknown;
    habitaciones?: unknown;
    notas?: string;
    tono?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const nombre = String(body.nombre ?? ctx.hotel.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "Ponle primero un nombre al hotel." }, { status: 400 });
  const ubicacion = String(body.ubicacion ?? "").trim().slice(0, 200);
  const amenidades = Array.isArray(body.amenidades)
    ? body.amenidades.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 20)
    : [];
  // Resumen de habitaciones: nombre + (features)
  const habitaciones = Array.isArray(body.habitaciones)
    ? body.habitaciones
        .map((h) => {
          const o = h as { nombre?: unknown; features?: unknown };
          const nom = String(o?.nombre ?? "").trim();
          if (!nom) return "";
          const feats = Array.isArray(o?.features)
            ? o.features.map(String).filter(Boolean).slice(0, 6)
            : [];
          return feats.length ? `${nom} (${feats.join(", ")})` : nom;
        })
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const notas = String(body.notas ?? "").trim().slice(0, 800);
  const tonoKey = String(body.tono ?? "evocadora");
  const tonoDesc = TONOS[tonoKey] ?? TONOS.evocadora;

  const system = `Eres copywriter de hoteles boutique en México. Escribes la descripción de UN HOTEL (no de una habitación), en español de México, para su página de reservas. Entre 60 y 110 palabras, en uno o dos párrafos cortos. HONESTIDAD: usa SOLO la información que te den (ubicación, amenidades, habitaciones y notas del hotelero); NO inventes amenidades, servicios, estrellas, distancias ni datos. Si te dan notas del hotelero, respétalas y mejóralas (redacción, orden, tono); no las contradigas. Sin emojis, sin comillas, sin encabezados ni listas: devuelve únicamente el texto de la descripción.`;
  const user = `Hotel: ${nombre}
Ubicación: ${ubicacion || "no especificada"}
Amenidades del hotel: ${amenidades.length ? amenidades.join(", ") : "no especificadas"}
Habitaciones: ${habitaciones.length ? habitaciones.join("; ") : "no especificadas"}
Notas del hotelero (lo que quiere resaltar): ${notas || "ninguna"}
Tono: ${tonoDesc}

Escribe la descripción de este hotel.`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const texto = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()
      .replace(/^["'"]|["'"]$/g, "");
    if (!texto) return NextResponse.json({ error: "La IA devolvió una descripción vacía. Intenta de nuevo." }, { status: 502 });
    return NextResponse.json({ texto });
  } catch (e) {
    console.error("[hotel-description] error de IA:", e);
    return NextResponse.json({ error: "No se pudo generar la descripción. Intenta de nuevo." }, { status: 502 });
  }
}
