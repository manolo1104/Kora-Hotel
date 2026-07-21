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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mismo modelo que el runtime de Camila (brain.js) para que el chat de prueba
// del panel refleje lo que reciben los huéspedes. Override con CAMILA_MODEL.
const MODEL = process.env.CAMILA_MODEL || "claude-sonnet-5";
const MAX_TOOL_ITERS = 6;

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "sin-ia" }, { status: 503 });

  let body: { mensajes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  // Historial simple {role, content} → mensajes de Anthropic (solo texto).
  const historial = Array.isArray(body.mensajes) ? body.mensajes : [];
  const messages: Anthropic.MessageParam[] = historial
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" ||
          (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string" &&
        (m as { content: string }).content.trim().length > 0,
    )
    .slice(-16)
    .map((m) => ({ role: m.role, content: m.content }));

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
        system,
        tools: BOT_TOOLS as unknown as Anthropic.Tool[],
        messages,
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
