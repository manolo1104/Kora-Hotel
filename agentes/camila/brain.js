// brain.js — el cerebro de Camila. GENÉRICO: el mismo código sirve a cualquier
// hotel de Kora. Todo lo específico entra por (a) el contexto del sistema que se
// arma con el conocimiento del hotel y (b) las herramientas, que llaman a
// /api/agent con el token del hotel. Camila nunca inventa: precios, fechas y
// cobro salen SIEMPRE de las herramientas.

import Anthropic from "@anthropic-ai/sdk";
import { conLinkDePago, seCorto } from "./enlace.js";
import { opcionesModelo, maxTokensModelo, MODELO_CAMILA_DEFAULT } from "./modelo.js";
import { bloqueTurno, telefonoDelChat } from "./turno.js";

const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

// Sonnet 5 por defecto: balance de inteligencia/costo para un bot de VENTAS que
// razona fechas, disponibilidad y cierra reservas. Override con CAMILA_MODEL —
// es cambiar una variable de entorno, no el código. Los parámetros de cada
// modelo salen de `modelo.js` (tabla explícita, la misma que usa el panel): la
// regex de exclusión que había no conocía a Sonnet 5.5, que da 400 con
// `thinking: disabled`, y cambiar el modelo habría callado a Camila.
const MODEL = process.env.CAMILA_MODEL || MODELO_CAMILA_DEFAULT;
const OPCIONES_MODELO = opcionesModelo(MODEL);
const MAX_TOKENS = Number(process.env.CAMILA_MAX_TOKENS || maxTokensModelo(MODEL));
// Cuántos TURNOS del huésped se recuerdan. Antes `CAMILA_MAX_HISTORY=20` contaba
// MENSAJES aunque su comentario decía "pares de turnos": cada vuelta de
// herramienta gasta dos, así que el nombre y el correo que el huésped dio cinco
// mensajes atrás ya se habían caído cuando Camila iba a reservar.
const MAX_TURNOS = Number(process.env.CAMILA_MAX_TURNOS || 12);
const MAX_TOOL_ITERS = 6; // tope de vueltas de herramientas por turno

// Respaldo de las herramientas. Las buenas llegan del servidor en el
// conocimiento (`knowledge.tools`, fuente única en lib/bot/herramientas.ts): así
// el panel y WhatsApp usan exactamente las mismas. Esta copia sólo se usa si el
// servidor es una versión vieja que todavía no las manda.
const HERRAMIENTAS_RESPALDO = [
  {
    name: "checar_disponibilidad",
    description:
      "Consulta la disponibilidad REAL y el precio total para unas fechas y un número de personas. " +
      "Úsala SIEMPRE antes de dar un precio o decir que hay lugar.",
    input_schema: {
      type: "object",
      properties: {
        checkin: { type: "string", description: "Llegada, formato AAAA-MM-DD" },
        checkout: { type: "string", description: "Salida, formato AAAA-MM-DD" },
        adultos: { type: "integer", description: "Cuántos adultos" },
        ninos: { type: "integer", description: "Cuántos niños (0 si no viajan niños)" },
        codigo: { type: "string", description: "Código de descuento, si el huésped dio uno" },
      },
      required: ["checkin", "checkout", "adultos"],
    },
  },
  {
    name: "reservar",
    description:
      "Aparta el cuarto y genera el LINK DE PAGO. Úsala cuando el huésped eligió cuarto y fechas y te dio " +
      "su nombre completo y su correo. Su teléfono ya lo tienes: no se lo pidas.",
    input_schema: {
      type: "object",
      properties: {
        cuarto: { type: "string", description: "id del tipo de cuarto que devolvió checar_disponibilidad" },
        checkin: { type: "string", description: "Llegada AAAA-MM-DD" },
        checkout: { type: "string", description: "Salida AAAA-MM-DD" },
        unidades: { type: "integer", description: "Cuántos cuartos de ese tipo (1 si no dice otra cosa)" },
        adultos: { type: "integer", description: "Cuántos adultos" },
        ninos: { type: "integer", description: "Cuántos niños" },
        codigo: { type: "string", description: "Código de descuento, si lo hay" },
        nombre: { type: "string", description: "Nombre completo del huésped" },
        email: { type: "string", description: "Correo del huésped" },
        idioma: { type: "string", enum: ["es", "en"], description: "Idioma del huésped" },
      },
      required: ["cuarto", "checkin", "checkout", "adultos", "nombre", "email"],
    },
  },
  {
    name: "pasar_a_persona",
    description:
      "Avisa por WhatsApp a una persona del hotel para que atienda este chat. Úsala con huéspedes hospedados " +
      "con un problema, comprobantes de pago, grupos grandes, si piden a una persona o si no puedes resolver.",
    input_schema: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          enum: ["problema-hospedado", "comprobante-pago", "grupo", "pide-persona", "sin-respuesta", "otro"],
        },
        resumen: { type: "string", description: "Lo que la persona necesita saber, 1 a 3 frases" },
      },
      required: ["motivo", "resumen"],
    },
  },
];

/** ¿El huésped escribe en inglés? Sólo para los mensajes fijos (el modelo ya contesta en su idioma). */
function pareceIngles(texto) {
  const t = ` ${String(texto || "").toLowerCase()} `;
  const en = (t.match(/\b(the|you|have|do|room|how|much|what|please|thanks|hi|hello|we|for|is|are|can)\b/g) || []).length;
  const es = (t.match(/\b(el|la|los|las|que|de|para|hola|cuánto|cuanto|tienen|por|gracias|somos|una|un)\b/g) || []).length;
  return en > es;
}

const FIJOS = {
  sinSistema: {
    es: "Perdón, ahorita no puedo consultar el sistema del hotel. ¿Me escribes de nuevo en unos minutos?",
    en: "Sorry, I can't reach the hotel's system right now. Could you write again in a few minutes?",
  },
  sinRespuesta: {
    es: "Perdón, no te entendí bien. ¿Me lo repites con otras palabras?",
    en: "Sorry, I didn't quite get that. Could you say it another way?",
  },
  avisado: {
    es: "Le pasé tu mensaje a una persona del hotel; te contesta por aquí en cuanto pueda.",
    en: "I've passed your message to someone at the hotel; they'll reply here as soon as they can.",
  },
};
const fijo = (clave, textoHuesped) => FIJOS[clave][pareceIngles(textoHuesped) ? "en" : "es"];

/**
 * Lo que se le dice al huésped cuando Kora no responde. Corto y verdadero.
 *
 * Antes le daba el WhatsApp "del hotel": es el MISMO número al que Camila está
 * vinculada. El huésped escribía ahí y le volvía a contestar ella, sin sistema.
 */
function mensajeEscalada(_hotel, textoHuesped) {
  return fijo("sinSistema", textoHuesped);
}

// Ejecuta una herramienta pedida por el modelo contra /api/agent.
async function correrHerramienta(kora, conv, name, input) {
  try {
    if (name === "checar_disponibilidad") {
      // ANTES sólo viajaban las fechas: el número de personas se perdía aquí y el
      // servidor cotizaba siempre para 2, mientras el link de pago cobraba a los
      // reales. La vista previa del panel sí lo mandaba, por eso nadie lo veía.
      return await kora.availability(input.checkin, input.checkout, {
        conv,
        adultos: input.adultos ?? input.huespedes,
        ninos: input.ninos,
        codigo: input.codigo,
      });
    }
    if (name === "reservar") {
      return await kora.reservar(
        {
          cuarto: input.cuarto,
          checkin: input.checkin,
          checkout: input.checkout,
          unidades: input.unidades,
          adultos: input.adultos ?? input.huespedes,
          // Nombre viejo, para un servidor que todavía no conozca `adultos`.
          huespedes: input.adultos ?? input.huespedes,
          ninos: input.ninos,
          codigo: input.codigo,
          nombre: input.nombre,
          email: input.email,
          // El teléfono es el del chat: el huésped ya escribe por WhatsApp.
          telefono: input.telefono || telefonoDelChat(conv) || undefined,
          idioma: input.idioma === "en" ? "en" : input.idioma === "es" ? "es" : undefined,
        },
        { conv },
      );
    }
    if (name === "pasar_a_persona") {
      return await kora.escalar(conv, { motivo: input.motivo, resumen: input.resumen });
    }
    return { error: "herramienta-desconocida" };
  } catch (e) {
    // La herramienta falló (red/servidor). El modelo lo maneja con gracia.
    return { ok: false, error: "servicio-no-disponible", detalle: String(e && e.message) };
  }
}

/**
 * Quita los bloques de razonamiento (`thinking`) del historial guardado.
 *
 * Los modelos que piensan (Sonnet 5.5, Opus 5.5…) atan cada bloque de
 * razonamiento a la conversación exacta que lo produjo: si después cambia algo
 * de lo anterior —el prompt del hotel que se refresca, la fecha de AHORA, el
 * recorte del historial— el siguiente mensaje se rechaza con un 400. Camila
 * cambia esas tres cosas a propósito. Guardar el historial SIN razonamiento
 * (texto y herramientas sí) es la forma permitida: dentro de un mismo turno los
 * bloques van y vuelven intactos; entre turnos ya no hacen falta.
 */
function sinPensamientos(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) {
      out.push(m);
      continue;
    }
    const content = m.content.filter((b) => b && b.type !== "thinking" && b.type !== "redacted_thinking");
    if (content.length) out.push({ ...m, content });
  }
  return out;
}

/**
 * Procesa un turno de conversación. `history` es el arreglo de mensajes
 * (formato Anthropic) que se mantiene POR CHAT en index.js.
 *
 * @returns {Promise<{ reply: string, history: any[], escalada?: { avisarA: string|null, aviso: string, pausadoHasta: string } }>}
 */
export async function handleTurn({ hotel, kora, history, userText, conv, huesped }) {
  // Sin cerebro no hay conversación (K-287, K-185): ante un fallo NO se arma un
  // prompt hueco con el que Camila inventaría el hotel.
  let knowledge;
  try {
    knowledge = await kora.knowledge({ conv });
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) {
      // El token murió o la cuenta está bloqueada. Silencio limpio.
      console.warn(`[${hotel.slug}] sin cerebro (${e.status}): no contesto.`);
      return { reply: "", history };
    }
    console.error(`[${hotel.slug}] no pude leer el cerebro:`, e && e.message);
    return { reply: mensajeEscalada(hotel, userText), history };
  }

  const system =
    typeof knowledge.systemPrompt === "string" && knowledge.systemPrompt.trim()
      ? knowledge.systemPrompt
      : null;
  if (!system) {
    console.error(`[${hotel.slug}] /api/agent no mandó systemPrompt.`);
    return { reply: mensajeEscalada(hotel, userText), history };
  }
  const herramientas = Array.isArray(knowledge.tools) && knowledge.tools.length ? knowledge.tools : HERRAMIENTAS_RESPALDO;

  // El bloque que cambia en cada mensaje: la fecha de AHORA y quién escribe. Se
  // calcula UNA vez por turno (las vueltas de herramienta del mismo turno deben
  // ver el mismo system). Va después del cerebro cacheado: dentro de él la fecha
  // se quedaba vieja hasta 15 minutos, y a medianoche "hoy" era ayer.
  const turno = [bloqueTurno({ conv }), typeof huesped === "string" ? huesped.trim() : ""].filter(Boolean).join("\n\n");

  const inicio = sinPensamientos(Array.isArray(history) ? history : []);
  const messages = [...inicio, { role: "user", content: userText }];
  // La URL de pago de ESTE turno, si la herramienta `reservar` llegó a crearla.
  let urlDePago = "";
  let escalada;

  // Si algo sale mal a medio turno, el huésped NO se queda sin respuesta, y el
  // historial no se ensucia con una respuesta rota (un `tool_use` sin su
  // resultado haría fallar todos los mensajes siguientes de ese chat).
  const cerrarConFijo = async (clave, motivoEscalar) => {
    let reply = fijo(clave, userText);
    if (motivoEscalar) {
      const r = await correrHerramienta(kora, conv, "pasar_a_persona", {
        motivo: "sin-respuesta",
        resumen: `${motivoEscalar} El huésped escribió: "${String(userText).slice(0, 300)}"`,
      });
      if (r && r.ok) {
        escalada = { avisarA: r.avisarA ?? null, aviso: r.aviso ?? "", pausadoHasta: r.pausadoHasta };
        reply = fijo("avisado", userText);
      }
    }
    return {
      reply,
      history: recortarHistorial([...inicio, { role: "user", content: userText }, { role: "assistant", content: reply }]),
      escalada,
    };
  };

  for (let i = 0; i < MAX_TOOL_ITERS; i++) {
    let res;
    try {
      res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // CACHÉ DEL PROMPT (K-71): el cerebro del hotel es idéntico en todos los
        // mensajes y en cada vuelta de herramienta. El segundo bloque cambia en
        // cada mensaje (fecha, quién escribe) y por eso va fuera de la caché.
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
          ...(turno ? [{ type: "text", text: turno }] : []),
        ],
        tools: herramientas,
        messages,
        ...OPCIONES_MODELO,
      });
    } catch (e) {
      // Antes este error salía de `handleTurn` sin manejar: el huésped se quedaba
      // sin respuesta y nadie se enteraba más que el log.
      console.error(`[${hotel.slug}] Anthropic falló:`, e && (e.status || ""), e && e.message);
      return cerrarConFijo("sinRespuesta");
    }

    // Una negativa del modelo, o un `tool_use` cortado por el tope de tokens, NO
    // entran al historial: romperían la conversación. Se pasa con una persona.
    const ultimo = Array.isArray(res.content) ? res.content[res.content.length - 1] : null;
    if (res.stop_reason === "refusal") {
      console.warn(`[${hotel.slug}] el modelo se negó a contestar (${res.stop_details?.category ?? "sin categoría"})`);
      return cerrarConFijo("sinRespuesta", "Camila no pudo contestar este mensaje.");
    }
    if (res.stop_reason === "max_tokens" && ultimo && ultimo.type === "tool_use") {
      console.error(`[${hotel.slug}] una llamada a herramienta se cortó por el tope de ${MAX_TOKENS} tokens`);
      return cerrarConFijo("sinRespuesta");
    }

    // Guarda el turno del asistente (bloques crudos: texto + tool_use, y el
    // razonamiento, que dentro del mismo turno debe volver intacto).
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "tool_use") {
      const toolUses = res.content.filter((b) => b.type === "tool_use");
      const results = [];
      for (const tu of toolUses) {
        const out = await correrHerramienta(kora, conv, tu.name, tu.input || {});
        // El link de pago se guarda AQUÍ, tal como salió de Stripe. A partir de
        // este punto el modelo ya no es responsable de transportarlo.
        if (tu.name === "reservar" && out && out.ok && typeof out.url === "string") {
          urlDePago = out.url;
        }
        // La escalada la ejecuta index.js (tiene el WhatsApp): aquí sólo se anota.
        if (tu.name === "pasar_a_persona" && out && out.ok) {
          escalada = { avisarA: out.avisarA ?? null, aviso: out.aviso ?? "", pausadoHasta: out.pausadoHasta };
        }
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          // Al modelo no se le enseña el texto del aviso al hotelero (ni el número).
          content: JSON.stringify(
            tu.name === "pasar_a_persona" && out ? { ok: Boolean(out.ok), error: out.error } : out,
          ),
        });
      }
      messages.push({ role: "user", content: results });
      continue; // vuelve a llamar al modelo con los resultados
    }

    // Turno terminado: junta el texto para mandarlo a WhatsApp.
    const crudo = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Una respuesta cortada por el tope de tokens se mandaba tal cual, a medias.
    if (seCorto(res.stop_reason)) {
      console.error(
        `[${hotel.slug}] la respuesta se cortó por el tope de ${MAX_TOKENS} tokens` +
          (urlDePago ? " (el link de pago se pega aparte, va entero)" : ""),
      );
    }
    if (!crudo && !urlDePago) return cerrarConFijo("sinRespuesta");

    // El link NO lo transporta el modelo: se le quita del texto lo que haya
    // copiado —bien o mal— y se pega el bueno.
    const reply = conLinkDePago(crudo, urlDePago);

    return { reply, history: recortarHistorial(sinPensamientos(messages)), escalada };
  }

  // Se agotaron las vueltas de herramientas sin respuesta final. Antes se
  // contestaba «dame un momento y te escribo», y nada volvía a escribir. Ahora
  // se pasa con una persona de verdad (y sólo entonces se dice).
  return cerrarConFijo("sinRespuesta", "Camila se atoró consultando (demasiadas vueltas de herramientas).");
}

// Mantiene el historial acotado por TURNOS del huésped. Recorta por el frente
// pero SIN dejar un tool_result huérfano al inicio (rompería la siguiente
// llamada): siempre arranca en un mensaje de texto del huésped.
function recortarHistorial(messages) {
  const esTextoHuesped = (m) =>
    m.role === "user" && !(Array.isArray(m.content) && m.content.some((b) => b && b.type === "tool_result"));
  const indices = [];
  messages.forEach((m, i) => {
    if (esTextoHuesped(m)) indices.push(i);
  });
  if (indices.length <= MAX_TURNOS) return messages;
  return messages.slice(indices[indices.length - MAX_TURNOS]);
}

export const __pruebas = { sinPensamientos, recortarHistorial, pareceIngles };
