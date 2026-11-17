// Las herramientas de Camila: FUENTE ÚNICA.
//
// Antes había dos copias escritas a mano —ésta para la vista previa del panel y
// otra en `agentes/camila/brain.js` para el bot vivo— y ya no decían lo mismo.
// Ahora el servidor las manda dentro del conocimiento (`/api/agent`) y el runtime
// las usa tal cual; su copia local sólo queda como respaldo si el servidor es
// viejo.
//
// Las personas van SIEMPRE igual en las dos herramientas: `adultos` + `ninos`.
// Antes `huespedes` era "total de personas" al cotizar y "adultos" al cobrar, con
// defaults distintos (2 y 1): se cotizaba una ocupación y se cobraba otra.

export interface HerramientaBot {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

const PERSONAS = {
  adultos: {
    type: "integer",
    description: "Cuántos adultos. Si el huésped no lo ha dicho, pregúntaselo; si solo dice 'somos 2', son 2 adultos.",
  },
  ninos: {
    type: "integer",
    description: "Cuántos niños (menores de edad). 0 si no viajan niños.",
  },
};

export const HERRAMIENTA_DISPONIBILIDAD: HerramientaBot = {
  name: "checar_disponibilidad",
  description:
    "Consulta la disponibilidad REAL y el precio total para unas fechas y un número de personas. " +
    "Úsala SIEMPRE antes de dar un precio o decir que hay lugar. Devuelve, por tipo de cuarto: " +
    "si caben, total de la estancia, anticipo, cuántos quedan y el link de reserva ya armado. " +
    "También avisa si las fechas piden un mínimo de noches o si el grupo no cabe en un cuarto.",
  input_schema: {
    type: "object",
    properties: {
      checkin: { type: "string", description: "Llegada, formato AAAA-MM-DD" },
      checkout: { type: "string", description: "Salida, formato AAAA-MM-DD" },
      ...PERSONAS,
      codigo: {
        type: "string",
        description: "Código de descuento que dio el huésped, si dio uno. Se valida y se aplica al total.",
      },
    },
    required: ["checkin", "checkout", "adultos"],
  },
};

export const HERRAMIENTA_RESERVAR: HerramientaBot = {
  name: "reservar",
  description:
    "Aparta el cuarto y genera el LINK DE PAGO para que el huésped pague el anticipo con tarjeta. " +
    "Úsala cuando el huésped ya eligió cuarto y fechas y te dio su nombre completo y su correo. " +
    "Su teléfono ya lo tienes (escribe por WhatsApp): no se lo pidas. " +
    "Si devuelve ok:false, trae un código de error que debes explicarle al huésped.",
  input_schema: {
    type: "object",
    properties: {
      cuarto: {
        type: "string",
        description: "id del tipo de cuarto tal como lo devolvió checar_disponibilidad (o su nombre exacto)",
      },
      checkin: { type: "string", description: "Llegada AAAA-MM-DD" },
      checkout: { type: "string", description: "Salida AAAA-MM-DD" },
      unidades: { type: "integer", description: "Cuántos cuartos de ese tipo (1 si no dice otra cosa)" },
      ...PERSONAS,
      nombre: { type: "string", description: "Nombre completo del huésped" },
      email: { type: "string", description: "Correo del huésped" },
      idioma: {
        type: "string",
        enum: ["es", "en"],
        description: "Idioma en el que está escribiendo el huésped (para la página de pago y el correo)",
      },
    },
    required: ["cuarto", "checkin", "checkout", "adultos", "nombre", "email"],
  },
};

export const HERRAMIENTA_PASAR_A_PERSONA: HerramientaBot = {
  name: "pasar_a_persona",
  description:
    "Avisa por WhatsApp a una persona del hotel para que atienda ESTE chat, y te quita de la conversación " +
    "hasta que esa persona conteste. Úsala cuando: el huésped ya está hospedado y tiene un problema o queja; " +
    "manda o quiere mandar un comprobante de pago; es un grupo grande o un caso especial; pide hablar con alguien; " +
    "o no puedes resolver su duda con los datos del hotel. Después de usarla, dile al huésped que ya avisaste " +
    "y que una persona le contesta por aquí.",
  input_schema: {
    type: "object",
    properties: {
      motivo: {
        type: "string",
        enum: ["problema-hospedado", "comprobante-pago", "grupo", "pide-persona", "sin-respuesta", "otro"],
        description: "Por qué necesita a una persona",
      },
      resumen: {
        type: "string",
        description:
          "Lo que la persona del hotel necesita saber para atenderlo sin volver a preguntar: quién es, qué necesita, fechas, cuarto, etc. En español, 1 a 3 frases.",
      },
    },
    required: ["motivo", "resumen"],
  },
};

/** Las herramientas que se le dan al modelo. */
export const BOT_TOOLS: HerramientaBot[] = [
  HERRAMIENTA_DISPONIBILIDAD,
  HERRAMIENTA_RESERVAR,
  HERRAMIENTA_PASAR_A_PERSONA,
];

/** Lee los argumentos de personas de cualquier versión del esquema (antes: `huespedes`). */
export function personasDeArgs(args: Record<string, unknown>): { adultos: number; ninos: number } {
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : NaN);
  const a = num(args.adultos ?? args.huespedes);
  const n = num(args.ninos);
  return {
    adultos: Number.isFinite(a) && a >= 1 ? Math.min(a, 40) : 2,
    ninos: Number.isFinite(n) && n >= 0 ? Math.min(n, 40) : 0,
  };
}
