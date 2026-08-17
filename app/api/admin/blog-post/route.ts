import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { slugificarPost } from "@/lib/hotel-blog";
import { AMENIDADES } from "@/lib/amenidades";
import type { MiniExtras } from "@/lib/mini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Escribe un artículo del BLOG DEL HOTEL con IA a partir del tema que da el
// hotelero + los datos reales de su ficha. Devuelve { titulo, slug, excerpt,
// contenido } en el markdown mínimo que renderiza lib/hotel-blog.ts. El
// hotelero siempre lo revisa antes de publicar. Autenticado por tenant.

// Un artículo que se va a indexar necesita mejor redacción que una descripción
// de 3 líneas, y el uso es esporádico: sonnet, no haiku.
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 2500;

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  let body: { tema?: string; notas?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const tema = String(body.tema ?? "").trim().slice(0, 200);
  if (!tema) {
    return NextResponse.json({ error: "Escribe el tema del artículo." }, { status: 400 });
  }
  const notas = String(body.notas ?? "").trim().slice(0, 1200);

  const hotel = ctx.hotel as unknown as {
    nombre: string;
    ubicacion: string | null;
    descripcion: string | null;
    extras: MiniExtras | null;
  };
  const amenidades = (hotel.extras?.amenidades ?? [])
    .map((k) => AMENIDADES.find((a) => a.key === k)?.label ?? k)
    .slice(0, 20);

  const system = `Eres el redactor del blog de un hotel independiente en México. Escribes artículos útiles para viajeros, en español de México, que posicionan al hotel en Google y en los buscadores de IA.

REGLAS DE FORMATO (obligatorias):
- Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, con esta forma exacta:
  {"titulo": "...", "excerpt": "...", "contenido": "..."}
- "titulo": máximo 65 caracteres, atractivo y con la palabra clave del tema.
- "excerpt": 1 o 2 frases (máximo 155 caracteres) que resumen el artículo; será la meta description.
- "contenido": el artículo en markdown MÍNIMO: párrafos separados por línea en blanco, subtítulos con "## ", listas con "- ", negritas con **texto**. NADA de HTML, links, tablas ni imágenes. Entre 500 y 800 palabras.

REGLAS DE CONTENIDO:
- HONESTIDAD: usa SOLO los datos del hotel que te doy; no inventes precios, horarios, distancias exactas ni servicios. Para datos del destino usa conocimiento general prudente (sin cifras precisas que puedan estar mal).
- El artículo ayuda al viajero primero; el hotel se menciona con naturalidad 1 o 2 veces (por ejemplo al cerrar, invitando a hospedarse), sin sonar a anuncio.
- Estructura: intro corta, 3 a 5 secciones con "## ", y un cierre breve.`;

  const user = `Hotel: ${hotel.nombre}
Ubicación: ${hotel.ubicacion || "no especificada"}
Descripción del hotel: ${hotel.descripcion || "no especificada"}
Servicios del hotel: ${amenidades.length ? amenidades.join(", ") : "no especificados"}

Tema del artículo: ${tema}
Notas del hotelero (lo que quiere que incluya): ${notas || "ninguna"}

Escribe el artículo.`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: user },
        // Prefill: obliga a que la respuesta sea el JSON directo.
        { role: "assistant", content: '{"titulo":' },
      ],
    });
    const crudo =
      '{"titulo":' +
      msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
    let data: { titulo?: string; excerpt?: string; contenido?: string };
    try {
      data = JSON.parse(crudo.slice(0, crudo.lastIndexOf("}") + 1));
    } catch {
      return NextResponse.json(
        { error: "La IA devolvió un formato inesperado. Intenta de nuevo." },
        { status: 502 }
      );
    }
    const titulo = String(data.titulo ?? "").trim();
    const contenido = String(data.contenido ?? "").trim();
    if (!titulo || !contenido) {
      return NextResponse.json(
        { error: "La IA devolvió un artículo vacío. Intenta de nuevo." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      titulo,
      slug: slugificarPost(titulo),
      excerpt: String(data.excerpt ?? "").trim().slice(0, 200),
      contenido,
    });
  } catch (e) {
    console.error("[blog-post] error de IA:", e);
    return NextResponse.json(
      { error: "No se pudo escribir el artículo. Intenta de nuevo." },
      { status: 502 }
    );
  }
}
