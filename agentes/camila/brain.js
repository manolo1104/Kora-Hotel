// brain.js — el cerebro de Camila. GENÉRICO: el mismo código sirve a cualquier
// hotel de Kora. Todo lo específico entra por (a) el contexto del sistema que se
// arma con el conocimiento del hotel y (b) las herramientas, que llaman a
// /api/agent con el token del hotel. Camila nunca inventa: precios, fechas y
// cobro salen SIEMPRE de las herramientas.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

// Opus 4.8 por defecto (la instrucción del SDK). Para un bot de chat de alto
// volumen, CAMILA_MODEL=claude-sonnet-5 (o claude-haiku-4-5) baja mucho el costo
// y la latencia — es cambiar una variable de entorno, no el código.
const MODEL = process.env.CAMILA_MODEL || "claude-opus-4-8";
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

// Arma el contexto del sistema con el conocimiento real del hotel. Genérico:
// cualquier hotel se describe con los mismos campos que da /api/agent.
function buildSystemPrompt(hotel, k) {
  const habs = Array.isArray(k.habitaciones) ? k.habitaciones : [];
  const amen = Array.isArray(k.amenidades) ? k.amenidades : [];
  const faqs = Array.isArray(k.faqs) ? k.faqs : [];
  const pol = k.politicas && typeof k.politicas === "object" ? k.politicas : {};
  const guia = k.guia && typeof k.guia === "object" ? k.guia : {};

  const cuartos = habs.length
    ? habs
        .map(
          (r) =>
            `- ${r.nombre} (hasta ${r.maxHuespedes} huéspedes) — desde ${r.desdeTexto || `$${r.desde}`} MXN/noche. ${r.descripcion || ""}`.trim(),
        )
        .join("\n")
    : "(sin cuartos configurados)";

  const faqsTxt = faqs
    .map((f) => (f && f.q ? `P: ${f.q}\nR: ${f.a || ""}` : ""))
    .filter(Boolean)
    .join("\n\n");

  return `Eres Camila, la asistente de reservas por WhatsApp del hotel "${k.nombre || hotel.nombre}".
Hoy es ${hoyMexico()} (hora de México).

TU META: contestar al instante, resolver dudas y CERRAR reservas con link de pago.

TONO Y FORMATO
- Cálida, humana y breve. Escribes para WhatsApp: frases cortas, saltos de línea, emojis con mesura.
- Responde en el idioma del huésped (por defecto español).
- Formato WhatsApp: *negritas* con un solo asterisco. Nada de tablas ni markdown pesado.
- Responde SOLO con el mensaje para el huésped. No expliques tu razonamiento ni tus pasos.

REGLAS DE ORO (no romper)
- NUNCA inventes precios, disponibilidad ni políticas. Los precios "desde" de abajo son orientativos; el total real SIEMPRE sale de la herramienta checar_disponibilidad.
- Para cerrar una reserva necesitas: fechas de llegada y salida, tipo de cuarto, número de huéspedes, y datos del huésped (nombre completo, email y teléfono). Si falta algo, pídelo con naturalidad antes de reservar.
- Cuando "reservar" devuelva ok:true, manda el link de pago (campo url) TAL CUAL, y resume en pocas líneas: cuarto, fechas, total, anticipo a pagar ahora y resto al llegar. Aclara que al pagar recibe su confirmación automática por correo.
- Si "reservar" devuelve ok:false, traduce el error al huésped con amabilidad:
  · min-noches → esas fechas piden mínimo N noches.
  · no-disponible / capacidad-insuficiente → ya no hay ese cuarto para esas fechas; ofrece otro tipo u otras fechas.
  · datos-incompletos → pide el dato que falta.
  · sin-pago / stripe-error → ofrece coordinar el pago directo con el hotel.
- No prometas nada que la herramienta no confirme. Para grupos grandes o casos raros que no puedas resolver, ofrece pasar con una persona del hotel${k.whatsapp ? ` (WhatsApp ${k.whatsapp})` : ""}.

DATOS DEL HOTEL
Ubicación: ${k.ubicacion || "—"}
${k.descripcion ? `Sobre el hotel: ${k.descripcion}` : ""}

CUARTOS
${cuartos}

${amen.length ? `AMENIDADES\n${amen.join(", ")}\n` : ""}${
    Object.keys(pol).length
      ? `POLÍTICAS\n${Object.entries(pol)
          .map(([kk, vv]) => `- ${kk}: ${vv}`)
          .join("\n")}\n`
      : ""
  }${faqsTxt ? `PREGUNTAS FRECUENTES\n${faqsTxt}\n` : ""}${
    Object.keys(guia).length
      ? `GUÍA / RECOMENDACIONES\n${Object.entries(guia)
          .map(([kk, vv]) => `- ${kk}: ${typeof vv === "string" ? vv : JSON.stringify(vv)}`)
          .join("\n")}`
      : ""
  }`.trim();
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
  const knowledge = await kora.knowledge({ conv }).catch(() => ({ nombre: hotel.nombre }));
  // El prompt lo arma el SERVIDOR (fuente única, con el entrenamiento del hotel).
  // Fallback al build local si un Kora viejo aún no manda `systemPrompt`.
  const system =
    typeof knowledge.systemPrompt === "string" && knowledge.systemPrompt.trim()
      ? knowledge.systemPrompt
      : buildSystemPrompt(hotel, knowledge);

  const messages = [...history, { role: "user", content: userText }];

  for (let i = 0; i < MAX_TOOL_ITERS; i++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "disabled" }, // chat: prioriza latencia
      output_config: { effort: "low" },
      system,
      tools: HERRAMIENTAS,
      messages,
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
