// El bloque que cambia EN CADA MENSAJE: la fecha y hora de ahora, y quién
// escribe. Va en el system, DESPUÉS del cerebro cacheado del hotel.
//
// Por qué aparte: el cerebro del hotel se cachea (15 min en el runtime, y en la
// caché de prompts de Anthropic). La fecha metida ahí se quedaba vieja: justo
// después de medianoche Camila creía que "hoy" era ayer. Y el teléfono del
// huésped no estaba en ningún lado, así que se lo pedía aunque ya lo tuviera.
//
// `agentes/camila/turno.js` es la copia para el runtime; `tests/camila-modelo.test.ts`
// comprueba que las dos produzcan exactamente el mismo texto.

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function partes(ahora: Date, tz: string): { iso: string; hora: string } {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const p = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return { iso: `${p("year")}-${p("month")}-${p("day")}`, hora: `${p("hour")}:${p("minute")}` };
}

function masDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function legible(iso: string, conAnio = false): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}${conAnio ? ` de ${d.getUTCFullYear()}` : ""}`;
}

/** Un teléfono sólo si el id del chat parece uno (no un @lid de WhatsApp). */
export function telefonoDelChat(conv: string | null | undefined): string | null {
  const d = String(conv ?? "").replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13 ? `+${d}` : null;
}

export function bloqueTurno(opts: { ahora?: Date; tz?: string; conv?: string | null } = {}): string {
  const tz = opts.tz || "America/Mexico_City";
  const { iso, hora } = partes(opts.ahora ?? new Date(), tz);
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  // Este fin de semana: si hoy ya es viernes o sábado, es el que está en curso.
  const viernes = dow === 5 ? iso : dow === 6 ? masDias(iso, -1) : masDias(iso, (5 - dow + 7) % 7 || 7);
  const domingo = masDias(viernes, 2);
  const tel = telefonoDelChat(opts.conv);
  return [
    "AHORA (esta fecha manda sobre cualquier otra)",
    `- Hoy es ${legible(iso, true)} (${iso}), ${hora} hora del hotel.`,
    `- Mañana: ${legible(masDias(iso, 1))} (${masDias(iso, 1)}).`,
    `- Fin de semana más próximo: viernes ${legible(viernes).split(" ").slice(1).join(" ")} (${viernes}) al domingo ${legible(domingo).split(" ").slice(1).join(" ")} (${domingo}).`,
    "- Si el huésped dice un mes sin año, es la próxima vez que llega ese mes.",
    ...(tel
      ? ["", "QUIÉN ESCRIBE", `- Escribe desde el WhatsApp ${tel}. Ya tienes su teléfono: nunca se lo pidas.`]
      : []),
  ].join("\n");
}
