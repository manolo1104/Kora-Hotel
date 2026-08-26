import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { LIMITE_IA_MENSUAL, slugificarPost } from "@/lib/hotel-blog";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { AMENIDADES } from "@/lib/amenidades";
import type { MiniExtras } from "@/lib/mini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La generación investiga en internet antes de escribir: puede tardar 1-3 min.
export const maxDuration = 300;

// Escribe un artículo del BLOG DEL HOTEL con IA. El agente INVESTIGA de verdad
// (búsqueda web): qué hay cerca del hotel, datos del destino o del tema que el
// hotelero elija. Devuelve { titulo, slug, excerpt, contenido } en el markdown
// mínimo de lib/hotel-blog.ts; el hotelero SIEMPRE revisa, corrige y publica.
//
// Límite: LIMITE_IA_MENSUAL generaciones por hotel por mes natural, registradas
// en hotel_blog_ia_usos (solo escribe el service role). El costo real por
// artículo (claude-sonnet-5 + ~6 búsquedas a $10/1000) es de centavos de dólar;
// el límite acota el peor caso muy por debajo del tope de ~$2 por artículo.

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 12000; // el pensamiento adaptativo y las búsquedas también consumen de aquí
const MAX_BUSQUEDAS = 6;

const ENFOQUES: Record<string, string> = {
  cerca: "Qué hacer cerca del hotel: investiga lugares y actividades REALES alrededor de la ubicación del hotel (atracciones, caminatas, miradores) y descríbelos con lo que encuentres.",
  gastronomia: "Gastronomía local: platillos típicos de la región, dónde se comen, qué probar. Investiga la cocina real de la zona.",
  temporada: "Eventos y temporadas: festividades, clima por época del año y cuándo conviene visitar. Investiga fechas y eventos reales del destino.",
  consejos: "Consejos prácticos de viaje: cómo llegar, qué empacar, cuánto tiempo quedarse, errores comunes. Investiga rutas y datos reales.",
  hotel: "Sobre el hotel y su experiencia: usa los datos del hotel como hilo central y complementa con contexto real del destino.",
  libre: "Tema libre: el tema que dio el hotelero manda; investiga lo necesario para tratarlo con datos reales.",
};

interface Cuota {
  usados: number;
  limite: number;
}

async function cuotaDelMes(hotelId: string): Promise<Cuota | null> {
  if (!adminEnvReady) return null;
  const admin = createAdminClient();
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);
  // GET (no HEAD): con HEAD, una tabla faltante no reporta error y el límite
  // se volvería infinito en silencio. Así, sin tabla -> error -> 503 visible.
  const { count, error } = await admin
    .from("hotel_blog_ia_usos")
    .select("id", { count: "exact" })
    .eq("hotel_id", hotelId)
    .gte("created_at", inicioMes.toISOString())
    .limit(1);
  if (error) {
    console.error("[blog-post] no se pudo leer la cuota (¿falta correr sql/kora-hotel-blog.sql?):", error.message);
    return null;
  }
  return { usados: count ?? 0, limite: LIMITE_IA_MENSUAL };
}

// GET: cuántos artículos con IA le quedan al hotel este mes (para el panel).
export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:leer");
  if (no) return no;
  const cuota = await cuotaDelMes(ctx.hotelId);
  if (!cuota) return NextResponse.json({ error: "Configuración incompleta." }, { status: 503 });
  return NextResponse.json(cuota);
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:editar");
  if (no) return no;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "La IA no está configurada (falta ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  const cuota = await cuotaDelMes(ctx.hotelId);
  if (!cuota) {
    return NextResponse.json({ error: "Configuración incompleta." }, { status: 503 });
  }
  if (cuota.usados >= cuota.limite) {
    return NextResponse.json(
      {
        error: `Ya usaste tus ${cuota.limite} artículos con IA de este mes. El próximo mes se renuevan; mientras, puedes escribir artículos a mano sin límite.`,
        ...cuota,
      },
      { status: 429 }
    );
  }

  let body: { tema?: string; notas?: string; enfoque?: string };
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
  const enfoque = ENFOQUES[String(body.enfoque ?? "")] ?? ENFOQUES.libre;

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

INVESTIGACIÓN (obligatoria):
- Tienes búsqueda web. Úsala para investigar la zona donde está el hotel y el tema del artículo: qué hay cerca, distancias aproximadas, temporadas, datos del destino. Escribe con lo que ENCUENTRES, no de memoria.
- HONESTIDAD: sobre el hotel usa SOLO los datos que te doy (no inventes precios, horarios ni servicios del hotel). Sobre el destino, prefiere lo verificado en tu investigación; si un dato es dudoso (un precio de entrada, un horario), da el rango u omítelo en vez de inventarlo. El hotelero revisará y corregirá antes de publicar.

FORMATO del campo "contenido": markdown MÍNIMO — párrafos separados por línea en blanco, subtítulos con "## ", listas con "- ", negritas con **texto**. NADA de HTML, links, tablas ni imágenes (las fotos las agrega el hotelero). Entre 600 y 900 palabras.

CONTENIDO: el artículo ayuda al viajero primero; el hotel se menciona con naturalidad 1 o 2 veces (por ejemplo al cerrar, invitando a hospedarse), sin sonar a anuncio. Estructura: intro corta, 3 a 5 secciones con "## ", cierre breve.
- "titulo": máximo 65 caracteres, atractivo, con la palabra clave del tema.
- "excerpt": 1 o 2 frases (máximo 155 caracteres); será la meta description.`;

  const user = `Hotel: ${hotel.nombre}
Ubicación: ${hotel.ubicacion || "no especificada"}
Descripción del hotel: ${hotel.descripcion || "no especificada"}
Servicios del hotel: ${amenidades.length ? amenidades.join(", ") : "no especificados"}

Enfoque elegido por el hotelero: ${enfoque}
Tema del artículo: ${tema}
Notas del hotelero (lo que quiere que incluya): ${notas || "ninguna"}

Investiga lo necesario y escribe el artículo.`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const params = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }],
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: MAX_BUSQUEDAS },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              excerpt: { type: "string" },
              contenido: { type: "string" },
            },
            required: ["titulo", "excerpt", "contenido"],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: "user" as const, content: user }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    let msg = await anthropic.messages.create(params);
    // Con herramientas del servidor, el turno puede pausarse (pause_turn):
    // se reenvía la conversación y el servidor retoma donde iba.
    let reintentos = 0;
    while (msg.stop_reason === "pause_turn" && reintentos < 3) {
      reintentos += 1;
      msg = await anthropic.messages.create({
        ...params,
        messages: [
          { role: "user", content: user },
          { role: "assistant", content: msg.content },
        ],
      });
    }

    // El JSON final viene en el último bloque de texto (los bloques de búsqueda
    // web van intercalados antes).
    const textos = msg.content.filter(
      (b: { type: string }): b is Anthropic.TextBlock => b.type === "text"
    );
    const crudo = textos.length ? textos[textos.length - 1].text : "";
    let data: { titulo?: string; excerpt?: string; contenido?: string };
    try {
      data = JSON.parse(crudo);
    } catch {
      return NextResponse.json(
        { error: "La IA devolvió un formato inesperado. Intenta de nuevo (no se gastó tu artículo del mes)." },
        { status: 502 }
      );
    }
    const titulo = String(data.titulo ?? "").trim();
    const contenido = String(data.contenido ?? "").trim();
    if (!titulo || !contenido) {
      return NextResponse.json(
        { error: "La IA devolvió un artículo vacío. Intenta de nuevo (no se gastó tu artículo del mes)." },
        { status: 502 }
      );
    }

    // Solo una generación exitosa consume cuota.
    const admin = createAdminClient();
    const { error: usoErr } = await admin
      .from("hotel_blog_ia_usos")
      .insert({ hotel_id: ctx.hotelId });
    if (usoErr) console.error("[blog-post] no se registró el uso de IA:", usoErr.message);

    return NextResponse.json({
      titulo,
      slug: slugificarPost(titulo),
      excerpt: String(data.excerpt ?? "").trim().slice(0, 200),
      contenido,
      usados: cuota.usados + 1,
      limite: cuota.limite,
    });
  } catch (e) {
    console.error("[blog-post] error de IA:", e);
    return NextResponse.json(
      { error: "No se pudo escribir el artículo. Intenta de nuevo (no se gastó tu artículo del mes)." },
      { status: 502 }
    );
  }
}
