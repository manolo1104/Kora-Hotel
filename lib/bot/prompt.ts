// Cerebro de Camila (fuente ÚNICA del prompt). Lo arma el servidor a partir de
// los datos REALES del hotel + su entrenamiento (extras.bot), y lo consumen:
//   - el runtime de WhatsApp (agentes/camila/brain.js) vía /api/agent (campo systemPrompt)
//   - el chat de prueba del panel (/api/admin/bot-preview)
// Así, entrenar a Camila en el panel afecta al instante al bot vivo y al preview,
// y no hay dos prompts que se desincronicen.
//
// PRINCIPIO: Camila usa EXCLUSIVAMENTE la información de ESTE hotel. Nada global.

export interface BotRoom {
  nombre: string;
  descripcion?: string;
  desde?: number;
  desdeTexto?: string;
  maxHuespedes?: number | string;
  camas?: string[]; // ej. ["1 King", "2 Individual"]
  caracteristicas?: string[]; // amenidades de la habitación (etiquetas)
}

export interface BotFaq {
  q: string;
  a?: string;
}

/** Experiencia vendible (tour, traslado, cena, spa) que Camila puede ofrecer. */
export interface BotExperiencia {
  nombre: string;
  precio: number;
  precioTexto?: string;
  cobro: string; // estancia | noche | persona | unidad
  descripcion?: string;
  categoria?: string;
  dias?: number[]; // 0=Dom … 6=Sáb; ausente = todos los días
  horarios?: string[];
  cupoDia?: number; // lugares por día; ausente = sin límite
}

/** Add-on simple (desayuno, late checkout…) que Camila puede ofrecer. */
export interface BotAddon {
  nombre: string;
  precio: number;
  precioTexto?: string;
  tipo: string; // estancia | noche | persona
}

/** Reglas de reserva que el motor aplica y Camila debe poder EXPLICAR. */
export interface BotReglasReserva {
  anticipoPct?: number;
  anticipoMinNoches?: number;
  minNoches?: number;
  nrfActiva?: boolean;
  nrfPct?: number;
  cancelacionDias?: number;
  pagoEnHotel?: boolean;
  ishPct?: number;
}

/** Temporada de precios, para que Camila explique por qué cambia la tarifa. */
export interface BotTemporada {
  nombre: string;
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  ajuste: { tipo: "fijo" | "porcentaje"; valor: number };
  minNoches?: number;
}

/** Datos bancarios para pago por transferencia/depósito/OXXO (vive en extras.bot.pago). */
export interface BotPago {
  titular?: string; // beneficiario de la cuenta
  banco?: string; // nombre del banco
  clabe?: string; // CLABE interbancaria (18 dígitos)
  cuenta?: string; // número de cuenta o tarjeta (opcional)
  notas?: string; // instrucciones libres (OXXO, referencia, horarios, etc.)
}

/** Entrenamiento que el hotel edita en el panel (vive en extras.bot). */
export interface BotTraining {
  nombre?: string; // cómo se llama la asistente (default "Camila")
  tono?: string; // personalidad / estilo
  saludo?: string; // saludo de primer contacto
  instrucciones?: string; // instrucciones especiales del hotel
  escalarWhatsapp?: string; // número para pasar con una persona (default = whatsapp del hotel)
  pago?: BotPago; // datos para pago por transferencia/depósito
}

/** Todo lo que Camila "sabe" de un hotel — mismo shape que devuelve /api/agent. */
export interface BotKnowledge {
  nombre: string;
  ubicacion?: string | null;
  descripcion?: string | null;
  whatsapp?: string | null;
  habitaciones?: BotRoom[];
  amenidades?: string[];
  faqs?: BotFaq[];
  politicas?: Record<string, unknown>;
  guia?: Record<string, unknown>;
  experiencias?: BotExperiencia[];
  addons?: BotAddon[];
  experienciasBundle?: { min: number; pct: number };
  reglas?: BotReglasReserva;
  temporadas?: BotTemporada[];
  bot?: BotTraining | null;
  lang?: "es" | "en";
  slug?: string; // slug del hotel (para armar el link de reserva)
  reservaUrl?: string; // URL absoluta del motor de reservas (…/h/slug/reservar)
}

/**
 * Normaliza FAQs de cualquier origen a `{q, a}`.
 * FIX de honestidad: el panel guarda `{pregunta, respuesta}` pero el cerebro
 * espera `{q, a}` — sin esto, las FAQs reales del hotel nunca llegaban a Camila.
 */
export function normalizeFaqs(...lists: unknown[]): BotFaq[] {
  const out: BotFaq[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const f of list) {
      if (!f || typeof f !== "object") continue;
      const o = f as Record<string, unknown>;
      const q = String(o.q ?? o.pregunta ?? "").trim();
      const a = String(o.a ?? o.respuesta ?? "").trim();
      if (q) out.push({ q, a });
    }
  }
  return out;
}

// Nombres de día para agendas de experiencias (0=Dom … 6=Sáb, como en extras).
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Cómo se cobra un extra/experiencia, en lenguaje de huésped.
function cobroLabel(cobro: string): string {
  switch (cobro) {
    case "noche":
      return "por noche";
    case "persona":
      return "por persona";
    case "unidad":
      return "por boleto";
    default:
      return "por estancia";
  }
}

// Fecha ISO (YYYY-MM-DD) en zona de México — la que usan las herramientas.
function hoyMexicoISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}
// Fecha legible con día de la semana — para que Camila razone fechas relativas
// ("este viernes", "el finde") y valide que el día y el número coincidan.
function hoyMexicoHumano(): string {
  return new Date().toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Herramientas que Camila puede usar (contrato con /api/agent). Compartidas
 *  entre el runtime y el preview para que no se desincronicen. */
export const BOT_TOOLS = [
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
] as const;

/**
 * Arma el prompt de sistema de Camila para UN hotel, con su entrenamiento.
 * @param opts.modoPrueba  true para el chat de prueba del panel (reservar apagada).
 */
export function buildBotSystemPrompt(k: BotKnowledge, opts: { modoPrueba?: boolean } = {}): string {
  const bot = (k.bot ?? {}) as BotTraining;
  const nombre = (bot.nombre || "Camila").trim();
  const habs = Array.isArray(k.habitaciones) ? k.habitaciones : [];
  const amen = Array.isArray(k.amenidades) ? k.amenidades : [];
  const faqs = Array.isArray(k.faqs) ? k.faqs : [];
  const pol = k.politicas && typeof k.politicas === "object" ? k.politicas : {};
  const guia = k.guia && typeof k.guia === "object" ? k.guia : {};
  const escalar = (bot.escalarWhatsapp || k.whatsapp || "").trim();
  const idioma = k.lang === "en" ? "inglés" : "español";
  const exps = Array.isArray(k.experiencias) ? k.experiencias : [];
  const adds = Array.isArray(k.addons) ? k.addons : [];
  const reglas = k.reglas ?? {};
  const temporadas = Array.isArray(k.temporadas) ? k.temporadas : [];

  // EXPERIENCIAS Y EXTRAS — lo que el hotel vende además del cuarto. Camila
  // debe conocerlas para ofrecerlas (upsell); se pagan en el motor en línea.
  const expLineas = exps.map((e) => {
    const dias =
      Array.isArray(e.dias) && e.dias.length
        ? ` Días: ${e.dias.map((d) => DIAS_SEMANA[d] ?? "").filter(Boolean).join(", ")}.`
        : "";
    const hor = Array.isArray(e.horarios) && e.horarios.length ? ` Horarios: ${e.horarios.join(", ")}.` : "";
    const cupo = e.cupoDia ? ` Cupo limitado (${e.cupoDia} lugares por día).` : "";
    return `- ${e.nombre} — ${e.precioTexto || `$${e.precio} MXN`} ${cobroLabel(e.cobro)}.${dias}${hor}${cupo} ${e.descripcion || ""}`.trim();
  });
  const addLineas = adds.map(
    (a) => `- ${a.nombre} — ${a.precioTexto || `$${a.precio} MXN`} ${cobroLabel(a.tipo)}.`
  );
  const bundleTxt = k.experienciasBundle
    ? `- PAQUETE: si agrega ${k.experienciasBundle.min} o más experiencias distintas, todas sus experiencias tienen ${k.experienciasBundle.pct}% de descuento — úsalo para invitar a agregar otra.`
    : "";
  const experienciasBloque =
    expLineas.length || addLineas.length
      ? `\nEXPERIENCIAS Y EXTRAS (ofrécelas — venden la estancia completa)
${[...expLineas, ...addLineas].join("\n")}
${bundleTxt ? bundleTxt + "\n" : ""}- Cuando cotices o confirmes, menciona 1 o 2 que le queden al huésped (sin presionar).
- Se eligen y pagan en el link de reserva EN LÍNEA. El link de la herramienta "reservar" NO las incluye: si el huésped quiere agregar alguna, mándale mejor el link en línea con sus fechas (opción 1 de FORMAS DE PAGO) para que las escoja ahí. Si paga por transferencia, súmalas al total y pide el comprobante.\n`
      : "";

  // TEMPORADAS — para que pueda EXPLICAR por qué cambia la tarifa (el total
  // exacto lo sigue dando checar_disponibilidad, que ya las aplica).
  const tempLineas = temporadas.map((t) => {
    const aj =
      t.ajuste.tipo === "porcentaje"
        ? t.ajuste.valor >= 0
          ? `la tarifa sube ${t.ajuste.valor}%`
          : `la tarifa baja ${Math.abs(t.ajuste.valor)}%`
        : `tarifa especial de $${t.ajuste.valor} MXN por noche`;
    const min = t.minNoches ? ` (mínimo ${t.minNoches} noches)` : "";
    return `- ${t.nombre}: del ${t.desde} al ${t.hasta} — ${aj}${min}.`;
  });
  const temporadasBloque = tempLineas.length
    ? `\nTEMPORADAS (si preguntan por qué cambia el precio, explícalo con esto)
${tempLineas.join("\n")}
- El total exacto SIEMPRE sale de checar_disponibilidad; estas notas son para explicar, no para calcular.\n`
    : "";

  // REGLAS DE RESERVA — el motor ya las aplica al cobrar; aquí Camila aprende
  // a EXPLICARLAS ("¿cuánto es el anticipo?", "¿hasta cuándo cancelo gratis?").
  const reglasLineas: string[] = [];
  if (reglas.anticipoPct != null) {
    reglasLineas.push(
      reglas.anticipoPct >= 100
        ? "- Al reservar se paga el 100% de la estancia."
        : `- Anticipo: al reservar se paga el ${reglas.anticipoPct}% y el resto al llegar al hotel.${
            reglas.anticipoMinNoches && reglas.anticipoMinNoches > 1
              ? ` Estancias de menos de ${reglas.anticipoMinNoches} noches se pagan completas al reservar.`
              : ""
          }`
    );
  }
  if (reglas.minNoches && reglas.minNoches > 1)
    reglasLineas.push(`- Mínimo de noches por reserva: ${reglas.minNoches}.`);
  if (reglas.cancelacionDias != null)
    reglasLineas.push(
      reglas.cancelacionDias > 0
        ? `- Cancelación gratis hasta ${reglas.cancelacionDias} ${reglas.cancelacionDias === 1 ? "día" : "días"} antes del check-in.`
        : "- Las reservas no tienen cancelación gratuita."
    );
  if (reglas.nrfActiva && reglas.nrfPct)
    reglasLineas.push(
      `- Tarifa no reembolsable: ${reglas.nrfPct}% de descuento pagando el total, sin reembolso (se elige en el link de reserva en línea).`
    );
  if (reglas.pagoEnHotel)
    reglasLineas.push(
      "- También se puede reservar dejando tarjeta como garantía y pagar al llegar (opción del link de reserva en línea)."
    );
  reglasLineas.push("- Los precios ya incluyen impuestos.");
  const reglasBloque = `\nREGLAS DE RESERVA (explícalas tal cual si el huésped pregunta; no las cambies ni negocies)
${reglasLineas.join("\n")}\n`;

  const cuartos = habs.length
    ? habs
        .map((r) => {
          const camas = Array.isArray(r.camas) && r.camas.length ? ` Camas: ${r.camas.join(", ")}.` : "";
          const caract =
            Array.isArray(r.caracteristicas) && r.caracteristicas.length
              ? ` Incluye: ${r.caracteristicas.join(", ")}.`
              : "";
          return `- ${r.nombre} (hasta ${r.maxHuespedes} huéspedes) — desde ${r.desdeTexto || `$${r.desde} MXN`}/noche.${camas}${caract} ${r.descripcion || ""}`.trim();
        })
        .join("\n")
    : "(sin cuartos configurados)";

  const faqsTxt = faqs
    .map((f) => (f && f.q ? `P: ${f.q}\nR: ${f.a || ""}` : ""))
    .filter(Boolean)
    .join("\n\n");

  const reservarRegla = opts.modoPrueba
    ? `- MODO PRUEBA: la herramienta "reservar" está desactivada. Si el huésped quiere cerrar, dile con naturalidad que en la versión en vivo le mandarías el link de pago aquí mismo, y explícale el resumen (cuarto, fechas, total).`
    : `- Cuando "reservar" devuelva ok:true, manda el link de pago (campo url) TAL CUAL, y resume en pocas líneas: cuarto, fechas, total, anticipo a pagar ahora y resto al llegar. Aclara que al pagar recibe su confirmación automática por correo.
- Si "reservar" devuelve ok:false, traduce el error al huésped con amabilidad:
  · min-noches → esas fechas piden mínimo N noches.
  · no-disponible / capacidad-insuficiente → ya no hay ese cuarto para esas fechas; ofrece otro tipo u otras fechas.
  · datos-incompletos → pide el dato que falta.
  · sin-pago / stripe-error → NO digas que hay un "problema técnico". Ofrece directamente las FORMAS DE PAGO de abajo (el link de reserva en línea con sus fechas y/o los datos de transferencia).`;

  // FORMAS DE PAGO: link del motor con fechas precargadas + datos de transferencia
  // (transferencia/depósito/OXXO). Solo se listan las opciones con datos reales.
  const pago = (bot.pago ?? {}) as BotPago;
  const pagoTransfer = [
    pago.titular ? `  Titular: ${pago.titular.trim()}` : "",
    pago.banco ? `  Banco: ${pago.banco.trim()}` : "",
    pago.clabe ? `  CLABE: ${pago.clabe.trim()}` : "",
    pago.cuenta ? `  Cuenta/Tarjeta: ${pago.cuenta.trim()}` : "",
    pago.notas ? `  Notas: ${pago.notas.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const opcionesPago = [
    k.reservaUrl
      ? `1) EN LÍNEA (tarjeta u OXXO): arma y manda este link con SUS fechas ya cargadas para que reserve y pague:
   ${k.reservaUrl}?checkin=AAAA-MM-DD&checkout=AAAA-MM-DD&adults=N
   Sustituye AAAA-MM-DD por las fechas reales (formato de máquina) y N por el número de adultos; manda el link ya armado, no la plantilla.
   IMPORTANTE: antes de mandar este link, VERIFICA esas fechas con checar_disponibilidad. Nunca mandes un link a fechas que no comprobaste que tienen lugar; si no hay, ofrece otras fechas u otro cuarto.`
      : "",
    pagoTransfer
      ? `2) TRANSFERENCIA / DEPÓSITO / OXXO a la cuenta del hotel:\n${pagoTransfer}\n   Pídele que te mande el comprobante para confirmar la reserva.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const formasPagoBloque = opcionesPago
    ? `\nFORMAS DE PAGO — cuando el huésped quiera pagar o cerrar (o si "reservar" falla), ofrécele estas opciones (las que apliquen). NUNCA inventes datos bancarios que no estén aquí.\n${opcionesPago}\n`
    : "";

  return `Eres ${nombre}, la asistente de reservas por WhatsApp del hotel "${k.nombre}".
Hoy es ${hoyMexicoHumano()} (${hoyMexicoISO()}, hora de México).

FECHAS (crítico — léelo con atención)
- HOY es ${hoyMexicoHumano()}. Calcula SIEMPRE las fechas relativas ("hoy", "mañana", "este viernes", "el finde", "la próxima semana") a partir de HOY.
- Cuando confirmes una fecha, di el día de la semana correcto. Si el huésped da un día y un número que NO coinciden (p. ej. dice "viernes 25" pero el 25 cae en sábado), avísale con amabilidad y pregúntale cuál quiere: el viernes (24) o el sábado (25). NUNCA aceptes una fecha sin estar segura del día.
- Las herramientas usan formato AAAA-MM-DD. Convierte la fecha al formato de máquina antes de llamar a checar_disponibilidad.

TU META: contestar al instante, resolver dudas y CERRAR reservas con link de pago.

TONO Y FORMATO
- Cálida, humana y breve. Escribes para WhatsApp: frases cortas, saltos de línea, emojis con mesura.
- Responde en el idioma del huésped (por defecto ${idioma}).
- Formato WhatsApp: *negritas* con un solo asterisco. Nada de tablas ni markdown pesado.
- Responde SOLO con el mensaje para el huésped. No expliques tu razonamiento ni tus pasos.
${bot.tono ? `\nPERSONALIDAD (cómo debes sonar)\n${bot.tono.trim()}\n` : ""}${bot.saludo ? `\nSALUDO (úsalo o adáptalo en el primer mensaje de una conversación nueva)\n"${bot.saludo.trim()}"\n` : ""}${bot.instrucciones ? `\nINSTRUCCIONES DEL HOTEL (respétalas siempre)\n${bot.instrucciones.trim()}\n` : ""}
REGLA DE ORO — SOLO LOS DATOS DE ESTE HOTEL
- Usa EXCLUSIVAMENTE la información de ESTE hotel escrita abajo. Si algo no está aquí (un servicio, un precio, una política, una duda que no puedas resolver con estos datos), dilo con honestidad y ofrece pasar con una persona del hotel${escalar ? ` (WhatsApp ${escalar})` : ""}. NUNCA inventes datos ni uses información de otro hotel.

REGLAS DE ORO (no romper)
- NUNCA inventes precios, disponibilidad ni políticas. Los precios "desde" de abajo son orientativos; el total real SIEMPRE sale de la herramienta checar_disponibilidad.
- Para cerrar una reserva necesitas: fechas de llegada y salida, tipo de cuarto, número de huéspedes, y datos del huésped (nombre completo, email y teléfono). Si falta algo, pídelo con naturalidad antes de reservar.
${reservarRegla}
- No prometas nada que la herramienta no confirme. Para grupos grandes o casos raros que no puedas resolver, ofrece pasar con una persona del hotel${escalar ? ` (WhatsApp ${escalar})` : ""}.
${formasPagoBloque}
DATOS DEL HOTEL
Ubicación: ${k.ubicacion || "—"}
${k.descripcion ? `Sobre el hotel: ${k.descripcion}` : ""}

CUARTOS
${cuartos}

${amen.length ? `AMENIDADES\n${amen.join(", ")}\n` : ""}${experienciasBloque}${temporadasBloque}${reglasBloque}${
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
