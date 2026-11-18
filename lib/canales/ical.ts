// Núcleo único del enlace por iCal con Airbnb, Booking.com, Expedia (Vrbo) y
// cualquier otro calendario.
//
// Antes este código vivía COPIADO en dos rutas (el cron global y el botón
// «Sincronizar ahora» del panel), con dos parsers que ya habían empezado a
// divergir. Aquí vive una sola vez y las dos rutas lo llaman.
//
// Cómo funciona el enlace (iCal sólo mueve FECHAS OCUPADAS, no tarifas ni datos
// del huésped):
//   · ENTRADA: Kora lee el calendario de cada anuncio de la OTA y bloquea esas
//     noches en la UNIDAD FÍSICA a la que está ligado (blocks.status = 'OTA').
//   · SALIDA: la OTA lee el feed de Kora de esa misma unidad
//     (/api/h/<slug>/ical/<unidad>) y cierra las noches vendidas en Kora.
//
// Por UNIDAD y no por tipo (K-22): un anuncio de Airbnb es un cuarto concreto.
// Con dos cabañas iguales, cada una tiene su anuncio, su enlace de entrada y su
// feed de salida; vender una ya no cierra las dos.

import { createAdminClient } from "@/lib/supabase/admin";
import { updateOTASyncResult } from "@/lib/db/admin";
import { updateOTABlocks } from "@/lib/db/availability";
import { enviarEmail } from "@/lib/email/resend";
import { resolveHotelAvisoEmail } from "@/lib/email/reserva";
import { doc, titulo, parrafo, tablaDatos, caja, esc, fechaLarga } from "@/lib/email/design";

import { NOMBRE_PLATAFORMA, type PlataformaIcal } from "@/lib/canales/plataformas";
export * from "@/lib/canales/plataformas";

/** Cada cuánto se considera vieja una sincronización (lo mismo que el cron). */
export const FRESCURA_MS = 15 * 60_000;

/**
 * Clave con la que se guardan los bloqueos de un canal en `blocks.fuente_ota`.
 * Las OTAs con nombre conservan la clave de siempre (hay filas guardadas así);
 * «otro» lleva el id del canal para que dos calendarios genéricos en la misma
 * unidad no se borren el uno al otro al sincronizar.
 */
export function fuenteDe(canal: { id: string; tipo: string | null }): string {
  const tipo = canal.tipo ?? "booking_com";
  return tipo === "otro" ? `otro:${canal.id}` : tipo;
}

// ── Parser (RFC 5545, lo justo) ─────────────────────────────────────────────

export interface Rango {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD (exclusivo, como en iCal y en `blocks`)
}

function fechaIcal(val: string): string {
  // 20260601 · 20260601T120000Z · 20260601T120000 → 2026-06-01
  const limpio = val.trim().split("T")[0].replace(/\D/g, "");
  if (limpio.length < 8) return "";
  const f = `${limpio.slice(0, 4)}-${limpio.slice(4, 6)}-${limpio.slice(6, 8)}`;
  return Number.isNaN(Date.parse(`${f}T00:00:00Z`)) ? "" : f;
}

function diaSiguiente(f: string): string {
  const d = new Date(`${f}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Rangos ocupados de un calendario iCal.
 *
 *  · Desdobla líneas plegadas (una línea que empieza por espacio continúa la
 *    anterior) — Booking y Airbnb las usan en DESCRIPTION, y un DTSTART partido
 *    se perdía entero con el parser anterior.
 *  · Ignora eventos `STATUS:CANCELLED`.
 *  · Sin DTEND, un evento de día completo dura una noche.
 *  · Descarta lo que ya terminó (checkout <= hoy) y lo incoherente.
 */
export function parseIcal(texto: string, hoy?: string): Rango[] {
  const crudas = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lineas: string[] = [];
  for (const l of crudas) {
    if ((l.startsWith(" ") || l.startsWith("\t")) && lineas.length > 0) {
      lineas[lineas.length - 1] += l.slice(1);
    } else {
      lineas.push(l);
    }
  }

  const rangos: Rango[] = [];
  let dentro = false;
  let inicio = "";
  let fin = "";
  let cancelado = false;

  for (const cruda of lineas) {
    const linea = cruda.trim();
    const mayus = linea.toUpperCase();
    if (mayus === "BEGIN:VEVENT") {
      dentro = true;
      inicio = "";
      fin = "";
      cancelado = false;
      continue;
    }
    if (mayus === "END:VEVENT") {
      if (dentro && inicio && !cancelado) {
        const salida = fin || diaSiguiente(inicio);
        if (salida > inicio) rangos.push({ checkin: inicio, checkout: salida });
      }
      dentro = false;
      continue;
    }
    if (!dentro) continue;

    const dosPuntos = linea.indexOf(":");
    if (dosPuntos < 0) continue;
    const nombre = mayus.slice(0, dosPuntos).split(";")[0];
    const valor = linea.slice(dosPuntos + 1);
    if (nombre === "DTSTART") inicio = fechaIcal(valor);
    else if (nombre === "DTEND") fin = fechaIcal(valor);
    else if (nombre === "STATUS" && valor.trim().toUpperCase() === "CANCELLED") cancelado = true;
  }

  const corte = hoy ?? hoyMx();
  return rangos.filter((r) => r.checkout > corte);
}

export function hoyMx(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

// ── Feed de salida ──────────────────────────────────────────────────────────

function fechaFeed(f: string): string {
  return f.replace(/-/g, "");
}

function escapar(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export interface BloqueFeed {
  id: string;
  checkin: string;
  checkout: string;
}

/** El VCALENDAR que leen las OTAs para UNA unidad física. */
export function generarFeed(args: {
  slug: string;
  hotelNombre: string;
  unidad: string;
  bloques: BloqueFeed[];
}): string {
  const l: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kora//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(args.unidad)} - ${escapar(args.hotelNombre)}`,
    "X-WR-TIMEZONE:America/Mexico_City",
  ];
  for (const b of args.bloques) {
    if (!b.checkin || !b.checkout || b.checkout <= b.checkin) continue;
    l.push(
      "BEGIN:VEVENT",
      `UID:${b.id}-${args.slug}@kora-hotel.com`,
      `DTSTART;VALUE=DATE:${fechaFeed(b.checkin)}`,
      `DTEND;VALUE=DATE:${fechaFeed(b.checkout)}`,
      "SUMMARY:No disponible",
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  l.push("END:VCALENDAR");
  return l.join("\r\n");
}

// ── Choques (sobreventa) ────────────────────────────────────────────────────

/** Rangos nuevos que se cruzan con alguna reserva de Kora. Función pura. */
export function choquesNuevos(
  importados: Rango[],
  previos: Rango[],
  reservas: Rango[],
): Rango[] {
  const clave = (r: Rango) => `${r.checkin}|${r.checkout}`;
  const yaEstaban = new Set(previos.map(clave));
  return importados.filter(
    (r) =>
      !yaEstaban.has(clave(r)) &&
      reservas.some((k) => r.checkin < k.checkout && r.checkout > k.checkin),
  );
}

// ── Sincronización ──────────────────────────────────────────────────────────

export interface CanalFila {
  id: string;
  hotel_id: string;
  room_name: string | null;
  tipo: string | null;
  ical_url: string | null;
  ultima_sync?: string | null;
}

export interface ResultadoCanal {
  id: string;
  unidad: string;
  plataforma: string;
  bloqueos: number;
  choques: number;
  error?: string;
}

type Descargar = (url: string) => Promise<string>;

const descargarPorDefecto: Descargar = async (url) => {
  const res = await fetch(url.replace(/^webcal:\/\//i, "https://"), {
    headers: { "User-Agent": "Kora-Calendario/2.0 (+https://kora-hotel.com)" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const texto = await res.text();
  // Una página de login o de error con 200 NO es un calendario vacío: si se
  // tratara como tal, se borrarían todos los bloqueos de la OTA y la unidad
  // quedaría a la venta en Kora.
  if (!/BEGIN:VCALENDAR/i.test(texto)) throw new Error("la URL no devolvió un calendario iCal");
  return texto;
};

/**
 * Sincroniza UN canal. Si la descarga o el parseo fallan, los bloqueos que ya
 * había se quedan como estaban (no se borra nada) y el canal queda en 'error'.
 */
export async function sincronizarCanal(
  canal: CanalFila,
  opts: { descargar?: Descargar; hotelNombre?: string; avisoEmail?: () => Promise<string> } = {},
): Promise<ResultadoCanal> {
  const unidad = canal.room_name ?? "";
  const plataforma = canal.tipo ?? "booking_com";
  const fuente = fuenteDe(canal);
  try {
    if (!unidad || !canal.ical_url) throw new Error("canal sin unidad o sin URL");
    const texto = await (opts.descargar ?? descargarPorDefecto)(canal.ical_url);
    const rangos = parseIcal(texto);

    const supabase = createAdminClient();
    const hoy = hoyMx();
    const [previosRes, reservasRes] = await Promise.all([
      supabase
        .from("blocks")
        .select("checkin, checkout")
        .eq("hotel_id", canal.hotel_id)
        .eq("habitacion", unidad)
        .eq("status", "OTA")
        .eq("fuente_ota", fuente),
      supabase
        .from("blocks")
        .select("checkin, checkout")
        .eq("hotel_id", canal.hotel_id)
        .eq("habitacion", unidad)
        .eq("status", "RESERVADO")
        .gt("checkout", hoy),
    ]);

    const bloqueos = await updateOTABlocks(canal.hotel_id, unidad, fuente, rangos);
    await updateOTASyncResult(canal.hotel_id, canal.id, "ok", bloqueos);

    const choques = choquesNuevos(
      rangos,
      (previosRes.data ?? []) as Rango[],
      (reservasRes.data ?? []) as Rango[],
    );
    if (choques.length > 0) {
      await avisarSobreventa({
        hotelId: canal.hotel_id,
        hotelNombre: opts.hotelNombre ?? "tu hotel",
        unidad,
        plataforma: NOMBRE_PLATAFORMA[plataforma as PlataformaIcal] ?? plataforma,
        choques,
        avisoEmail: opts.avisoEmail,
      });
    }
    return { id: canal.id, unidad, plataforma, bloqueos, choques: choques.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[ical] ${canal.hotel_id}/${unidad}/${plataforma}:`, error);
    await updateOTASyncResult(canal.hotel_id, canal.id, "error", 0).catch(() => {});
    return { id: canal.id, unidad, plataforma, bloqueos: 0, choques: 0, error };
  }
}

async function avisarSobreventa(a: {
  hotelId: string;
  hotelNombre: string;
  unidad: string;
  plataforma: string;
  choques: Rango[];
  avisoEmail?: () => Promise<string>;
}): Promise<void> {
  try {
    const to = a.avisoEmail
      ? await a.avisoEmail()
      : await resolveHotelAvisoEmail({ id: a.hotelId });
    if (!to) return;
    const filas = a.choques.map((c) => ({
      k: a.unidad,
      v: `${esc(fechaLarga(c.checkin))} → ${esc(fechaLarga(c.checkout))}`,
    }));
    const html = doc(
      "Posible sobreventa",
      `${a.plataforma} tiene ocupadas noches que ya vendiste en Kora`,
      titulo("Posible sobreventa", `${esc(a.plataforma)} · ${esc(a.hotelNombre)}`) +
        parrafo(
          `El calendario de ${esc(a.plataforma)} trae noches ocupadas que en Kora ya tienen una reserva confirmada. Revisa las dos reservas y reubica o cancela una antes de que llegue el huésped.`,
        ) +
        tablaDatos(filas) +
        caja(
          "Suele pasar cuando las dos reservas entran antes de que la OTA vuelva a leer el calendario de Kora. Cada OTA lo lee a su ritmo (de 30 minutos a 3 horas).",
          "alerta",
        ),
    );
    await enviarEmail({
      to,
      subject: `⚠️ Posible sobreventa en ${a.unidad} (${a.plataforma})`,
      html,
    });
  } catch (e) {
    console.error("[ical] aviso de sobreventa:", e instanceof Error ? e.message : e);
  }
}

/** Corre `fn` sobre `items` con un máximo de `n` a la vez. */
async function enLotes<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

// Sin `etiqueta` a propósito: la sincronización no la necesita y así sigue
// funcionando aunque sql/kora-canales-ical.sql aún no se haya corrido.
const COLUMNAS = "id, hotel_id, room_name, tipo, ical_url, ultima_sync";

/** Sincroniza los canales activos de UN hotel. */
export async function sincronizarHotel(
  hotelId: string,
  opts: { soloSiVencido?: boolean } = {},
): Promise<ResultadoCanal[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ota_channels")
    .select(COLUMNAS)
    .eq("hotel_id", hotelId)
    .eq("active", true);
  if (error) throw new Error(`ota_channels: ${error.message}`);

  let canales = ((data ?? []) as CanalFila[]).filter((c) => c.ical_url && c.room_name);
  if (opts.soloSiVencido) {
    const limite = Date.now() - FRESCURA_MS;
    canales = canales.filter((c) => !c.ultima_sync || Date.parse(c.ultima_sync) < limite);
  }
  if (canales.length === 0) return [];

  const { data: hotel } = await supabase
    .from("hoteles")
    .select("id, nombre, owner_id, extras, config")
    .eq("id", hotelId)
    .maybeSingle();
  let correo: Promise<string> | null = null;
  const avisoEmail = () => (correo ??= hotel ? resolveHotelAvisoEmail(hotel) : Promise.resolve(""));

  return enLotes(canales, 6, (c) =>
    sincronizarCanal(c, { hotelNombre: hotel?.nombre ?? undefined, avisoEmail }),
  );
}

/** Sincroniza TODOS los canales activos de la plataforma (cron). */
export async function sincronizarTodos(): Promise<ResultadoCanal[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ota_channels")
    .select("hotel_id")
    .eq("active", true);
  if (error) throw new Error(`ota_channels: ${error.message}`);
  const hoteles = [...new Set(((data ?? []) as { hotel_id: string }[]).map((r) => r.hotel_id))];
  const porHotel = await enLotes(hoteles, 4, (h) =>
    sincronizarHotel(h).catch((e) => {
      console.error(`[ical] hotel ${h}:`, e instanceof Error ? e.message : e);
      return [] as ResultadoCanal[];
    }),
  );
  return porHotel.flat();
}

// Freno por instancia: en una búsqueda con mucho tráfico, varias peticiones a
// la vez verían el mismo calendario vencido y lo leerían todas.
const ultimoIntento = new Map<string, number>();
const FRENO_MS = 60_000;

/**
 * Refresco disparado por tráfico (una búsqueda de disponibilidad, abrir el
 * calendario del panel). Lee sólo los canales con más de 15 min y nunca más de
 * una vez por minuto por hotel en esta instancia. Pensado para ir dentro de
 * `after()`: no frena la respuesta.
 *
 * Existe porque en Vercel Hobby el cron sólo puede correr una vez al día; con
 * esto, un hotel con actividad tiene sus OTAs leídas como mucho cada 15 min.
 */
export async function refrescarSiHaceFalta(hotelId: string): Promise<void> {
  const ahora = Date.now();
  if (ahora - (ultimoIntento.get(hotelId) ?? 0) < FRENO_MS) return;
  ultimoIntento.set(hotelId, ahora);
  if (ultimoIntento.size > 2_000) ultimoIntento.clear();
  try {
    await sincronizarHotel(hotelId, { soloSiVencido: true });
  } catch (e) {
    console.warn("[ical] refresco por tráfico:", e instanceof Error ? e.message : e);
  }
}

/**
 * Antes de apartar una reserva: si algún canal del hotel lleva más de 15 min
 * sin leerse, se lee ya. Con tope de tiempo y SIN lanzar nunca — una OTA lenta
 * no puede tumbar una venta directa; en el peor caso se aparta con lo que había.
 */
export async function refrescarAntesDeApartar(hotelId: string, topeMs = 4_000): Promise<void> {
  try {
    await Promise.race([
      sincronizarHotel(hotelId, { soloSiVencido: true }),
      new Promise((r) => setTimeout(r, topeMs)),
    ]);
  } catch (e) {
    console.warn("[ical] refresco antes de apartar:", e instanceof Error ? e.message : e);
  }
}
