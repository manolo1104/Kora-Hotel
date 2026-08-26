import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Genera la descripción de UNA habitación con IA, según su nombre, capacidad,
// características (features) y un TONO elegido por el hotelero. Autenticado por
// tenant (a diferencia del /api/herramientas/generar público). Devuelve { texto }.

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 400;

const TONOS: Record<string, string> = {
  evocadora: "evocadora y sensorial: transporta al lector con imágenes, texturas y ambiente, sin exagerar",
  emotiva: "cálida y emotiva: conecta con lo que sentirá el huésped al hospedarse",
  vender: "persuasiva y orientada a reservar: resalta los beneficios y el porqué elegir esta habitación, sin sonar a anuncio barato",
  sencilla: "clara, sencilla y directa: informa lo esencial sin florituras",
  moderna: "moderna y fresca: ritmo ágil, tono actual y elegante",
};

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:editar");
  if (no) return no;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "La IA no está configurada (falta ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  let body: {
    nombre?: string;
    capacidad?: string | number;
    features?: unknown;
    camas?: unknown;
    notas?: string;
    tono?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "Ponle primero un nombre a la habitación." }, { status: 400 });
  const capacidad = Number(body.capacidad) || 0;
  const features = Array.isArray(body.features) ? body.features.map(String).filter(Boolean).slice(0, 20) : [];
  // Camas: cada objeto {tipo, cantidad} → "2 Queen", "1 King"
  const camas = Array.isArray(body.camas)
    ? body.camas
        .map((c) => {
          const o = c as { tipo?: unknown; cantidad?: unknown };
          const tipo = String(o?.tipo ?? "").trim();
          if (!tipo) return "";
          const cant = Number(o?.cantidad) || 0;
          return cant > 1 ? `${cant} ${tipo}` : tipo;
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];
  // Notas: lo que el hotelero ya escribió (borrador / puntos que quiere resaltar)
  const notas = String(body.notas ?? "").trim().slice(0, 600);
  const tonoKey = String(body.tono ?? "evocadora");
  const tonoDesc = TONOS[tonoKey] ?? TONOS.evocadora;

  const system = `Eres copywriter de hoteles boutique en México. Escribes la descripción de UNA habitación (no del hotel), en español de México. Entre 45 y 75 palabras, en un solo párrafo. HONESTIDAD: usa SOLO las características, camas y notas que te den; NO inventes amenidades, medidas, vistas ni datos. Si te dan notas del hotelero, respétalas y mejóralas (redacción, orden, tono); no las contradigas ni agregues datos que no estén ahí. Sin emojis, sin comillas, sin encabezados: devuelve únicamente el texto de la descripción.`;
  const user = `Hotel: ${ctx.hotel.nombre || "el hotel"}
Habitación: ${nombre}
Capacidad: ${capacidad > 0 ? `${capacidad} personas` : "no especificada"}
Camas: ${camas.length ? camas.join(", ") : "no especificadas"}
Características: ${features.length ? features.join(", ") : "no especificadas"}
Notas del hotelero (lo que quiere resaltar): ${notas || "ninguna"}
Tono: ${tonoDesc}

Escribe la descripción de esta habitación.`;

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
    console.error("[room-description] error de IA:", e);
    return NextResponse.json({ error: "No se pudo generar la descripción. Intenta de nuevo." }, { status: 502 });
  }
}
