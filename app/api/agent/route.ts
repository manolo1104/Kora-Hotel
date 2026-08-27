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
import { hotelIdPorBotToken } from "@/lib/db/bot-token";
import { leer } from "@/lib/db/result";
import { crearLinkReservaAgente } from "@/lib/agent-booking";
import { buildBotSystemPrompt } from "@/lib/bot/prompt";
import { buildHotelKnowledge } from "@/lib/bot/knowledge";
import { botAvailability } from "@/lib/bot/tools";
import type { HotelRow } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Las acciones que APAGAN el bot o TOCAN inventario y dinero. */
const ACCIONES_PROTEGIDAS = new Set(["set-status", "reservar"]);

// El token ya no se busca dentro de `hoteles.config` —esa columna se puede leer
// desde internet con la llave anónima— sino en `hotel_bot_tokens`, que sólo ve la
// service-role. Son dos consultas en vez de una: token → hotel_id → hotel.
async function hotelPorToken(token: string): Promise<HotelRow | null> {
  if (!token) return null;
  const hotelId = await hotelIdPorBotToken(token);
  if (!hotelId) return null;
  const supabase = createAdminClient();
  return await leer<HotelRow>(
    "hotel.porBotToken",
    supabase
      .from("hoteles")
      .select(
        "id, owner_id, slug, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos, guia, extras, config, prefijo_confirmacion, stripe_account_id, publicado, created_at",
      )
      .eq("id", hotelId)
      .maybeSingle(),
  );
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
  // Distinguir las dos cosas es lo que evita que Camila se apague sola: un fallo
  // de base de datos se le reportaba como "token-invalido", y el runtime concluía
  // que lo habían desautorizado. Un 503 lo hace reintentar; un 401 sigue siendo
  // un token que de verdad no existe.
  let hotel: HotelRow | null;
  try {
    hotel = await hotelPorToken(body.token ?? "");
  } catch (e) {
    console.error("[agent] no se pudo resolver el hotel del token:", e);
    return NextResponse.json({ error: "servicio-no-disponible" }, { status: 503 });
  }
  if (!hotel) return NextResponse.json({ error: "token-invalido" }, { status: 401 });

  // SEGUNDO FACTOR para lo que hace daño.
  //
  // El `agent_token` identifica al hotel y es una sola credencial. Si se filtra,
  // quien la tenga puede apagar a Camila (`set-status`) o generar links de pago
  // a nombre del hotel y bloquearle cuartos reales (`reservar`). Estas dos
  // acciones exigen además el secreto de plataforma, que vive en el RUNTIME de
  // Railway y no viaja con el token: así un token filtrado se queda de SÓLO
  // LECTURA — sirve para leer el cerebro del hotel, que ya es público en su
  // propio sitio, y para nada más.
  //
  // No es un rate limit (que es lo que proponía la auditoría): en Vercel Hobby,
  // sin Redis ni almacenamiento compartido, un contador en memoria es decorativo
  // porque cada petición puede caer en otra instancia. Este secreto YA existía y
  // YA estaba en Railway, así que no añade infraestructura.
  if (ACCIONES_PROTEGIDAS.has(body.action ?? "")) {
    const secreto = process.env.BOT_FLEET_SECRET ?? "";
    if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
      console.error(`[agent] ${body.action} sin secreto de flota (hotel ${hotel.slug})`);
      return NextResponse.json({ error: "no-autorizado" }, { status: 403 });
    }
  }

  const cfg = (hotel.config ?? {}) as Record<string, unknown>;

  // UNA SOLA PUERTA PARA TODAS LAS ACCIONES: cuenta bloqueada por Kora o prueba
  // vencida sin plan apagan a Camila entera, antes de nada. (El hotel
  // despublicado NO entra todavía: `accesoDelHotel` aún no mira `publicado`, y
  // eso es el paso 2.12.)
  //
  // Antes esta comprobación sólo la hacía la acción `reservar` (y el bloqueo
  // manual, aquí). O sea: a un hotel con la prueba vencida se le cerraba la caja
  // pero se le seguía dando el producto — Camila contestaba, cotizaba y gastaba
  // cuota de Anthropic. `/api/bots/fleet` ya saca a esos hoteles de la lista, así
  // que el runtime deja de arrancarlos; lo que quedaba abierto era la puerta de
  // atrás: `/api/agent` es pública y cualquiera con el token del hotel —el propio
  // hotelero, o quien se lo encuentre— podía seguir consultando indefinidamente.
  //
  // `status` es la excepción a propósito, y no es un hueco: es lo que el runtime
  // consulta en vivo cada ~45 s, y contestarle `enabled:false` lo calla de verdad
  // (`index.js` deja de responder aunque siga conectado a WhatsApp). Un 403 sería
  // PEOR: `kora.status()` es fail-open ante error y asumiría "encendido".
  //
  // `accesoDelHotel` falla ABIERTO si no puede leer la suscripción, y avisa por
  // correo: un hipo de Supabase no puede callar a la Camila de quien sí paga.
  const acceso = await accesoDelHotel(hotel);
  if (!acceso.activo) {
    if (body.action === "status") {
      return NextResponse.json({ ok: true, enabled: false, adminPhone: null });
    }
    const motivo = acceso.bloqueado ? "cuenta bloqueada por Kora" : "sin plan y prueba vencida";
    console.error(`[agent] ${body.action ?? "knowledge"} rechazado en ${hotel.slug}: ${motivo}`);
    return NextResponse.json(
      { ok: false, error: acceso.bloqueado ? "cuenta-bloqueada" : "motor-pausado" },
      { status: 403 },
    );
  }

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
    // `huespedes` viaja hasta el cálculo del precio: sin él se cotizaba a
    // ocupación máxima y el link de pago cobraba otra cosa.
    const huespedes = Math.max(1, Math.floor(Number(body.huespedes) || 2));
    return NextResponse.json(await botAvailability(hotel, checkin, checkout, huespedes));
  }

  // Acción "reservar": el bot CIERRA la reserva. Apartamos el cuarto y devolvemos
  // un link de pago de Stripe (direct charge al hotel). El huésped paga en un tap
  // y el webhook existente crea la reserva atómica y manda los correos. La
  // maquinaria pesada (precio, disponibilidad, hold, reserva) se reusa entera; el
  // riesgo de sobreventa es el mismo del motor web (candado atómico).
  if (body.action === "reservar") {
    // El motor pausado ya lo filtró la puerta de arriba (una sola comprobación
    // para todas las acciones). Aquí queda sólo lo que es propio de reservar: el
    // hotel de demostración nunca cobra, aunque su acceso sea eterno.
    if ((hotel.extras as { demo?: boolean } | null)?.demo === true) {
      return NextResponse.json({ ok: false, error: "hotel-demo" }, { status: 403 });
    }
    // Un hotel DESPUBLICADO puede seguir contestando por WhatsApp (su cerebro es
    // suyo), pero no puede cobrar: es lo mismo que ya hace el motor web.
    if (!acceso.puedeCobrar) {
      console.error(`[agent] reservar rechazado en ${hotel.slug}: hotel despublicado`);
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
