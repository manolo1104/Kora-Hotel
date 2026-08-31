import Anthropic from "@anthropic-ai/sdk";
import { rateLimited } from "@/lib/api/rate-limit";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { escribirMejorEsfuerzo } from "@/lib/db/result";
import { buildSystemPrompt, MARCADOR_ESCALAR } from "@/lib/soporte/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Chat de soporte de Kora (mismo patrón que /api/herramientas/generar):
// haiku + rate limit por IP + tope de entrada. El system prompt va con caché
// porque es largo y se repite en cada turno.

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 500;
const MAX_INPUT_CHARS = 1500;
const MAX_TURNOS = 12; // turnos de historial que aceptamos del cliente

interface Turno {
  rol: "user" | "assistant";
  texto: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "El chat aún no está configurado. Escríbenos por WhatsApp." },
      { status: 503 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (rateLimited("soporte", ip, { max: 8, ventanaMs: 60_000 })) {
    return NextResponse.json(
      { error: "Vas muy rápido. Espera un minuto e inténtalo de nuevo." },
      { status: 429 }
    );
  }

  let body: { mensajes?: Turno[]; sessionId?: string; pagina?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Validar y acotar el historial que manda el widget.
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
    return NextResponse.json({ error: "Escribe tu pregunta." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: turnos.map((t) => ({
        role: t.rol === "user" ? ("user" as const) : ("assistant" as const),
        content: t.texto,
      })),
    });

    let texto = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const escalar = texto.includes(MARCADOR_ESCALAR);
    if (escalar) texto = texto.replaceAll(MARCADOR_ESCALAR, "").trim();

    // Guardar la conversación (best-effort, no bloquea la respuesta).
    //
    // El id lo genera el SERVIDOR. Antes venía del navegador con el formato
    // `s_<fecha>_<8 al azar>`: repetir o adivinar el de otra persona PISABA su
    // conversación entera, incluidas las escaladas. Un uuid v4 no se adivina, y
    // cualquier cosa que no lo sea se descarta y se sustituye por uno nuevo —
    // así una sesión vieja no se cae, sólo empieza un hilo limpio.
    const propuesto = typeof body.sessionId === "string" ? body.sessionId : "";
    const sessionId = UUID_V4.test(propuesto) ? propuesto : randomUUID();
    if (adminEnvReady && sessionId) {
      const admin = createAdminClient();
      const ts = new Date().toISOString();
      const mensajes = [
        ...turnos.map((t) => ({ rol: t.rol, texto: t.texto })),
        { rol: "assistant", texto, ts },
      ];
      // CON await. Sin él, en Vercel la función responde y se congela antes de
      // que la escritura llegue a Supabase: la conversación se perdía a veces, y
      // las escaladas —el mecanismo por el que un visitante atascado llega a
      // Manolo— con ella. Mejor-esfuerzo declarado: si falla, la respuesta al
      // visitante sale igual.
      await escribirMejorEsfuerzo(
        "soporte.conversacion",
        admin.from("soporte_conversaciones").upsert(
          {
            session_id: sessionId,
            pagina: typeof body.pagina === "string" ? body.pagina.slice(0, 200) : null,
            mensajes,
            escalado: escalar,
          },
          { onConflict: "session_id" },
        ),
      );
    }

    // `sessionId` viaja de vuelta para que el navegador use EL DEL SERVIDOR.
    return NextResponse.json({ texto, escalar, sessionId });
  } catch (e) {
    console.error("Error en el chat de soporte:", e);
    return NextResponse.json(
      { error: "No pudimos responder. Inténtalo de nuevo en un momento." },
      { status: 500 }
    );
  }
}
