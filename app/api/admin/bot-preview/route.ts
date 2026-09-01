import { negar } from "@/lib/panel/permisos";
// Chat de PRUEBA de Camila dentro del panel (sin QR, sin WhatsApp). Corre el
// mismo cerebro (buildBotSystemPrompt + herramientas) del lado servidor, con los
// datos REALES del hotel de la cuenta activa. `checar_disponibilidad` es real
// (lectura); `reservar` está DESACTIVADA en modo prueba (no crea holds ni cobros).

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { buildBotSystemPrompt, BOT_TOOLS } from "@/lib/bot/prompt";
import { buildHotelKnowledge } from "@/lib/bot/knowledge";
import { botAvailability } from "@/lib/bot/tools";
import { accesoDelHotel } from "@/lib/suscripcion";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mismo modelo que el runtime de Camila (brain.js) para que el chat de prueba
// del panel refleje lo que reciben los huéspedes. Override con CAMILA_MODEL.
const MODEL = process.env.CAMILA_MODEL || "claude-sonnet-5";
const MAX_TOOL_ITERS = 6;
const MAX_CHARS_MENSAJE = 2000;

// Límite por HOTEL, no por IP: aquí ya hay sesión, así que se puede cobrar el
// gasto a quien lo genera. Sin esto, esta ruta era un grifo abierto de IA con
// sesión — pagado por Kora, sin tope de entrada y sin mirar si el hotel paga.
//
// En memoria del proceso, como el de `/api/agent-demo`: en Vercel Hobby sin
// Redis no hay nada mejor, y para un abuso desde el panel (una pestaña abierta
// en bucle) alcanza. Un limitador compartido de verdad es el paso 9.9 del plan.
const VENTANA_MS = 60 * 60_000; // 1 hora
const MAX_POR_VENTANA = 30;
const hits = new Map<string, number[]>();

function pasaDelTope(hotelId: string): boolean {
  const ahora = Date.now();
  const previos = (hits.get(hotelId) || []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  hits.set(hotelId, previos);
  return previos.length > MAX_POR_VENTANA;
}

/**
 * Parámetros de latencia, iguales a los del bot vivo (`brain.js`), para que el
 * chat de prueba refleje de verdad lo que recibe un huésped.
 *
 * ⚠️ En Claude Opus 5 NO se desactiva el pensamiento aunque lo admita: con
 * `thinking: disabled`, el modelo a veces escribe la llamada a la herramienta
 * como TEXTO en vez de emitir un bloque `tool_use`. El turno "sale bien", la
 * herramienta nunca corre y nadie ve un error — en un chat que consulta
 * disponibilidad real, eso es Camila inventando un precio. Con esfuerzo bajo se
 * consigue casi la misma latencia sin ese riesgo.
 */
function opcionesDeLatencia(model: string): Record<string, unknown> {
  const admiteEsfuerzo = !/haiku|claude-3|claude-2/.test(model);
  if (!admiteEsfuerzo) return {};
  const esOpus5 = /claude-opus-5/.test(model);
  return esOpus5
    ? { output_config: { effort: "low" } }
    : { thinking: { type: "disabled" }, output_config: { effort: "low" } };
}

// Sin tope, un mensaje de 200 KB pegado en el chat de prueba se cobra entero, y
// el historial completo viaja en CADA vuelta de herramienta del mismo turno.
const PREVIEW_SCHEMA = z.object({
  mensajes: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_CHARS_MENSAJE),
      }),
    )
    .max(60)
    .default([]),
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:leer");
  if (no) return no;

  // Un hotel con la prueba vencida o la cuenta bloqueada no tiene producto: se
  // le cerró la caja y se le calló a Camila en WhatsApp, pero este chat seguía
  // gastando IA de Kora sin mirar nada. `CamilaClient` pinta `motor-pausado`
  // como invitación a reactivar, no como un fallo.
  const acceso = await accesoDelHotel(ctx.hotel);
  if (!acceso.activo) {
    return NextResponse.json({ ok: false, error: "motor-pausado" }, { status: 403 });
  }

  if (pasaDelTope(ctx.hotelId)) {
    return NextResponse.json({ ok: false, error: "demasiadas-pruebas" }, { status: 429 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "sin-ia" }, { status: 503 });

  const c = await leerCuerpo(req, PREVIEW_SCHEMA);
  if (!c.ok) return c.respuesta;

  // Historial simple {role, content} → mensajes de Anthropic (solo texto). Los
  // topes (16 mensajes, MAX_CHARS_MENSAJE cada uno) los pone el esquema; aquí
  // sólo se descartan los vacíos, que Anthropic rechaza.
  const messages: Anthropic.MessageParam[] = c.datos.mensajes
    .filter((m) => m.content.trim().length > 0)
    .slice(-16);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "sin-mensaje" }, { status: 400 });
  }

  const knowledge = buildHotelKnowledge(ctx.hotel);
  const system = buildBotSystemPrompt(knowledge, { modoPrueba: true });
  const client = new Anthropic({ apiKey });

  try {
    for (let i = 0; i < MAX_TOOL_ITERS; i++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        // El prompt del hotel es IDÉNTICO entre turnos de una misma sesión de
        // prueba y entre vueltas de herramienta del mismo turno: cachearlo es
        // gratis y se paga solo desde el segundo mensaje.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: BOT_TOOLS as unknown as Anthropic.Tool[],
        messages,
        ...opcionesDeLatencia(MODEL),
      });
      messages.push({ role: "assistant", content: res.content });

      if (res.stop_reason === "tool_use") {
        const toolUses = res.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          let out: unknown;
          if (tu.name === "checar_disponibilidad") {
            const inp = (tu.input ?? {}) as { checkin?: string; checkout?: string };
            out = await botAvailability(ctx.hotel, inp.checkin ?? "", inp.checkout ?? "").catch(
              () => ({ error: "servicio-no-disponible" }),
            );
          } else if (tu.name === "reservar") {
            out = {
              ok: false,
              error: "modo-prueba",
              detalle: "En la versión en vivo, aquí Camila te mandaría el link de pago.",
            };
          } else {
            out = { error: "herramienta-desconocida" };
          }
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(out),
          });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return NextResponse.json({ ok: true, reply });
    }
    return NextResponse.json({ ok: true, reply: "Dame un momento, déjame confirmarlo. 🌿" });
  } catch (e) {
    console.error("bot-preview error:", e);
    return NextResponse.json({ ok: false, error: "ia-error" }, { status: 502 });
  }
}
