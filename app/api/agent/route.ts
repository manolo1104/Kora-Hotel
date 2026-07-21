// API del BOT WhatsApp por hotel (multi-tenant). Un bot externo (whatsapp-web.js
// en Railway, un número por hotel) consulta aquí con el TOKEN del hotel para
// responder a los huéspedes con datos reales: conocimiento del hotel y
// disponibilidad. El token identifica al hotel (config.agent_token); sin token
// válido → 401. NO requiere sesión de usuario (lo llama un servidor, no un navegador).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAgentActivity, setBotStatus, logCamilaConversacion } from "@/lib/db/admin";
import type { TurnoConversacion } from "@/lib/db/admin";
import { accesoDelHotel } from "@/lib/suscripcion";
import { crearLinkReservaAgente } from "@/lib/agent-booking";
import { buildBotSystemPrompt } from "@/lib/bot/prompt";
import { buildHotelKnowledge } from "@/lib/bot/knowledge";
import { botAvailability } from "@/lib/bot/tools";
import type { HotelRow } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function hotelPorToken(token: string): Promise<HotelRow | null> {
  if (!token) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hoteles")
    .select(
      "id, owner_id, slug, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos, guia, extras, config, prefijo_confirmacion, stripe_account_id, publicado, created_at",
    )
    .eq("config->>agent_token", token)
    .maybeSingle();
  return (data as HotelRow) ?? null;
}

export async function POST(req: Request) {
  let body: {
    token?: string;
    action?: string;
    checkin?: string;
    checkout?: string;
    conv?: string; // id de la conversación (teléfono/chat) para métricas sin doble conteo
    // Campos de la acción "reservar" (el bot cierra la reserva):
    cuarto?: string | number; // id del tipo o su nombre
    unidades?: number; // cuántas unidades del tipo
    huespedes?: number; // adultos
    ninos?: number; // menores
    nombre?: string;
    email?: string;
    telefono?: string;
    lang?: "es" | "en";
    enabled?: boolean; // acción "set-status" (encender/apagar desde el runtime)
    turnos?: TurnoConversacion[]; // acción "log-conv": mensajes del hilo a guardar
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const hotel = await hotelPorToken(body.token ?? "");
  if (!hotel) return NextResponse.json({ error: "token-invalido" }, { status: 401 });

  const cfg = (hotel.config ?? {}) as Record<string, unknown>;

  // Estado del bot (on/off) para el chequeo EN VIVO del runtime. El runtime lo
  // cachea ~45s y, si está apagado, deja de responder aunque siga conectado.
  // También devuelve el número admin autorizado para el comando por WhatsApp.
  // No cuenta como conversación (no toca métricas).
  if (body.action === "status") {
    return NextResponse.json({
      ok: true,
      enabled: cfg.bot_enabled !== false,
      adminPhone: typeof cfg.bot_admin_phone === "string" ? cfg.bot_admin_phone : null,
    });
  }

  // Encender/apagar el bot desde el runtime (comando "apagar"/"encender" que el
  // número admin manda por WhatsApp). Escribe el mismo config.bot_enabled que el
  // toggle del panel, así el apagado en vivo también calla a los huéspedes.
  if (body.action === "set-status") {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "enabled-requerido" }, { status: 400 });
    }
    await setBotStatus(hotel.id, body.enabled);
    return NextResponse.json({ ok: true, enabled: body.enabled });
  }

  // Guardar el texto de un turno de conversación (huésped + Camila) para poder
  // analizarlo después. No cuenta como métrica (retorna antes de logAgentActivity).
  // FAIL-SAFE: si la tabla no existe o falla, no afecta la respuesta al bot.
  if (body.action === "log-conv") {
    await logCamilaConversacion(hotel.id, body.conv ?? "", body.turnos ?? []);
    return NextResponse.json({ ok: true });
  }

  // Métricas del foso (dashboard "Agentes"): cada consulta del bot cuenta. Si
  // el bot manda `conv`, se dedupe por día → conversaciones reales; sin conv se
  // registra la consulta tal cual. Fail-safe: nunca afecta la respuesta al bot.
  const conv = typeof body.conv === "string" && body.conv.trim() ? body.conv.trim().slice(0, 80) : "";
  const accionDetalle =
    body.action === "availability" ? "availability" : body.action === "reservar" ? "reservar" : "knowledge";
  await logAgentActivity(
    hotel.id,
    "whatsapp_conv",
    conv ? `conv:${conv}` : accionDetalle,
    Boolean(conv),
  );

  if (body.action === "availability") {
    const { checkin, checkout } = body;
    if (!checkin || !checkout) {
      return NextResponse.json({ error: "fechas-requeridas" }, { status: 400 });
    }
    // Disponibilidad real (helper compartido con el chat de prueba del panel).
    return NextResponse.json(await botAvailability(hotel, checkin, checkout));
  }

  // Acción "reservar": el bot CIERRA la reserva. Apartamos el cuarto y devolvemos
  // un link de pago de Stripe (direct charge al hotel). El huésped paga en un tap
  // y el webhook existente crea la reserva atómica y manda los correos. La
  // maquinaria pesada (precio, disponibilidad, hold, reserva) se reusa entera; el
  // riesgo de sobreventa es el mismo del motor web (candado atómico).
  if (body.action === "reservar") {
    // Cerradas las puertas que el motor web ya cierra: hotel demo y motor pausado
    // (prueba vencida sin plan) no deben poder cobrar por API.
    if ((hotel.extras as { demo?: boolean } | null)?.demo === true) {
      return NextResponse.json({ ok: false, error: "hotel-demo" }, { status: 403 });
    }
    const acceso = await accesoDelHotel(hotel);
    if (!acceso.activo) {
      return NextResponse.json({ ok: false, error: "motor-pausado" }, { status: 403 });
    }

    const origin = new URL(req.url).origin;
    const resultado = await crearLinkReservaAgente(
      hotel,
      {
        cuarto: body.cuarto ?? null,
        checkin: body.checkin ?? "",
        checkout: body.checkout ?? "",
        unidades: body.unidades,
        huespedes: body.huespedes,
        ninos: body.ninos,
        nombre: body.nombre ?? null,
        email: body.email ?? null,
        telefono: body.telefono ?? null,
        lang: body.lang,
      },
      origin,
    );

    // Métrica del foso: link de pago generado por el bot (la reserva PAGADA se
    // cuenta aparte, por origen:"bot" en el donut de origen de reservas). Sin
    // dedupe: cada intento de reserva cuenta.
    if (resultado.ok) {
      await logAgentActivity(hotel.id, "whatsapp_reserva", resultado.habitacion, false);
    }

    // 200 con ok:false para los errores "de negocio" (fechas, disponibilidad,
    // datos): son respuestas normales que el bot traduce al huésped, no fallos.
    return NextResponse.json(resultado);
  }

  // Por defecto: conocimiento del hotel (para que el bot responda preguntas).
  // El `systemPrompt` (cerebro de Camila) se arma del lado servidor con los datos
  // REALES del hotel + su entrenamiento (extras.bot) — fuente única que consumen
  // el runtime de WhatsApp y el chat de prueba del panel.
  const knowledge = buildHotelKnowledge(hotel);
  return NextResponse.json({
    ...knowledge,
    linkReserva: `/h/${hotel.slug}/reservar`,
    systemPrompt: buildBotSystemPrompt(knowledge),
  });
}
