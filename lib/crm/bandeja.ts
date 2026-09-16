// La BANDEJA del fundador (/crm/bandeja). SOLO servidor (service-role).
//
// Dos cosas que hasta el 15 sep 2026 sólo existían fuera de la web:
//
//   · ALERTAS del camino del dinero (`alertar()`, lib/alertas.ts). Llegaban
//     únicamente por correo: si el correo se perdía, nadie sabía que un cobro
//     había caído en la cuenta de Kora. Ahora se guardan en `alertas_fundador`.
//   · CHATS DE LA WEB que el asistente de soporte escaló a una persona. Se guardaban en
//     `soporte_conversaciones`, pero la única forma de leerlos era abrir el Table
//     Editor de Supabase, y el CRM sólo enseñaba cuántos había.
//
// Aquí se leen las dos, y viven las reglas puras que las ordenan (agrupar las
// alertas repetidas, sacar el correo o el teléfono que dejó el visitante, saber
// si volvió a escribir después de atenderlo). Las pantallas NO importan valores
// de este archivo — sólo `import type` —: arrastraría la service-role al
// navegador.
//
// Misma regla que lib/crm/operaciones.ts: «no pude leer» y «no hay nada» se ven
// distintos. Una tabla sin crear es una nota gris con el SQL que falta; un fallo
// de la base es un aviso rojo, nunca una bandeja vacía.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

// ─── Errores de la base ──────────────────────────────────────────────────────

type ErrorDb = { code?: string; message?: string } | null;

const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);
const COLUMNA_AUSENTE = new Set(["42703", "PGRST204"]);

/** ¿El error dice que la TABLA no existe (falta correr su SQL)? */
export function faltaTabla(error: ErrorDb): boolean {
  if (!error) return false;
  if (error.code && TABLA_AUSENTE.has(error.code)) return true;
  return /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

/**
 * ¿El error dice que falta ESA columna (tabla vieja, SQL nuevo sin correr)?
 *
 * El código solo no basta: 42703 / PGRST204 dicen «falta UNA columna», no cuál.
 * Sin mirar el nombre, que faltara `email` en crm_leads se leía como «falta
 * `secuencia_pausada`» y se reintentaba a ciegas sin ella. Ambos mensajes
 * nombran la columna, así que sólo se acepta el código a secas si no hay mensaje.
 */
export function faltaColumna(error: ErrorDb, columna: string): boolean {
  if (!error) return false;
  const m = error.message ?? "";
  const esColumnaAusente =
    Boolean(error.code && COLUMNA_AUSENTE.has(error.code)) || /does not exist|Could not find/i.test(m);
  return esColumnaAusente && (m ? m.includes(columna) : true);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_EN_TEXTO = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function esUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

// ─── Hoteles mencionados en un texto ─────────────────────────────────────────

export interface HotelConocido {
  id: string;
  slug: string;
  nombre: string | null;
}

export interface HotelMencionado {
  slug: string;
  nombre: string;
}

/**
 * Los slugs salen de `slugify(nombre)` (app/api/panel/crear-hotel), así que un
 * hotel puede llamarse literalmente «hotel» o «prueba». Las alertas están
 * escritas en español y esas palabras aparecen en casi todas: enlazarlas pondría
 * el mismo hotel equivocado en media bandeja. Un slug de una sola palabra sólo
 * cuenta si es largo y no es una palabra de las que usan los propios textos.
 */
const PALABRAS_DE_ALERTA = new Set([
  "hoteles",
  "reserva",
  "reservas",
  "stripe",
  "cuenta",
  "cuentas",
  "correo",
  "webhook",
  "plataforma",
  "ninguno",
  "ninguna",
  "prueba",
  "apartado",
  "apartados",
  "huesped",
  "mensajes",
  "suscripcion",
  "usuario",
  "experiencia",
]);

function slugEnlazable(slug: string): boolean {
  if (slug.length < 4) return false;
  if (slug.includes("-")) return true;
  return slug.length >= 6 && !PALABRAS_DE_ALERTA.has(slug);
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Los hoteles que un texto menciona, por id (uuid) o por slug. PURA.
 *
 * Las alertas nombran al hotel de las dos formas («Hotel 1b2c…», «El hotel
 * casa-luna»). El slug tiene que aparecer como palabra entera: `casa-luna` no
 * se enlaza dentro de `casa-luna-ab12`, que es otro hotel.
 */
export function hotelesMencionados(texto: string, hoteles: HotelConocido[], max = 3): HotelMencionado[] {
  if (!texto || hoteles.length === 0) return [];
  const encontrados = new Map<string, HotelMencionado>();
  const agregar = (h: HotelConocido) => {
    if (encontrados.size < max && !encontrados.has(h.slug)) {
      encontrados.set(h.slug, { slug: h.slug, nombre: h.nombre?.trim() || h.slug });
    }
  };

  const porId = new Map(hoteles.map((h) => [h.id.toLowerCase(), h]));
  for (const m of texto.matchAll(UUID_EN_TEXTO)) {
    const h = porId.get(m[0].toLowerCase());
    if (h) agregar(h);
  }

  for (const h of hoteles) {
    if (encontrados.size >= max) break;
    if (!h.slug || !slugEnlazable(h.slug) || !texto.includes(h.slug)) continue;
    const palabra = new RegExp(`(^|[^A-Za-z0-9_-])${escaparRegex(h.slug)}(?![A-Za-z0-9_-])`);
    if (palabra.test(texto)) agregar(h);
  }
  return [...encontrados.values()];
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

export interface FilaAlerta {
  id: string;
  created_at: string;
  asunto: string;
  detalle: string | null;
  atendida_at: string | null;
}

export interface OcurrenciaAlerta {
  id: string;
  created_at: string;
  detalle: string | null;
}

/**
 * Una entrada de la bandeja. Las alertas IGUALES (mismo asunto) se agrupan: un
 * Stripe que no contesta durante una hora deja decenas de filas con el mismo
 * asunto, y sin agrupar enterrarían la única alerta distinta del día.
 */
export interface AlertaBandeja {
  /** Id de la ocurrencia más reciente; estable para las `key` de React. */
  clave: string;
  asunto: string;
  /** Todas las filas del grupo: «Marcar atendida» las marca juntas. */
  ids: string[];
  veces: number;
  ultima: string;
  primera: string;
  /** null = sin atender. */
  atendida_at: string | null;
  /** Más reciente primero, hasta `OCURRENCIAS_MAX`. */
  ocurrencias: OcurrenciaAlerta[];
  hoteles: HotelMencionado[];
}

export const OCURRENCIAS_MAX = 20;
export const ALERTAS_MAX = 100;

/**
 * Cuánto de cada detalle se mira para enlazar hoteles.
 *
 * El hotel va delante (por eso lib/alertas.ts usa los primeros 500 caracteres
 * para comparar repetidas). Sin tope, un grupo con 20 ocurrencias de 20.000
 * caracteres son 400 KB que se recorren UNA VEZ POR HOTEL: con 12 hoteles no se
 * nota, con 500 la bandeja se queda pensando. Se paga el detalle largo donde
 * sirve —se pinta entero— y no en la búsqueda.
 */
const DETALLE_PARA_HOTELES = 2_000;

/**
 * Agrupa y ordena. PURA.
 *
 * · Sin atender: por asunto. Primero todas las pendientes, la más reciente arriba.
 * · Atendidas: por asunto Y momento en que se atendieron (las que se marcaron
 *   con un solo clic vuelven juntas; las de otro día, no).
 */
export function agruparAlertas(
  filas: FilaAlerta[],
  hoteles: HotelConocido[] = [],
  max = ALERTAS_MAX,
): AlertaBandeja[] {
  const grupos = new Map<string, FilaAlerta[]>();
  for (const f of filas) {
    if (!f || !esUuid(f.id) || typeof f.asunto !== "string") continue;
    const clave = f.atendida_at ? `a|${f.atendida_at}|${f.asunto}` : `p|${f.asunto}`;
    const lista = grupos.get(clave);
    if (lista) lista.push(f);
    else grupos.set(clave, [f]);
  }

  const entradas: AlertaBandeja[] = [];
  for (const lista of grupos.values()) {
    const orden = [...lista].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const reciente = orden[0];
    const textos = [
      reciente.asunto,
      ...orden.slice(0, OCURRENCIAS_MAX).map((o) => (o.detalle ?? "").slice(0, DETALLE_PARA_HOTELES)),
    ].join("\n");
    entradas.push({
      clave: reciente.id,
      asunto: reciente.asunto,
      ids: orden.map((o) => o.id),
      veces: orden.length,
      ultima: reciente.created_at,
      primera: orden[orden.length - 1].created_at,
      atendida_at: reciente.atendida_at,
      ocurrencias: orden
        .slice(0, OCURRENCIAS_MAX)
        .map((o) => ({ id: o.id, created_at: o.created_at, detalle: o.detalle })),
      hoteles: hotelesMencionados(textos, hoteles),
    });
  }

  entradas.sort((a, b) => {
    const pa = a.atendida_at ? 1 : 0;
    const pb = b.atendida_at ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return b.ultima.localeCompare(a.ultima);
  });
  return entradas.slice(0, Math.max(0, max));
}

// ─── Chats de la web ─────────────────────────────────────────────────────────

/** Así se marca un lead que salió del chat de la web (`crm_leads.origen`). */
export const ORIGEN_CHAT = "chat-web";

export interface MensajeChat {
  rol: "user" | "assistant";
  texto: string;
  ts: string | null;
}

export interface ContactoChat {
  emails: string[];
  telefonos: string[];
}

export type EstadoChat = "pendiente" | "volvio" | "atendido";

export interface ChatBandeja {
  id: string;
  pagina: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Cuándo escribió por última vez (el `ts` del último mensaje; si no hay,
   * `updated_at`). Es lo que se enseña y por lo que se ordena: `updated_at` lo
   * mueve también el CRM al marcarlo atendido.
   */
  ultimoMensaje: string;
  atendido_at: string | null;
  estado: EstadoChat;
  mensajes: MensajeChat[];
  contacto: ContactoChat;
  /** El lead que ya se creó desde este chat, si hay. */
  leadId: string | null;
}

/**
 * `mensajes` es un jsonb que escribe app/api/soporte/route.ts: `[{rol, texto,
 * ts?}]`. Se lee a la defensiva — una fila vieja o editada a mano no puede
 * tumbar la bandeja entera. PURA.
 */
export function normalizarMensajes(crudo: unknown): MensajeChat[] {
  if (!Array.isArray(crudo)) return [];
  const out: MensajeChat[] = [];
  for (const m of crudo) {
    if (!m || typeof m !== "object") continue;
    const { rol, texto, ts } = m as Record<string, unknown>;
    if ((rol !== "user" && rol !== "assistant") || typeof texto !== "string" || !texto.trim()) continue;
    out.push({ rol, texto: texto.slice(0, 5_000), ts: typeof ts === "string" ? ts : null });
  }
  return out;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Un número con separadores comunes (espacios, guiones, puntos, paréntesis).
const TELEFONO = /\+?\d[\d\s().-]{8,18}\d/g;

/**
 * El correo y el teléfono que el VISITANTE escribió en el chat. PURA.
 *
 * El widget no pide datos de contacto: si alguien pidió que le llamaran, los
 * dejó escritos en el texto. Sólo se miran los mensajes del visitante — los del
 * asistente traen el WhatsApp de Kora y ése no es el contacto del lead.
 *
 * Un teléfono cuenta con 10 dígitos (México) o 12–13 con lada de país (52 / 521).
 * Menos que eso son fechas, precios o números de habitación.
 */
export function contactoDeMensajes(mensajes: MensajeChat[]): ContactoChat {
  const emails: string[] = [];
  const telefonos: string[] = [];
  for (const m of mensajes) {
    if (m.rol !== "user") continue;
    for (const e of m.texto.match(EMAIL) ?? []) {
      const limpio = e.toLowerCase().replace(/\.+$/, "");
      if (!emails.includes(limpio) && emails.length < 3) emails.push(limpio);
    }
    // Sin los correos, para no leer dígitos de un correo como teléfono.
    const sinEmails = m.texto.replace(EMAIL, " ");
    for (const t of sinEmails.match(TELEFONO) ?? []) {
      const digitos = t.replace(/\D/g, "");
      const valido =
        digitos.length === 10 ||
        (digitos.length === 12 && digitos.startsWith("52")) ||
        (digitos.length === 13 && digitos.startsWith("521"));
      if (valido && !telefonos.includes(digitos) && telefonos.length < 3) telefonos.push(digitos);
    }
  }
  return { emails, telefonos };
}

/**
 * ¿Hay que mirarlo? PURA.
 *
 * «volvio» = se marcó atendido y el visitante siguió escribiendo después. No se
 * compara con `updated_at`: el trigger `soporte_touch` lo mueve también cuando
 * el CRM escribe `atendido_at`, así que marcarlo atendido lo haría «volver» al
 * instante. El `ts` del último mensaje sólo lo pone la ruta del chat.
 */
export function estadoDelChat(atendidoAt: string | null, mensajes: MensajeChat[]): EstadoChat {
  if (!atendidoAt) return "pendiente";
  const atendido = Date.parse(atendidoAt);
  const ts = ultimoTs(mensajes);
  const ultimo = ts ? Date.parse(ts) : Number.NaN;
  if (Number.isFinite(atendido) && Number.isFinite(ultimo) && ultimo > atendido) return "volvio";
  return "atendido";
}

/** El `ts` más reciente de los mensajes (el que pone la ruta del chat), o null. PURA. */
export function ultimoTs(mensajes: MensajeChat[]): string | null {
  let mejor: string | null = null;
  let mejorMs = Number.NEGATIVE_INFINITY;
  for (const m of mensajes) {
    const t = m.ts ? Date.parse(m.ts) : Number.NaN;
    if (Number.isFinite(t) && t > mejorMs) {
      mejorMs = t;
      mejor = m.ts;
    }
  }
  return mejor;
}

/**
 * La marca que une un lead con su chat, escrita al final de `crm_leads.notas`.
 * `crm_leads` no tiene una columna para esto y añadirla sería otro SQL; con la
 * marca, «¿este chat ya es lead?» se contesta sin tocar la base, y un segundo
 * clic en «Pasar a lead» no duplica el prospecto.
 */
export function marcaDeChat(chatId: string): string {
  return `ref. chat ${chatId.toLowerCase()}`;
}

/** El id del lead cuyas notas llevan la marca de ese chat, o null. PURA. */
export function leadDeChat(leads: { id: string; notas: string | null }[], chatId: string): string | null {
  const marca = marcaDeChat(chatId);
  const l = leads.find((x) => typeof x.notas === "string" && x.notas.toLowerCase().includes(marca));
  return l ? l.id : null;
}

const NOTAS_TRANSCRIPCION_MAX = 3_000;

function fechaMx(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(ms);
}

/**
 * Las notas del lead nuevo: lo que el fundador añada, de dónde llegó, lo que
 * escribió el visitante (sólo sus mensajes: lo que respondió el asistente ya se sabe)
 * y, al final, la marca del chat. PURA.
 *
 * La marca va SIEMPRE, aunque la transcripción se recorte: es lo que evita
 * crear el mismo lead dos veces.
 */
export function notasDeLead(
  chat: { id: string; created_at: string; pagina: string | null; mensajes: MensajeChat[] },
  notaExtra?: string | null,
): string {
  const partes: string[] = [];
  const extra = typeof notaExtra === "string" ? notaExtra.trim() : "";
  if (extra) partes.push(extra.slice(0, 1_000));

  const cuando = fechaMx(chat.created_at);
  const donde = chat.pagina ? ` (página ${chat.pagina})` : "";
  partes.push(`Llegó por el chat de la web${cuando ? ` el ${cuando}` : ""}${donde}.`);

  const lineas: string[] = [];
  let usado = 0;
  for (const m of chat.mensajes) {
    if (m.rol !== "user") continue;
    const linea = `— ${m.texto.trim().replace(/\s+/g, " ")}`;
    if (usado + linea.length > NOTAS_TRANSCRIPCION_MAX) {
      lineas.push("— (…recortado)");
      break;
    }
    lineas.push(linea);
    usado += linea.length;
  }
  if (lineas.length) partes.push(`Lo que escribió:\n${lineas.join("\n")}`);

  partes.push(`(${marcaDeChat(chat.id)})`);
  return partes.join("\n\n");
}

export interface DatosLeadDeChat {
  hotel_nombre: string;
  tomador_nombre?: string | null;
  contacto?: string | null;
  email?: string | null;
  ciudad?: string | null;
  nota?: string | null;
  /** true = sí recibe los correos automáticos del día 3 y del día 7. */
  secuencia: boolean;
}

/**
 * El cuerpo que se le pasa a `sanitizeLead(…, "create")`. PURA.
 *
 * La secuencia va PAUSADA salvo que se pida: quien escaló el chat pidió hablar
 * con una persona, y los correos del día 3 y 7 están escritos para quien dejó
 * sus datos en un formulario sin hablar con nadie.
 */
export function cuerpoLeadDeChat(
  chat: { id: string; created_at: string; pagina: string | null; mensajes: MensajeChat[] },
  datos: DatosLeadDeChat,
): Record<string, unknown> {
  return {
    hotel_nombre: datos.hotel_nombre,
    tomador_nombre: datos.tomador_nombre ?? null,
    contacto: datos.contacto ?? null,
    email: datos.email ?? null,
    ciudad: datos.ciudad ?? null,
    origen: ORIGEN_CHAT,
    etapa: "nuevo",
    notas: notasDeLead(chat, datos.nota),
    secuencia_pausada: !datos.secuencia,
  };
}

interface FilaChat {
  id: string;
  pagina: string | null;
  mensajes: unknown;
  created_at: string;
  updated_at: string;
  atendido_at?: string | null;
}

/** De la fila cruda al chat de la bandeja. PURA. */
export function chatDeFila(f: FilaChat, leads: { id: string; notas: string | null }[] = []): ChatBandeja {
  const mensajes = normalizarMensajes(f.mensajes);
  const atendido = typeof f.atendido_at === "string" ? f.atendido_at : null;
  return {
    id: f.id,
    pagina: typeof f.pagina === "string" ? f.pagina : null,
    created_at: f.created_at,
    updated_at: f.updated_at,
    ultimoMensaje: ultimoTs(mensajes) ?? f.updated_at,
    atendido_at: atendido,
    estado: estadoDelChat(atendido, mensajes),
    mensajes,
    contacto: contactoDeMensajes(mensajes),
    leadId: leadDeChat(leads, f.id),
  };
}

/** Lo que pide atención arriba (pendiente y «volvió»), y dentro, lo más reciente. PURA. */
export function ordenarChats(chats: ChatBandeja[]): ChatBandeja[] {
  const peso = (c: ChatBandeja) => (c.estado === "atendido" ? 1 : 0);
  return [...chats].sort((a, b) => {
    if (peso(a) !== peso(b)) return peso(a) - peso(b);
    return Date.parse(b.ultimoMensaje) - Date.parse(a.ultimoMensaje) || 0;
  });
}

// ─── Lectores (servidor) ─────────────────────────────────────────────────────

export type LecturaBandeja<T> =
  | { estado: "ok"; data: T; aviso?: string }
  | { estado: "falta-sql"; archivo: string }
  | { estado: "error"; detalle: string };

const SQL_MANDO = "sql/kora-crm-mando.sql";
const SQL_SOPORTE = "sql/kora-soporte-schema.sql";
const TOPE_PENDIENTES = 500;
const TOPE_ATENDIDAS = 100;
export const CHATS_MAX = 100;

async function leerHotelesConocidos(): Promise<HotelConocido[]> {
  try {
    const { data, error } = await createAdminClient().from("hoteles").select("id, slug, nombre").limit(5_000);
    if (error) {
      console.error("[bandeja] no se pudieron leer los hoteles para enlazar:", error.message);
      return [];
    }
    return ((data ?? []) as HotelConocido[]).filter((h) => esUuid(h.id) && typeof h.slug === "string");
  } catch (e) {
    console.error("[bandeja] error leyendo hoteles:", e);
    return [];
  }
}

/**
 * Lo que la pantalla NO está viendo, dicho en voz alta. PURA.
 *
 * Dos topes distintos y los dos pueden esconder alertas:
 *   · `TOPE_PENDIENTES` filas leídas de la base;
 *   · `ALERTAS_MAX` grupos pintados — y el número de la pestaña sale de esos
 *     grupos, así que sin este aviso diría «100» habiendo 130 y la bandeja se
 *     leería como si estuviera al día.
 *
 * Con un asunto por hotel y por umbral («saldo: casa-luna llegó a 59 mensajes»),
 * pasar de 100 asuntos distintos no es una hipótesis: es crecer.
 */
export function avisoDeTope(filasPendientes: number, grupos: number): string | undefined {
  if (grupos > ALERTAS_MAX) {
    return (
      `Hay ${grupos} alertas distintas y aquí caben ${ALERTAS_MAX}: ves las más recientes. ` +
      `El número de la pestaña tampoco las cuenta todas.`
    );
  }
  if (filasPendientes >= TOPE_PENDIENTES) {
    return `Hay ${TOPE_PENDIENTES} alertas sin atender o más: sólo se leyeron las ${TOPE_PENDIENTES} más recientes.`;
  }
  return undefined;
}

/**
 * Lo mismo que `avisoDeTope`, para los CHATS. PURA.
 *
 * La lista de chats no tiene ventana de tiempo: se leen los escalados y los que
 * ya se tocaron, de TODA la vida, ordenados por `updated_at` y cortados en
 * `CHATS_MAX`. Y marcar uno como atendido mueve su `updated_at` (el trigger
 * `soporte_touch`), así que los atendidos se ponen delante y empujan fuera a los
 * pendientes viejos. Sin este aviso, un chat sin atender desaparecía de la
 * bandeja —y del número de la pestaña— sin que nada lo dijera, que es justo lo
 * que ya se corrigió en las alertas.
 *
 * `leidas` es lo que devolvió la base pidiendo `CHATS_MAX + 1`: si llegó una de
 * más, hay más de las que caben.
 */
export function avisoDeChats(leidas: number, tope = CHATS_MAX): string | undefined {
  if (leidas <= tope) return undefined;
  return (
    `Hay más de ${tope} chats escalados o ya atendidos y aquí caben ${tope}: ves los más recientes. ` +
    `El número de la pestaña tampoco los cuenta todos. Ve marcando como atendidos los que ya resolviste.`
  );
}

/** Alertas agrupadas, sin atender primero. NUNCA lanza. */
export async function cargarAlertas(): Promise<LecturaBandeja<{ alertas: AlertaBandeja[]; pendientes: number }>> {
  if (!adminEnvReady) return { estado: "error", detalle: "No hay conexión a la base de datos." };
  try {
    const admin = createAdminClient();
    const columnas = "id, created_at, asunto, detalle, atendida_at";
    const [rPend, rAtend, hoteles] = await Promise.all([
      admin
        .from("alertas_fundador")
        .select(columnas)
        .is("atendida_at", null)
        .order("created_at", { ascending: false })
        .limit(TOPE_PENDIENTES),
      admin
        .from("alertas_fundador")
        .select(columnas)
        .not("atendida_at", "is", null)
        .order("atendida_at", { ascending: false })
        .limit(TOPE_ATENDIDAS),
      leerHotelesConocidos(),
    ]);
    const error = rPend.error ?? rAtend.error;
    if (error) {
      if (faltaTabla(error)) return { estado: "falta-sql", archivo: SQL_MANDO };
      console.error("[bandeja] no se pudieron leer las alertas:", error.message);
      return { estado: "error", detalle: "No se pudieron leer las alertas. Recarga en un momento." };
    }
    const pendientesFilas = (rPend.data ?? []) as FilaAlerta[];
    // Se agrupa TODO y se recorta después, no al agrupar: hay que saber cuántos
    // grupos había de verdad para poder decir cuántos no caben.
    const todos = agruparAlertas(
      [...pendientesFilas, ...((rAtend.data ?? []) as FilaAlerta[])],
      hoteles,
      Number.MAX_SAFE_INTEGER,
    );
    return {
      estado: "ok",
      data: { alertas: todos.slice(0, ALERTAS_MAX), pendientes: pendientesFilas.length },
      aviso: avisoDeTope(pendientesFilas.length, todos.length),
    };
  } catch (e) {
    console.error("[bandeja] error leyendo alertas:", e);
    return { estado: "error", detalle: "No se pudieron leer las alertas. Recarga en un momento." };
  }
}

export interface DatosChats {
  chats: ChatBandeja[];
  /** false = falta la columna `atendido_at`: no se puede marcar atendido. */
  puedeAtender: boolean;
  /** false = no se pudo saber qué chats ya son lead. */
  leadsLeidos: boolean;
}

/** Leads que salieron del chat (sólo id y notas, para encontrar la marca). */
async function leadsDelChat(): Promise<{ ok: boolean; leads: { id: string; notas: string | null }[] }> {
  try {
    const { data, error } = await createAdminClient()
      .from("crm_leads")
      .select("id, notas")
      .eq("origen", ORIGEN_CHAT)
      .order("created_at", { ascending: false })
      .limit(1_000);
    if (error) {
      console.error("[bandeja] no se pudieron leer los leads del chat:", error.message);
      return { ok: false, leads: [] };
    }
    return { ok: true, leads: (data ?? []) as { id: string; notas: string | null }[] };
  } catch (e) {
    console.error("[bandeja] error leyendo leads del chat:", e);
    return { ok: false, leads: [] };
  }
}

const COLUMNAS_CHAT = "id, pagina, mensajes, created_at, updated_at";

/**
 * Consulta de chats con `atendido_at` y, si esa columna aún no existe (el
 * bloque E de sql/kora-crm-mando.sql sin correr), otra vez sin ella: la bandeja
 * se puede leer igual, sólo sin el botón de «Marcar atendido». `armar` recibe
 * las columnas y si puede filtrar por `atendido_at`, y devuelve la consulta.
 *
 * `data: unknown` a propósito: con las columnas en una variable, postgrest-js
 * tipa las filas como `GenericStringError[]`, que no casa con ningún tipo
 * nuestro y rompía `tsc`. Quien llama hace el cast (como lib/db/portal.ts).
 */
async function consultarChats(
  armar: (columnas: string, conAtendido: boolean) => PromiseLike<{ data: unknown; error: ErrorDb }>,
): Promise<{ data: unknown; error: ErrorDb; puedeAtender: boolean }> {
  const r = await armar(`${COLUMNAS_CHAT}, atendido_at`, true);
  if (r.error && !faltaTabla(r.error) && faltaColumna(r.error, "atendido_at")) {
    const r2 = await armar(COLUMNAS_CHAT, false);
    return { data: r2.data, error: r2.error, puedeAtender: false };
  }
  return { data: r.data, error: r.error, puedeAtender: true };
}

/** Chats escalados a una persona, los que piden atención primero. NUNCA lanza. */
export async function cargarChats(): Promise<LecturaBandeja<DatosChats>> {
  if (!adminEnvReady) return { estado: "error", detalle: "No hay conexión a la base de datos." };
  try {
    const admin = createAdminClient();
    const [r, leads] = await Promise.all([
      // Escalados, Y los que el fundador ya tocó (`atendido_at` puesto). La ruta
      // del chat (app/api/soporte) reescribe `escalado` en CADA turno: el
      // visitante que vuelve a escribir tras ser atendido casi nunca vuelve a
      // escalar, así que su chat pasa a `escalado = false`. Con sólo
      // `escalado = true`, el estado «Volvió a escribir» no llegaba a verse
      // nunca: el chat desaparecía justo cuando pedía atención otra vez.
      consultarChats((columnas, conAtendido) => {
        const q = admin.from("soporte_conversaciones").select(columnas);
        return (
          (conAtendido ? q.or("escalado.eq.true,atendido_at.not.is.null") : q.eq("escalado", true))
            .order("updated_at", { ascending: false })
            // UNA DE MÁS a propósito: con `limit(CHATS_MAX)` exacto no hay forma
            // de distinguir «caben justos» de «hay más y no los ves». La de más
            // se descarta abajo y sólo sirve para encender `avisoDeChats`.
            .limit(CHATS_MAX + 1)
        );
      }),
      leadsDelChat(),
    ]);
    if (r.error) {
      if (faltaTabla(r.error)) return { estado: "falta-sql", archivo: SQL_SOPORTE };
      console.error("[bandeja] no se pudieron leer los chats:", r.error.message);
      return { estado: "error", detalle: "No se pudieron leer los chats. Recarga en un momento." };
    }
    const filas = (r.data ?? []) as FilaChat[];
    // Se ordena ANTES de recortar: `ordenarChats` pone delante lo que pide
    // atención, así que si sobran filas las que se caen son las ya atendidas y
    // no un pendiente viejo.
    const chats = ordenarChats(filas.map((f) => chatDeFila(f, leads.leads))).slice(0, CHATS_MAX);
    const avisos = [
      avisoDeChats(filas.length),
      r.puedeAtender
        ? undefined
        : `Para marcar chats como atendidos falta correr ${SQL_MANDO}. Mientras, se pueden leer y pasar a lead.`,
    ].filter(Boolean);
    return {
      estado: "ok",
      data: { chats, puedeAtender: r.puedeAtender, leadsLeidos: leads.ok },
      aviso: avisos.length ? avisos.join(" ") : undefined,
    };
  } catch (e) {
    console.error("[bandeja] error leyendo chats:", e);
    return { estado: "error", detalle: "No se pudieron leer los chats. Recarga en un momento." };
  }
}

export interface DatosBandeja {
  alertas: LecturaBandeja<{ alertas: AlertaBandeja[]; pendientes: number }>;
  chats: LecturaBandeja<DatosChats>;
  /** Hora del servidor al cargar: la pantalla calcula «hace 3 h» con ella, no con su reloj. */
  generado: string;
}

export async function cargarBandeja(): Promise<DatosBandeja> {
  const [alertas, chats] = await Promise.all([cargarAlertas(), cargarChats()]);
  return { alertas, chats, generado: new Date().toISOString() };
}

/**
 * Un chat por id, para las acciones. `null` en `chat` = no existe. NUNCA lanza.
 *
 * No filtra por `escalado` a propósito: la ruta del chat reescribe esa marca en
 * cada turno, así que un visitante que escaló y siguió escribiendo la pierde. Si
 * se exigiera aquí, «Pasar a lead» sobre un chat que la pantalla SÍ enseñaba
 * contestaría «ya no existe».
 */
export async function leerChat(
  id: string,
): Promise<LecturaBandeja<{ chat: ChatBandeja | null; puedeAtender: boolean }>> {
  if (!adminEnvReady) return { estado: "error", detalle: "No hay conexión a la base de datos." };
  if (!esUuid(id)) return { estado: "ok", data: { chat: null, puedeAtender: true } };
  try {
    const admin = createAdminClient();
    const r = await consultarChats((columnas) =>
      admin.from("soporte_conversaciones").select(columnas).eq("id", id).maybeSingle(),
    );
    if (r.error) {
      if (faltaTabla(r.error)) return { estado: "falta-sql", archivo: SQL_SOPORTE };
      console.error(`[bandeja] no se pudo leer el chat ${id}:`, r.error.message);
      return { estado: "error", detalle: "No se pudo leer el chat." };
    }
    return {
      estado: "ok",
      data: { chat: r.data ? chatDeFila(r.data as FilaChat) : null, puedeAtender: r.puedeAtender },
    };
  } catch (e) {
    console.error(`[bandeja] error leyendo el chat ${id}:`, e);
    return { estado: "error", detalle: "No se pudo leer el chat." };
  }
}

/**
 * ¿Ya hay un lead creado desde este chat? Busca la marca en las notas.
 * `ok: false` = no se pudo saber; quien llama NO debe crear otro a ciegas.
 */
export async function leadExistenteDeChat(chatId: string): Promise<{ ok: boolean; leadId: string | null }> {
  if (!adminEnvReady || !esUuid(chatId)) return { ok: false, leadId: null };
  try {
    // El uuid sólo lleva hex y guiones: no hay `%` ni `_` que escapar en el ilike.
    const { data, error } = await createAdminClient()
      .from("crm_leads")
      .select("id")
      .eq("origen", ORIGEN_CHAT)
      .ilike("notas", `%${marcaDeChat(chatId)}%`)
      .limit(1);
    if (error) {
      console.error(`[bandeja] no se pudo buscar el lead del chat ${chatId}:`, error.message);
      return { ok: false, leadId: null };
    }
    const fila = (data ?? [])[0] as { id: string } | undefined;
    return { ok: true, leadId: fila?.id ?? null };
  } catch (e) {
    console.error(`[bandeja] error buscando el lead del chat ${chatId}:`, e);
    return { ok: false, leadId: null };
  }
}
