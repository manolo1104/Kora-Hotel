import { negar } from "@/lib/panel/permisos";
// Chat de PRUEBA de Camila dentro del panel (sin QR, sin WhatsApp). Corre el
// mismo cerebro (buildBotSystemPrompt + herramientas) del lado servidor, con los
// datos REALES del hotel de la cuenta activa. `checar_disponibilidad` es real
// (lectura); `reservar` está DESACTIVADA en modo prueba (no crea holds ni cobros).

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { buildBotSystemPrompt } from "@/lib/bot/prompt";
import { BOT_TOOLS, personasDeArgs } from "@/lib/bot/herramientas";
import { opcionesModelo, maxTokensModelo, MODELO_CAMILA_DEFAULT } from "@/lib/bot/modelo";
import { bloqueTurno } from "@/lib/bot/turno";
import { getConnectState } from "@/lib/stripe/connect";
import { buildHotelKnowledge } from "@/lib/bot/knowledge";
import { botAvailability } from "@/lib/bot/tools";
import { accesoDelHotel, puedeUsarCamila } from "@/lib/suscripcion";
import { leerSaldo, sinSaldo } from "@/lib/db/saldo";
import { bloqueoEncendido } from "@/lib/saldo/fases";
import { cobrarMensaje } from "@/lib/saldo/cobro";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { z } from "zod";
import { limitado } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mismo modelo que el runtime de Camila (brain.js) para que el chat de prueba
// del panel refleje lo que reciben los huéspedes. Override con CAMILA_MODEL.
const MODEL = process.env.CAMILA_MODEL || MODELO_CAMILA_DEFAULT;
const MAX_TOOL_ITERS = 6;
const MAX_CHARS_MENSAJE = 2000;

// Límite por HOTEL, no por IP: aquí ya hay sesión, así que se puede cobrar el
// gasto a quien lo genera. Sin esto, esta ruta era un grifo abierto de IA con
// sesión — pagado por Kora, sin tope de entrada y sin mirar si el hotel paga.
//
// Contaba en la memoria del proceso «porque en Vercel Hobby sin Redis no hay
// nada mejor». Ya lo hay: desde el paso 9.9 el contador vive en Postgres y lo
// comparten todas las instancias. La clave y el tope son los mismos de antes —
// por HOTEL, no por IP, para que el equipo entero comparta la cuota.
const VENTANA_MS = 60 * 60_000; // 1 hora
const MAX_POR_VENTANA = 30;

// Los parámetros del modelo salen de `lib/bot/modelo.ts`, la misma tabla que usa
// el bot vivo (`agentes/camila/modelo.js`): así el chat de prueba refleja de
// verdad lo que recibe un huésped, y cambiar CAMILA_MODEL no rompe ninguno.

/** Lo que Camila hizo en el turno, para que el panel lo enseñe como chips. */
type Accion = "disponibilidad" | "link-pago" | "persona";

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

  // Desde el 2 oct 2026 Camila se abre al PAGAR: en la prueba gratis el hotel
  // tiene el panel, no el bot. `CamilaClient` pinta `sin-pago` como invitación
  // a activar el plan. Quien se registró antes del corte conserva su prueba.
  if (!puedeUsarCamila(acceso, ctx.hotel)) {
    return NextResponse.json({ ok: false, error: "sin-pago" }, { status: 403 });
  }

  // Las respuestas del chat de prueba gastan saldo igual que las de WhatsApp
  // (los 100 de regalo son «de prueba o reales»). Con el corte encendido, sin
  // saldo no se contesta — la misma regla que aplica /api/agent, y con el mismo
  // fallo abierto: si el saldo no se puede leer, `sinSaldo` dice que no.
  if ((await bloqueoEncendido()) && sinSaldo(await leerSaldo(ctx.hotel.id))) {
    return NextResponse.json({ ok: false, error: "sin-saldo" }, { status: 402 });
  }

  // El chat de prueba llama a Anthropic con TODO el cerebro del hotel en el
  // system, y vuelve a llamar por cada herramienta que pide el modelo.
  if (await limitado("admin.botPreview", ctx.hotelId, { max: MAX_POR_VENTANA, ventanaMs: VENTANA_MS })) {
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

  let pagos: { enLinea: boolean; oxxo: boolean } = { enLinea: true, oxxo: false };
  try {
    const cs = await getConnectState(ctx.hotel.id, ctx.hotel.stripe_account_id);
    pagos = { enLinea: Boolean(cs.chargesEnabled && cs.accountId), oxxo: Boolean(cs.chargesEnabled && cs.oxxoEnabled) };
  } catch {
    /* se queda en "tarjeta sí, OXXO no" */
  }
  const knowledge = buildHotelKnowledge(ctx.hotel, { pagos });
  const system = buildBotSystemPrompt(knowledge, { modoPrueba: true });
  const client = new Anthropic({ apiKey });
  const acciones: Accion[] = [];

  try {
    for (let i = 0; i < MAX_TOOL_ITERS; i++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokensModelo(MODEL),
        // El prompt del hotel es IDÉNTICO entre turnos de una misma sesión de
        // prueba y entre vueltas de herramienta del mismo turno: cachearlo es
        // gratis y se paga solo desde el segundo mensaje.
        // El segundo bloque es la fecha de AHORA: cambia en cada mensaje y por
        // eso va fuera de la caché (el bot vivo hace lo mismo).
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
          { type: "text", text: bloqueTurno() },
        ],
        tools: BOT_TOOLS as unknown as Anthropic.Tool[],
        messages,
        ...(opcionesModelo(MODEL) as object),
      });
      messages.push({ role: "assistant", content: res.content });

      if (res.stop_reason === "tool_use") {
        const toolUses = res.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          let out: unknown;
          const inp = (tu.input ?? {}) as Record<string, unknown>;
          if (tu.name === "checar_disponibilidad") {
            // Las personas viajan hasta el precio: en un hotel con tarifas por
            // número de personas, el total de 2 no es el de 5.
            acciones.push("disponibilidad");
            out = await botAvailability(ctx.hotel, String(inp.checkin ?? ""), String(inp.checkout ?? ""), {
              ...personasDeArgs(inp),
              codigo: typeof inp.codigo === "string" ? inp.codigo : null,
            }).catch(() => ({ error: "servicio-no-disponible" }));
          } else if (tu.name === "reservar") {
            acciones.push("link-pago");
            out = {
              ok: false,
              error: "modo-prueba",
              detalle: "En la versión en vivo, aquí Camila mandaría el link de pago.",
            };
          } else if (tu.name === "pasar_a_persona") {
            acciones.push("persona");
            out = {
              ok: false,
              error: "modo-prueba",
              detalle: "En la versión en vivo, aquí Camila avisaría por WhatsApp a una persona del hotel.",
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

      const texto = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      // Una negativa del modelo o una respuesta vacía no se pinta como silencio:
      // el hotelero tiene que ver que ahí pasó algo.
      const reply =
        texto ||
        (res.stop_reason === "refusal"
          ? "(El modelo no quiso contestar este mensaje. En vivo, aquí avisaría a una persona del hotel.)"
          : "(Sin respuesta.)");
      // Se cobra DESPUÉS de tener la respuesta y sólo si la hay, como en
      // WhatsApp. Con `await`: en Vercel la función se congela al responder.
      // `cobrarMensaje` nunca lanza. Sin `ref`: cada respuesta de prueba es una.
      if (reply) await cobrarMensaje(ctx.hotel, "");
      return NextResponse.json({ ok: true, reply, acciones: [...new Set(acciones)] });
    }
    return NextResponse.json({
      ok: true,
      reply: "(Se me complicó contestar esto. En vivo, aquí avisaría a una persona del hotel.)",
      acciones: [...new Set(acciones)],
    });
  } catch (e) {
    console.error("bot-preview error:", e);
    return NextResponse.json({ ok: false, error: "ia-error" }, { status: 502 });
  }
}
