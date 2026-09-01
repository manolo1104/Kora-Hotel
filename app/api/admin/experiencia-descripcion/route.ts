import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { leerCuerpo, zTextoCorto } from "@/lib/api/cuerpo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Genera la descripción de UNA experiencia vendible (tour, traslado, cena, spa)
// con IA, para que el hotelero la venda dentro de su motor. Autenticado por
// tenant (igual que /api/admin/room-description). Devuelve { texto }.

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 300;

const CATEGORIAS: Record<string, string> = {
  tour: "un tour o excursión",
  traslado: "un traslado o transporte",
  gastronomia: "una experiencia gastronómica (cena, cata, desayuno especial)",
  spa: "una experiencia de spa o bienestar",
  otro: "una experiencia o servicio",
};

const DESC_SCHEMA = z.object({
  nombre: zTextoCorto,
  categoria: z.string().trim().max(40).default("otro"),
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:editar");
  if (no) return no;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "La IA no está configurada (falta ANTHROPIC_API_KEY)." }, { status: 503 });
  }

  const c = await leerCuerpo(req, DESC_SCHEMA);
  if (!c.ok) {
    return NextResponse.json({ error: "Ponle primero un nombre a la experiencia." }, { status: 400 });
  }
  const nombre = c.datos.nombre;
  const categoriaDesc = CATEGORIAS[c.datos.categoria] ?? CATEGORIAS.otro;

  const system = `Eres copywriter de hoteles boutique en México. Escribes la descripción de UNA experiencia vendible (no del hotel ni de una habitación) que el huésped puede AGREGAR a su reserva, en español de México. Entre 30 y 55 palabras, en un solo párrafo, con un tono cálido que invite a vivirla y ayude a decidir agregarla. HONESTIDAD: usa SOLO el nombre y el tipo que te den; NO inventes precios, horarios, duración, incluidos, distancias ni lugares específicos. Sin emojis, sin comillas, sin encabezados: devuelve únicamente el texto.`;
  const user = `Hotel: ${ctx.hotel.nombre || "el hotel"}
Experiencia: ${nombre}
Tipo: ${categoriaDesc}

Escribe la descripción de esta experiencia para venderla dentro del motor de reservas.`;

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
    console.error("[experiencia-descripcion] error de IA:", e);
    return NextResponse.json({ error: "No se pudo generar la descripción. Intenta de nuevo." }, { status: 502 });
  }
}
