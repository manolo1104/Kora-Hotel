// brain.js — el cerebro de Camila. GENÉRICO: el mismo código sirve a cualquier
// hotel de Kora. Todo lo específico entra por (a) el contexto del sistema que se
// arma con el conocimiento del hotel y (b) las herramientas, que llaman a
// /api/agent con el token del hotel. Camila nunca inventa: precios, fechas y
// cobro salen SIEMPRE de las herramientas.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

// Sonnet 5 por defecto: balance de inteligencia/costo para un bot de VENTAS que
// razona fechas, disponibilidad y cierra reservas (Haiku se quedaba corto).
// Override con CAMILA_MODEL (claude-haiku-4-5 para bajar costo, claude-opus-4-8
// para máxima capacidad) — es cambiar una variable de entorno, no el código.
const MODEL = process.env.CAMILA_MODEL || "claude-sonnet-5";

// Qué parámetros de latencia admite el modelo. Es una lista de EXCLUSIÓN a
// propósito: con la lista de inclusión que había, cada modelo nuevo quedaba
// fuera sin que nadie se enterara — `claude-opus-5` ya lo estaba, y con él el
// bot razonaba en cada mensaje (más lento y más caro) sin que nadie lo pidiera.
const MODELO_CON_EFFORT = !/haiku|claude-3|claude-2/.test(MODEL);

// Dónde NO se puede (o no se debe) pedir `thinking: { type: "disabled" }`:
//
//  - `claude-fable-5` y `claude-mythos-5`: el pensamiento está SIEMPRE encendido
//    y cualquier configuración explícita se rechaza con un 400. Mandarlo dejaría
//    al bot mudo en cuanto alguien cambiara CAMILA_MODEL.
//  - `claude-opus-5`: lo acepta, pero con el pensamiento apagado a veces escribe
//    la llamada a la herramienta como TEXTO en vez de emitir un bloque
//    `tool_use`. El turno parece salir bien, la herramienta nunca corre y no hay
//    error en ninguna parte: en un bot que consulta disponibilidad real, eso es
//    Camila inventándole un precio a un huésped.
//
// En los dos casos basta con el esfuerzo bajo, que da casi la misma latencia.
const SIN_PENSAR_ES_SEGURO =
  MODELO_CON_EFFORT && !/claude-(opus-5|fable|mythos)/.test(MODEL);
const MAX_TOKENS = Number(process.env.CAMILA_MAX_TOKENS || 1024);
const MAX_HISTORY = Number(process.env.CAMILA_MAX_HISTORY || 20); // pares de turnos
const MAX_TOOL_ITERS = 6; // tope de vueltas de herramientas por turno

const HERRAMIENTAS = [
  {
    name: "checar_disponibilidad",
    description:
      "Consulta la disponibilidad REAL y el precio total del hotel para unas fechas. " +
      "Úsala siempre antes de dar un precio o confirmar que hay lugar. Devuelve los " +
      "tipos de cuarto disponibles con su id, nombre, capacidad y total de la estancia.",
    input_schema: {
      type: "object",
      properties: {
        checkin: { type: "string", description: "Fecha de llegada, formato YYYY-MM-DD" },
        checkout: { type: "string", description: "Fecha de salida, formato YYYY-MM-DD" },
        huespedes: {
          type: "number",
          description:
            "Cuántas personas se van a quedar. Mándalo siempre que lo sepas: el total cambia con el número de personas y es el mismo que cobrará el link de pago. Si aún no lo sabes, omítelo (se asume 2) y pregúntaselo antes de cerrar.",
        },
      },
      required: ["checkin", "checkout"],
    },
  },
  {
    name: "reservar",
    description:
      "Cierra la reserva: aparta el cuarto y genera un LINK de pago (Stripe) para " +
      "mandarle al huésped. Úsala solo cuando ya tengas fechas, tipo de cuarto, número " +
      "de huéspedes y los datos del huésped (nombre completo, email y teléfono). Si " +
      "devuelve ok:false, trae un código de error que debes traducir al huésped.",
    input_schema: {
      type: "object",
      properties: {
        cuarto: {
          type: "string",
          description:
            "id del tipo de cuarto (preferido, tal como lo devuelve checar_disponibilidad) o su nombre exacto",
        },
        checkin: { type: "string", description: "Llegada YYYY-MM-DD" },
        checkout: { type: "string", description: "Salida YYYY-MM-DD" },
        unidades: { type: "integer", description: "Cuántas unidades de ese tipo (default 1)" },
        huespedes: { type: "integer", description: "Adultos (default 1)" },
        ninos: { type: "integer", description: "Menores (default 0)" },
        nombre: { type: "string", description: "Nombre completo del huésped" },
        email: { type: "string", description: "Email del huésped" },
        telefono: { type: "string", description: "Teléfono del huésped" },
      },
      required: ["cuarto", "checkin", "checkout", "nombre", "email", "telefono"],
    },
  },
];

function hoyMexico() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

// El prompt lo arma SIEMPRE el servidor (`buildBotSystemPrompt`, fuente única
// con el entrenamiento del hotel). Aquí vivía una copia local de respaldo, y
// se borró a propósito: era la única razón por la que Camila tenía algo que
// decir cuando NO conseguía el cerebro del hotel — conversaba con un prompt
// hueco, inventando un hotel que no conocía. Mientras esa copia existiera,
// cualquier arreglo del `catch` se podía deshacer sin darse cuenta. Además no
// llevaba los delimitadores del paso 6.14, así que era un segundo prompt sin
// endurecer conviviendo con el bueno.

/**
 * Lo que se le dice al huésped cuando Kora no responde. Corto y verdadero: no
 * promete nada y le da una salida humana si el hotel tiene WhatsApp.
 */
function mensajeEscalada(hotel) {
  const tel = (hotel && hotel.whatsapp ? String(hotel.whatsapp) : "").trim();
  return tel
    ? `Perdón, ahorita no puedo consultar el sistema. Escríbele al hotel al ${tel} y te atienden enseguida.`
    : "Perdón, ahorita no puedo consultar el sistema. ¿Me escribes en unos minutos?";
}

// Ejecuta una herramienta pedida por el modelo contra /api/agent.
async function correrHerramienta(kora, conv, name, input) {
  try {
    if (name === "checar_disponibilidad") {
      return await kora.availability(input.checkin, input.checkout, { conv });
    }
    if (name === "reservar") {
      return await kora.reservar(
        {
          cuarto: input.cuarto,
          checkin: input.checkin,
          checkout: input.checkout,
          unidades: input.unidades,
          huespedes: input.huespedes,
          ninos: input.ninos,
          nombre: input.nombre,
          email: input.email,
          telefono: input.telefono,
        },
        { conv },
      );
    }
    return { error: "herramienta-desconocida" };
  } catch (e) {
    // La herramienta falló (red/servidor). El modelo lo maneja con gracia.
    return { ok: false, error: "servicio-no-disponible", detalle: String(e && e.message) };
  }
}

/**
 * Procesa un turno de conversación. `history` es el arreglo de mensajes
 * (formato Anthropic) que se mantiene POR CHAT en index.js.
 *
 * @returns {Promise<{ reply: string, history: any[] }>}
 */
export async function handleTurn({ hotel, kora, history, userText, conv }) {
  // Sin cerebro no hay conversación (K-287, K-185). Antes esto era un
  // `.catch(() => ({ nombre: hotel.nombre }))`: ante CUALQUIER fallo se armaba un
  // prompt hueco y Camila seguía hablando, inventando el hotel.
  let knowledge;
  try {
    knowledge = await kora.knowledge({ conv });
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) {
      // El token murió o la cuenta está bloqueada. Silencio limpio: `procesar()`
      // no manda nada cuando `reply` viene vacío.
      console.warn(`[${hotel.slug}] sin cerebro (${e.status}): no contesto.`);
      return { reply: "", history };
    }
    // Red o 5xx: es transitorio, así que se le dice al huésped algo verdadero en
    // vez de callarse o de inventarle datos.
    console.error(`[${hotel.slug}] no pude leer el cerebro:`, e && e.message);
    return { reply: mensajeEscalada(hotel), history };
  }

  const system =
    typeof knowledge.systemPrompt === "string" && knowledge.systemPrompt.trim()
      ? knowledge.systemPrompt
      : null;
  if (!system) {
    // El servidor contestó pero sin prompt. No hay con qué conversar.
    console.error(`[${hotel.slug}] /api/agent no mandó systemPrompt.`);
    return { reply: mensajeEscalada(hotel), history };
  }

  const messages = [...history, { role: "user", content: userText }];

  for (let i = 0; i < MAX_TOOL_ITERS; i++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // CACHÉ DEL PROMPT (K-71). Éste era el ÚNICO sitio del repo que no la
      // usaba, y es el que más la necesita: el system del hotel es idéntico en
      // todos los mensajes de una conversación Y en cada vuelta de herramienta
      // del mismo turno. Con 50 conversaciones al día de 6 mensajes, se estaba
      // reenviando el mismo prompt unas 600 veces diarias POR HOTEL.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: HERRAMIENTAS,
      messages,
      // Chat: prioriza latencia. En Haiku 4.5 y anteriores estos parámetros no
      // existen (dan 400) y se omiten: esos modelos ya responden sin pensar.
      ...(MODELO_CON_EFFORT ? { output_config: { effort: "low" } } : {}),
      ...(SIN_PENSAR_ES_SEGURO ? { thinking: { type: "disabled" } } : {}),
    });

    // Guarda el turno del asistente (bloques crudos: texto + tool_use).
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "tool_use") {
      const toolUses = res.content.filter((b) => b.type === "tool_use");
      const results = [];
      for (const tu of toolUses) {
        const out = await correrHerramienta(kora, conv, tu.name, tu.input || {});
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(out),
        });
      }
      messages.push({ role: "user", content: results });
      continue; // vuelve a llamar al modelo con los resultados
    }

    // Turno terminado: junta el texto para mandarlo a WhatsApp.
    const reply = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return { reply, history: recortarHistorial(messages) };
  }

  // Se agotaron las vueltas de herramientas sin respuesta final.
  return {
    reply: "Dame un momento, déjame confirmarlo y te escribo. 🌿",
    history: recortarHistorial(messages),
  };
}

// Mantiene el historial acotado (ahorra tokens). Recorta por el frente pero
// SIN dejar un tool_result huérfano al inicio (rompería la siguiente llamada).
function recortarHistorial(messages) {
  if (messages.length <= MAX_HISTORY) return messages;
  let start = messages.length - MAX_HISTORY;
  while (start < messages.length) {
    const m = messages[start];
    const esToolResult =
      Array.isArray(m.content) && m.content.some((b) => b && b.type === "tool_result");
    if (m.role === "user" && !esToolResult) break; // arranca limpio en un user normal
    start++;
  }
  return start >= messages.length ? messages.slice(-2) : messages.slice(start);
}
