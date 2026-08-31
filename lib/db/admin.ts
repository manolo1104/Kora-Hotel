// Capa de datos del PANEL /admin sobre Supabase (multi-tenant). Portado de
// mi-hotel/lib/admin/sheets-admin.ts (Google Sheets) a @supabase/supabase-js v2.
//
// REGLAS:
//  - service-role (createAdminClient) salta RLS → el aislamiento lo da SIEMPRE
//    el filtro explícito .eq("hotel_id", hotelId).
//  - hotelId es SIEMPRE el primer parámetro; nunca se infiere del body.
//  - Los DTOs conservan los nombres/campos del origen, salvo que `rowIndex:number`
//    se reemplaza por `id:string` (uuid/text PK de la fila).
//
// SOLO servidor.

import { createBookingAtomic } from "@/lib/db/bookings";
import { reservaCuenta, type EstadoReserva } from "@/lib/booking/estado-reserva";
import { createAdminClient } from "@/lib/supabase/admin";
import { leer, escribir, escribirMejorEsfuerzo, DbError} from "@/lib/db/result";
import { generarConfirmacion } from "@/lib/db/bookings";
import { blockDates, unblock } from "@/lib/db/availability";

// ── HELPERS PUROS ───────────────────────────────────────────────────────────

/** Normaliza un total a número (acepta "$1,200 MXN" o number). Helper puro. */
function parseTotal(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return raw;
  if (raw == null) return 0;
  return parseInt(String(raw).replace(/[^0-9]/g, ""), 10) || 0;
}

/** Quita el sufijo "(X personas)" de un nombre de cuarto. Helper puro. */
function stripRoomSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

/** Divide un CSV de habitaciones en nombres limpios (sin sufijo "(Xp)"). Helper puro. */
export function splitRooms(habitacionesStr: string): string[] {
  return habitacionesStr
    .split(",")
    .map((r) => stripRoomSuffix(r))
    .filter(Boolean);
}

// ── TIPOS / DTOs ────────────────────────────────────────────────────────────

export interface AdminBooking {
  id: string; // antes rowIndex
  fecha: string;
  confirmacion: string;
  cliente: string;
  telefono: string;
  email: string;
  total: number;
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  habitaciones: string;
  notas: string;
  paymentId: string;
  estado: EstadoReserva;
  comoNosConocio: string;
  anticipo: number;
  origen: string; // "web" | "bot" | "manual" | "web-pago-hotel" | ...
  doc: Record<string, unknown>; // overrides del documento branded (editor "modificar antes de descargar")
  /** Idioma con el que reservó el huésped. Sin columna `lang` en la BD → "es". */
  lang: "es" | "en";
  /**
   * Cuándo salió de verdad el huésped ("" si sigue en casa).
   *
   * No se deduce de las fechas: un huésped puede irse antes de su fecha de
   * salida, y hasta que alguien lo registre el cuarto sigue apareciendo
   * ocupado y no se puede volver a vender. Ver sql/kora-checkout-real.sql.
   */
  checkoutReal: string;
}

export interface AdminQuote {
  id: string;
  fecha: string;
  cliente: string;
  telefono: string;
  email: string;
  suite: string;
  checkin: string;
  checkout: string;
  noches: number;
  precioTotal: number;
  estado: "BORRADOR" | "ENVIADA" | "ACEPTADA" | "EXPIRADA";
  notas: string;
  doc: Record<string, unknown>; // overrides del documento branded (editor "modificar antes de descargar")
}

export interface GuestStay {
  confirmacion: string;
  checkin: string;
  checkout: string;
  habitaciones: string;
  total: number;
  noches: number;
  huespedes: number;
}

export interface GuestProfile {
  email: string;
  nombre: string;
  telefono: string;
  totalReservas: number;
  totalGastado: number;
  ultimaEstancia: string;
  suitesFavoritas: string[];
  notas: string;
  historial: GuestStay[];
  waConversaciones: number;
}

export type RoomStatusType = "DISPONIBLE" | "OCUPADA" | "MANTENIMIENTO" | "LIMPIEZA";

export interface RoomStatus {
  suite: string;
  estado: RoomStatusType;
  notas: string;
  actualizacion: string;
}

export interface OTACalendar {
  id: string;
  roomName: string;
  platform: "booking_com" | "expedia";
  icalUrl: string;
  active: boolean;
  lastSync: string;
  status: "ok" | "error" | "pending";
  blocksFound: number;
}

// Filas crudas de Supabase (tipado de columnas) ──────────────────────────────

interface BookingRow {
  id: string;
  confirmacion: string | null;
  cliente: string | null;
  telefono: string | null;
  email: string | null;
  checkin: string | null;
  checkout: string | null;
  noches: number | null;
  huespedes: number | null;
  habitaciones: string | null;
  total: number | string | null;
  anticipo: number | string | null;
  payment_intent_id: string | null;
  estado: string | null;
  origen: string | null;
  como_nos_conocio: string | null;
  notas: string | null;
  created_at: string | null;
  doc?: Record<string, unknown> | null; // opcional: puede no existir la columna aún
  lang?: string | null; // idioma con el que reservó (opcional: columna nueva)
  /** Cuándo salió de verdad el huésped. Opcional: columna nueva (kora-checkout-real.sql). */
  checkout_real?: string | null;
}

interface QuoteRow {
  id: string;
  cliente: string | null;
  telefono: string | null;
  email: string | null;
  suite: string | null;
  checkin: string | null;
  checkout: string | null;
  noches: number | null;
  precio_total: number | string | null;
  estado: string | null;
  notas: string | null;
  created_at: string | null;
  doc?: Record<string, unknown> | null; // opcional: puede no existir la columna aún
}

interface RoomStatusRow {
  suite: string | null;
  estado: string | null;
  notas: string | null;
  updated_at: string | null;
}

interface OTAChannelRow {
  id: string;
  room_name: string | null;
  tipo: string | null;
  ical_url: string | null;
  active: boolean | null;
  ultima_sync: string | null;
  status: string | null;
  blocks_found: number | null;
}

// ── MAPEADORES fila → DTO ────────────────────────────────────────────────────

function mapBooking(r: BookingRow): AdminBooking {
  // REEMBOLSADA se colapsaba aquí en "CONFIRMADA" (K-42): el estado existe en la
  // base y el webhook lo escribe, pero el panel entero lo veía como una reserva
  // viva — dinero cobrado, cuarto ocupado y correos de "te esperamos".
  const estado: AdminBooking["estado"] =
    r.estado === "CANCELADA"
      ? "CANCELADA"
      : r.estado === "REEMBOLSADA"
        ? "REEMBOLSADA"
        : r.estado === "MANUAL"
          ? "MANUAL"
          : "CONFIRMADA";
  return {
    id: r.id,
    fecha: r.created_at ?? "",
    confirmacion: r.confirmacion ?? "",
    cliente: r.cliente ?? "",
    telefono: r.telefono ?? "",
    email: r.email ?? "",
    total: parseTotal(r.total),
    checkin: r.checkin ?? "",
    checkout: r.checkout ?? "",
    noches: r.noches ?? 0,
    huespedes: r.huespedes ?? 0,
    habitaciones: r.habitaciones ?? "",
    notas: r.notas ?? "",
    paymentId: r.payment_intent_id ?? "",
    comoNosConocio: r.como_nos_conocio ?? "",
    anticipo: parseTotal(r.anticipo),
    estado,
    origen: r.origen ?? "",
    doc: (r.doc ?? {}) as Record<string, unknown>,
    lang: r.lang === "en" ? "en" : "es",
    checkoutReal: r.checkout_real ?? "",
  };
}

/**
 * Marca que el huésped ya salió y libera su cuarto en el acto.
 *
 * Deliberadamente NO toca `estado`: la reserva sigue siendo válida (se cobró, se
 * cumplió) y su CHECK sólo admite CONFIRMADA/CANCELADA/MANUAL/REEMBOLSADA.
 * Lo único que cambia es que deja de ocupar el cuarto.
 *
 * Idempotente: si ya tenía check-out, devuelve la hora que ya tenía en vez de
 * pisarla — dos clics seguidos no reescriben la salida.
 */
export async function checkoutBooking(
  hotelId: string,
  confirmacion: string,
): Promise<{ ok: true; cuando: string; habitaciones: string[] } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data: fila, error: errLeer } = await supabase
    .from("bookings")
    .select("id, estado, habitaciones, checkout_real")
    .eq("hotel_id", hotelId)
    .eq("confirmacion", confirmacion)
    .maybeSingle();

  if (errLeer) {
    console.error("checkoutBooking leer:", errLeer.message);
    return { ok: false, error: "no-se-pudo-leer" };
  }
  if (!fila) return { ok: false, error: "no-encontrada" };

  const habitaciones = splitRooms(String(fila.habitaciones ?? ""));

  // Una cancelada o reembolsada ya no ocupa cuarto: no hay de dónde salir.
  if (!reservaCuenta(fila.estado)) return { ok: false, error: "reserva-sin-valor" };
  if (fila.checkout_real) {
    return { ok: true, cuando: String(fila.checkout_real), habitaciones };
  }

  const cuando = new Date().toISOString();
  const { error } = await supabase
    .from("bookings")
    .update({ checkout_real: cuando })
    .eq("id", fila.id)
    .eq("hotel_id", hotelId); // cinturón: nunca tocar la fila de otro hotel

  if (error) {
    console.error("checkoutBooking escribir:", error.message);
    return { ok: false, error: "no-se-pudo-guardar" };
  }
  return { ok: true, cuando, habitaciones };
}

/** Deshace un check-out hecho por error (el huésped no se había ido). */
export async function deshacerCheckout(
  hotelId: string,
  confirmacion: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ checkout_real: null })
    .eq("hotel_id", hotelId)
    .eq("confirmacion", confirmacion);
  if (error) {
    console.error("deshacerCheckout:", error.message);
    return false;
  }
  return true;
}

function mapQuote(r: QuoteRow): AdminQuote {
  return {
    id: r.id,
    fecha: r.created_at ?? "",
    cliente: r.cliente ?? "",
    telefono: r.telefono ?? "",
    email: r.email ?? "",
    suite: r.suite ?? "",
    checkin: r.checkin ?? "",
    checkout: r.checkout ?? "",
    noches: r.noches ?? 0,
    precioTotal: parseTotal(r.precio_total),
    estado: (r.estado ?? "BORRADOR") as AdminQuote["estado"],
    notas: r.notas ?? "",
    doc: (r.doc ?? {}) as Record<string, unknown>,
  };
}

function mapRoomStatus(r: RoomStatusRow): RoomStatus {
  return {
    suite: r.suite ?? "",
    estado: (r.estado ?? "DISPONIBLE") as RoomStatusType,
    notas: r.notas ?? "",
    actualizacion: r.updated_at ?? "",
  };
}

function mapOTACalendar(r: OTAChannelRow): OTACalendar {
  return {
    id: r.id,
    roomName: r.room_name ?? "",
    platform: (r.tipo ?? "booking_com") as OTACalendar["platform"],
    icalUrl: r.ical_url ?? "",
    active: r.active ?? false,
    lastSync: r.ultima_sync ?? "",
    status: (r.status ?? "pending") as OTACalendar["status"],
    blocksFound: r.blocks_found ?? 0,
  };
}

// ── RESERVAS ─────────────────────────────────────────────────────────────────

/** Todas las reservas del hotel (más recientes primero). */
export async function getAllBookings(hotelId: string): Promise<AdminBooking[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllBookings error:", error.message);
    return [];
  }
  return ((data ?? []) as BookingRow[]).map(mapBooking);
}

/**
 * Las reservas cuyo CHECK-OUT cae de `desde` en adelante.
 *
 * Para el cron de secuencias: sólo mira ventanas de hasta 45 días atrás, pero
 * usaba `getAllBookings`, que se baja el histórico ENTERO de cada hotel con
 * `select("*")` y sin límite. Con diez hoteles pasa desapercibido; con cien, o
 * con un hotel de dos años de reservas, es lo que hace que el cron se pase del
 * tiempo y no le escriba a nadie ese día — en silencio, porque un cron que no
 * termina no deja error, deja nada.
 */
export async function getBookingsDesde(hotelId: string, desde: string): Promise<AdminBooking[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("hotel_id", hotelId)
    .gte("checkout", desde)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getBookingsDesde error:", error.message);
    return [];
  }
  return ((data ?? []) as BookingRow[]).map(mapBooking);
}

/** El insert de `createManualBooking`, aparte para poder reintentarlo con folio nuevo. */
async function insertarReservaManual(
  supabase: ReturnType<typeof createAdminClient>,
  hotelId: string,
  confirmacion: string,
  data: {
    cliente: string;
    telefono: string;
    email: string;
    habitacion: string;
    checkin: string;
    checkout: string;
    noches: number;
    huespedes: number;
    total: number;
    notas: string;
    anticipo?: number;
  },
) {
  return supabase
    .from("bookings")
    .insert({
      hotel_id: hotelId,
      confirmacion,
      cliente: data.cliente,
      telefono: data.telefono,
      email: data.email,
      checkin: data.checkin,
      checkout: data.checkout,
      noches: data.noches,
      huespedes: data.huespedes,
      habitaciones: data.habitacion,
      total: data.total,
      anticipo: data.anticipo ?? 0,
      notas: data.notas,
      estado: "MANUAL",
      origen: "manual",
    })
    .select("id")
    .single();
}


/**
 * Alta manual de una reserva desde el panel. NO usa el RPC anti-overbooking
 * (el dueño la fuerza a propósito): inserta el booking (estado MANUAL, origen
 * 'manual') y, para reflejar ocupación, crea blocks 'RESERVADO' por cada cuarto
 * ligados a esta reserva (booking_id) — así cancelBooking puede liberarlos.
 * Devuelve la confirmación generada.
 */
export async function createManualBooking(
  hotelId: string,
  data: {
    cliente: string;
    telefono: string;
    email: string;
    habitacion: string; // CSV de cuartos
    checkin: string;
    checkout: string;
    noches: number;
    huespedes: number;
    total: number;
    notas: string;
    anticipo?: number;
  },
  prefijo?: string | null,
  opts?: { forzar?: boolean; forzadoPor?: string | null },
): Promise<ResultadoReservaManual> {
  const supabase = createAdminClient();
  // Prefijo de confirmación por hotel (hotel.prefijo_confirmacion). Si es NULL
  // (p. ej. Paraíso) generarConfirmacion cae a "KO". Antes estaba fijo en "PE-M"
  // → todos los hoteles emitían folios con prefijo de Paraíso.
  // El folio son 4 caracteres al azar: choca con el índice único
  // (hotel_id, confirmacion) más a menudo de lo que sugiere la intuición, y hoy
  // ese choque salía como el texto crudo de Postgres en la pantalla del
  // hotelero. Se reintenta con folio nuevo, igual que ya hace el webhook del
  // motor (app/api/h/webhooks/stripe/route.ts).
  const forzar = opts?.forzar === true;
  const rooms = splitRooms(data.habitacion);
  const notas = forzar ? notaDeReservaForzada(data.notas, opts?.forzadoPor) : data.notas;

  for (let intento = 0; intento < 3; intento++) {
    const confirmacion = generarConfirmacion(prefijo);

    // CAMINO NORMAL: el MISMO candado atómico que usa el motor web. Antes esto
    // era un `insert` suelto en `bookings` y otro en `blocks`: dos hoteleros
    // metiendo reservas a la vez —o uno a mano mientras entra una del motor—
    // podían vender el mismo cuarto dos veces sin que nada lo impidiera (K-12,
    // K-43). El RPC revalida el solape bajo el candado y crea reserva y
    // bloqueos en la misma transacción.
    if (!forzar) {
      const r = await createBookingAtomic(hotelId, {
        habitaciones: rooms,
        checkin: data.checkin,
        checkout: data.checkout,
        confirmacion,
        cliente: data.cliente,
        telefono: data.telefono,
        email: data.email,
        total: data.total,
        anticipo: data.anticipo ?? 0,
        huespedes: data.huespedes,
        notas,
        estado: "MANUAL",
        origen: "manual",
        paymentIntentId: null,
      });
      if (r.ok) return { ok: true, confirmacion: r.confirmacion ?? confirmacion };
      if (r.unavailable) return { ok: false, unavailable: true, error: r.error };
      // Folio repetido: se reintenta con otro. Cualquier otro error se devuelve.
      if (!/duplicate key|confirmacion/i.test(r.error ?? "")) {
        return { ok: false, error: r.error };
      }
      continue;
    }

    // CAMINO FORZADO: el hotelero pidió explícitamente meter la reserva encima
    // de otra (huésped que comparte cuarto, cambio de última hora). Se salta el
    // candado a propósito, pero NUNCA en silencio: queda escrito en las notas de
    // la reserva quién lo hizo y cuándo, que es lo que permite reconstruir
    // después por qué había dos personas en la misma cabaña.
    const { data: inserted, error } = await insertarReservaManual(
      supabase, hotelId, confirmacion, { ...data, notas },
    );
    if (error) {
      if (/duplicate key|confirmacion/i.test(error.message)) continue;
      return { ok: false, error: error.message };
    }
    const bookingId = (inserted as { id: string } | null)?.id;
    if (!bookingId) return { ok: false, error: "no se pudo crear la reserva" };

    if (rooms.length > 0) {
      // La reserva ya existe; si su bloqueo no queda, el cuarto sigue en venta y
      // se vuelve a vender. Lanza y la ruta responde 500.
      await escribir("blocks.reservaManual", supabase.from("blocks").insert(
        rooms.map((habitacion) => ({
          hotel_id: hotelId,
          habitacion,
          checkin: data.checkin,
          checkout: data.checkout,
          status: "RESERVADO",
          booking_id: bookingId,
        })),
      ));
    }
    return { ok: true, confirmacion };
  }

  return { ok: false, error: "no se pudo generar un folio libre" };
}

/** Resultado de meter una reserva a mano desde el panel. */
export interface ResultadoReservaManual {
  ok: boolean;
  confirmacion?: string;
  /** El cuarto ya estaba ocupado en esas fechas (y no se pidió forzar). */
  unavailable?: boolean;
  error?: string;
}

/** Marca en las notas que esta reserva se metió encima de otra a propósito. */
function notaDeReservaForzada(notas: string | undefined, quien?: string | null): string {
  const sello =
    `⚠️ Reserva FORZADA sobre un cuarto ya ocupado el ` +
    `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC` +
    `${quien ? ` por ${quien}` : ""}.`;
  const previo = (notas ?? "").trim();
  return previo ? `${previo}\n${sello}` : sello;
}

/**
 * Los ÚNICOS campos de una reserva que el panel puede editar. Cualquier otra
 * clave del body se ignora — en particular `hotel_id`, `id` y `confirmacion`.
 */
const CAMPOS_EDITABLES = [
  "cliente",
  "telefono",
  "email",
  "checkin",
  "checkout",
  "noches",
  "huespedes",
  "total",
  "habitaciones",
  "notas",
  "estado",
  "anticipo",
] as const;

/** Edita campos de una reserva (por id, dentro del hotel). */
export async function updateBooking(
  hotelId: string,
  id: string,
  changes: Partial<{
    cliente: string;
    telefono: string;
    email: string;
    checkin: string;
    checkout: string;
    noches: number;
    huespedes: number;
    total: number;
    habitaciones: string;
    notas: string;
    estado: string;
    anticipo: number;
  }>,
): Promise<ResultadoEdicion> {
  const supabase = createAdminClient();
  // LISTA BLANCA, no `Object.entries(changes)`.
  //
  // El `Partial<{…}>` del parámetro es SÓLO TypeScript: en tiempo de ejecución
  // el bucle copiaba CUALQUIER clave del body a la fila. El `.eq("hotel_id",…)`
  // de abajo acota el WHERE, pero no el SET, así que un
  // `PATCH {"hotel_id":"<otro-hotel>"}` movía la reserva —con su dinero y los
  // datos del huésped— al hotel del atacante, y dejaba sus `blocks` huérfanos.
  const patch: Record<string, string | number> = {};
  for (const campo of CAMPOS_EDITABLES) {
    const value = (changes as Record<string, unknown>)[campo];
    if (value === undefined) continue;
    patch[campo] = value as string | number;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  // Los valores ANTERIORES de justo los campos que se van a tocar. Hacen falta
  // porque la fila se escribe ANTES de re-sincronizar la ocupación (el RPC lee
  // la reserva ya editada para saber qué revalidar). Si esa revalidación dice
  // que el cuarto nuevo está ocupado, hay que devolver la fila a como estaba: si
  // no, la reserva se quedaría con las fechas nuevas y los bloqueos con las
  // viejas, que es la incoherencia que este paso viene a eliminar.
  const tocaOcupacion =
    patch.checkin !== undefined || patch.checkout !== undefined || patch.habitaciones !== undefined;
  let previo: Record<string, unknown> | null = null;
  if (tocaOcupacion) {
    const fila = await leer<Record<string, unknown>>(
      "bookings.antesDeEditar",
      supabase
        .from("bookings")
        .select(Object.keys(patch).join(", "))
        .eq("hotel_id", hotelId)
        .eq("id", id)
        .maybeSingle(),
    );
    if (fila) previo = fila;
  }

  // Antes: `if (error) { console.error(...); return; }` — la ruta respondía
  // {ok:true} igual y el hotelero veía su cambio "guardado" hasta que recargaba.
  await escribir("bookings.editar", supabase
    .from("bookings")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id));

  // Si cambiaron fechas o cuartos, re-sincronizar los bloqueos RESERVADO (ligados
  // por booking_id) para que la disponibilidad refleje los nuevos datos. Sin esto,
  // las fechas viejas quedan ocupadas y las nuevas libres (riesgo de sobreventa).
  // Ahora es ATÓMICO: ver `resyncBlocksDeReserva` justo debajo.
  if (tocaOcupacion) {
    const resync = await resyncBlocksDeReserva(supabase, hotelId, id);
    if (!resync.ok && previo) {
      // Deshacer la edición. Lanza si falla: dejar la reserva con las fechas
      // nuevas y los bloqueos con las viejas es peor que un error en pantalla.
      await escribir("bookings.deshacerEdicion", supabase
        .from("bookings")
        .update(previo)
        .eq("hotel_id", hotelId)
        .eq("id", id));
    }
    return resync;
  }
  return { ok: true };
}

/** Resultado de editar una reserva: `unavailable` = el cuarto nuevo está ocupado. */
export interface ResultadoEdicion {
  ok: boolean;
  unavailable?: boolean;
  error?: string;
}

/** Códigos de "esa función no existe en esta base" (Postgres y PostgREST). */
const RPC_AUSENTE = new Set(["42883", "PGRST202"]);
let yaAvisadoSinResync = false;

/**
 * Repone los `blocks RESERVADO` de una reserva tras editarla.
 *
 * Lo hace el RPC `resync_blocks_reserva`: borra y repone en la MISMA
 * transacción y bajo el mismo candado que `crear_reserva_atomica`. Si el cuarto
 * nuevo ya está ocupado, lanza y el rollback deja los bloqueos VIEJOS intactos.
 *
 * El camino de abajo —DELETE y luego INSERT, sueltos— es el que había, y es el
 * defecto (K-45, K-46): borra primero y decide después con qué reconstruir. Si
 * la lectura intermedia falla, queda una reserva CONFIRMADA viva con su cuarto
 * LIBRE en el calendario, para siempre, hasta que dos huéspedes llegan a la
 * misma cabaña. Se conserva SÓLO como respaldo mientras la función no exista en
 * la base, y avisando: sin él, editar fechas dejaría de funcionar entero.
 */
async function resyncBlocksDeReserva(
  supabase: ReturnType<typeof createAdminClient>,
  hotelId: string,
  id: string,
): Promise<ResultadoEdicion> {
  const { error } = await supabase.rpc("resync_blocks_reserva", {
    p_hotel_id: hotelId,
    p_booking_id: id,
  });
  if (!error) return { ok: true };

  if (/CUARTO_NO_DISPONIBLE/.test(error.message)) {
    // La ocupación vieja sigue en pie: el rollback la conservó.
    return { ok: false, unavailable: true, error: error.message };
  }
  if (!RPC_AUSENTE.has(error.code ?? "")) {
    throw new DbError("blocks.resync", error.message, error.code);
  }

  if (!yaAvisadoSinResync) {
    yaAvisadoSinResync = true;
    console.warn(
      "[blocks] falta la funcion `resync_blocks_reserva`: al editar una reserva se " +
        "borra su ocupacion ANTES de saber si se puede reponer. Corre " +
        "sql/kora-inventario-fase4.sql.",
    );
  }

    const row = await leer<{
      checkin: string | null;
      checkout: string | null;
      habitaciones: string | null;
      estado: string | null;
    }>(
      "bookings.trasEditar",
      supabase
        .from("bookings")
        .select("checkin, checkout, habitaciones, estado")
        .eq("hotel_id", hotelId)
        .eq("id", id)
        .maybeSingle(),
    );
    await escribir(
      "blocks.resyncBorrar",
      supabase.from("blocks").delete().eq("hotel_id", hotelId).eq("booking_id", id),
    );
    // Una reserva reembolsada tampoco debe volver a bloquear su cuarto.
    if (row && reservaCuenta(row.estado) && row.checkin && row.checkout) {
      const rooms = String(row.habitaciones || "")
        .split(",")
        .map((r) => r.replace(/\s*\([^)]*\)/g, "").trim())
        .filter(Boolean);
      if (rooms.length) {
        await escribir("blocks.resyncInsertar", supabase.from("blocks").insert(
          rooms.map((habitacion) => ({
            hotel_id: hotelId,
            habitacion,
            checkin: row.checkin,
            checkout: row.checkout,
            status: "RESERVADO",
            booking_id: id,
          })),
        ));
      }
    }
  return { ok: true };
}

/**
 * Cancela una reserva: estado='CANCELADA' y borra los blocks ligados (por
 * booking_id) para liberar disponibilidad.
 */
export async function cancelBooking(hotelId: string, id: string): Promise<void> {
  const supabase = createAdminClient();

  await escribir("bookings.cancelar", supabase
    .from("bookings")
    .update({ estado: "CANCELADA" })
    .eq("hotel_id", hotelId)
    .eq("id", id));

  // Libera la disponibilidad: borra los bloqueos de esta reserva. Si esto se
  // pierde, el cuarto queda ocupado por una reserva que ya no existe — el hotel
  // deja de poder venderlo y nadie sabe por qué.
  await escribir(
    "blocks.liberarPorCancelacion",
    supabase.from("blocks").delete().eq("hotel_id", hotelId).eq("booking_id", id),
  );
}

// ── BLOQUEOS (DISPONIBILIDAD) ────────────────────────────────────────────────

/**
 * Bloquea fechas para uno o varios cuartos (CSV) desde el panel.
 * Reusa blockDates() de lib/db/availability (status 'BLOQUEADO').
 */
export async function blockRooms(
  hotelId: string,
  habitacionesStr: string,
  checkin: string,
  checkout: string,
): Promise<void> {
  const rooms = splitRooms(habitacionesStr);
  if (rooms.length === 0) return;
  await blockDates(hotelId, rooms, checkin, checkout, "BLOQUEADO");
}

/**
 * Desbloquea fechas para uno o varios cuartos (CSV): borra los blocks
 * 'BLOQUEADO' que solapen con el rango pedido.
 */
export async function unblockRooms(
  hotelId: string,
  habitacionesStr: string,
  checkin: string,
  checkout: string,
): Promise<void> {
  const rooms = splitRooms(habitacionesStr);
  if (rooms.length === 0) return;
  const supabase = createAdminClient();
  // Solape half-open: b.checkin < checkout AND checkin < b.checkout.
  await escribir("blocks.desbloquear", supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("status", "BLOQUEADO")
    .in("habitacion", rooms)
    .lt("checkin", checkout)
    .gt("checkout", checkin));
}

/** Desbloqueo puntual de un block por id (reusa unblock de availability). */
export async function unblockById(hotelId: string, blockId: string): Promise<{ ok: boolean }> {
  return unblock(hotelId, blockId);
}

// ── COTIZACIONES ──────────────────────────────────────────────────────────────

/** Todas las cotizaciones del hotel (más recientes primero). */
export async function getAllQuotes(hotelId: string): Promise<AdminQuote[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getAllQuotes error:", error.message);
    return [];
  }
  return ((data ?? []) as QuoteRow[]).map(mapQuote);
}

/** Una cotización por id (dentro del hotel). */
export async function getQuote(hotelId: string, id: string): Promise<AdminQuote | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getQuote error:", error.message);
    return null;
  }
  return data ? mapQuote(data as QuoteRow) : null;
}

/** Genera un id de cotización tipo "Q-3F9KZ2". Helper puro. */
function generarQuoteId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `Q-${s}`;
}

/** Crea una cotización (estado inicial BORRADOR). Devuelve su id. */
export async function createQuote(
  hotelId: string,
  data: Omit<AdminQuote, "id" | "fecha" | "estado" | "doc">,
): Promise<string> {
  const supabase = createAdminClient();
  const id = generarQuoteId();
  const { error } = await supabase.from("quotes").insert({
    id,
    hotel_id: hotelId,
    cliente: data.cliente,
    telefono: data.telefono,
    email: data.email,
    suite: data.suite,
    checkin: data.checkin,
    checkout: data.checkout,
    noches: data.noches,
    precio_total: data.precioTotal,
    estado: "BORRADOR",
    notas: data.notas,
  });
  if (error) throw new Error(`createQuote error: ${error.message}`);
  return id;
}

/** Edita campos de una cotización (por id, dentro del hotel). */
export async function updateQuote(
  hotelId: string,
  id: string,
  changes: Partial<{
    cliente: string;
    telefono: string;
    email: string;
    suite: string;
    checkin: string;
    checkout: string;
    noches: number;
    precioTotal: number;
    estado: AdminQuote["estado"];
    notas: string;
  }>,
): Promise<void> {
  const supabase = createAdminClient();
  // Mapeo DTO → columna (solo precioTotal cambia de nombre).
  const patch: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    const col = key === "precioTotal" ? "precio_total" : key;
    patch[col] = value as string | number;
  }
  if (Object.keys(patch).length === 0) return;

  await escribir("quotes.editar", supabase
    .from("quotes")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id));
}

/** Cambia solo el estado de una cotización. */
export async function updateQuoteStatus(
  hotelId: string,
  id: string,
  estado: AdminQuote["estado"],
): Promise<void> {
  const supabase = createAdminClient();
  await escribir("quotes.estado", supabase
    .from("quotes")
    .update({ estado })
    .eq("hotel_id", hotelId)
    .eq("id", id));
}

/** Elimina una cotización (por id, dentro del hotel). */
export async function deleteQuote(hotelId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  await escribir("quotes.borrar", supabase
    .from("quotes")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("id", id));
}

// ── DOCUMENTOS BRANDED (overrides del editor "modificar antes de descargar") ──

/** Guarda los overrides del documento de una COTIZACIÓN en la columna `doc`.
 *  Falla explícito si la columna aún no existe (correr sql/kora-documentos.sql). */
export async function saveQuoteDoc(
  hotelId: string,
  id: string,
  doc: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quotes")
    .update({ doc })
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) {
    console.error("saveQuoteDoc error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Guarda los overrides del documento de una RESERVA (por confirmación) en `doc`. */
export async function saveBookingDoc(
  hotelId: string,
  confirmacion: string,
  doc: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ doc })
    .eq("hotel_id", hotelId)
    .eq("confirmacion", confirmacion);
  if (error) {
    console.error("saveBookingDoc error:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── CRM ───────────────────────────────────────────────────────────────────────

/** Notas por email del hotel → Record<emailLowercase, notas>. */
export async function getGuestNotes(hotelId: string): Promise<Record<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guest_notes")
    .select("email, notas")
    .eq("hotel_id", hotelId);
  if (error) {
    console.error("getGuestNotes error:", error.message);
    return {};
  }
  const result: Record<string, string> = {};
  for (const row of (data ?? []) as { email: string | null; notas: string | null }[]) {
    if (row.email) result[row.email.toLowerCase()] = row.notas ?? "";
  }
  return result;
}

/** Guarda/actualiza la nota de un huésped (upsert por hotel_id+email). */
export async function saveGuestNote(
  hotelId: string,
  email: string,
  notas: string,
): Promise<void> {
  const supabase = createAdminClient();
  await escribir("guest_notes.guardar", supabase
    .from("guest_notes")
    .upsert(
      { hotel_id: hotelId, email, notas, updated_at: new Date().toISOString() },
      { onConflict: "hotel_id,email" },
    ));
}

/**
 * Reconstruye el CRM EN MEMORIA: agrupa las reservas por email y le pega la nota
 * de guest_notes. Mismo algoritmo que el origen (helper en memoria).
 */
export async function buildCRM(hotelId: string): Promise<GuestProfile[]> {
  const [bookings, notas] = await Promise.all([
    getAllBookings(hotelId),
    getGuestNotes(hotelId),
  ]);

  const map = new Map<string, GuestProfile>();

  for (const b of bookings) {
    if (!b.email || b.email === "N/A") continue;
    const key = b.email.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        email: b.email,
        nombre: b.cliente,
        telefono: b.telefono,
        totalReservas: 0,
        totalGastado: 0,
        ultimaEstancia: "",
        suitesFavoritas: [],
        notas: "",
        historial: [],
        waConversaciones: 0,
      });
    }
    const g = map.get(key)!;
    g.totalReservas++;
    g.totalGastado += b.total;
    if (!g.ultimaEstancia || b.checkin > g.ultimaEstancia) g.ultimaEstancia = b.checkin;
    if (b.habitaciones && !g.suitesFavoritas.includes(b.habitaciones)) {
      g.suitesFavoritas.push(b.habitaciones);
    }
    // OJO: `totalGastado` y `totalReservas` de arriba SÍ siguen sumando las
    // canceladas y las reembolsadas. Es un defecto aparte —viene de antes y no
    // es el K-42— y tocarlo cambia el significado de una cifra que el hotelero
    // ya lee así. Aquí sólo se arregla el historial, que es lo que este paso
    // sí cubre.
    if (reservaCuenta(b.estado)) {
      g.historial.push({
        confirmacion: b.confirmacion,
        checkin: b.checkin,
        checkout: b.checkout,
        habitaciones: b.habitaciones,
        total: b.total,
        noches: b.noches,
        huespedes: b.huespedes,
      });
    }
  }

  // Historial por fecha desc.
  for (const g of map.values()) {
    g.historial.sort((a, b) => b.checkin.localeCompare(a.checkin));
  }

  // Pegar notas.
  for (const [email, nota] of Object.entries(notas)) {
    const profile = map.get(email.toLowerCase());
    if (profile) profile.notas = nota;
  }

  return Array.from(map.values()).sort((a, b) => b.totalGastado - a.totalGastado);
}

// ── ROOM STATUS ───────────────────────────────────────────────────────────────

/**
 * Estados de cuarto del hotel. NO hay lista hardcodeada de cuartos en
 * multi-tenant: devolvemos solo lo que exista en room_statuses (lista vacía si
 * no hay). Los cuartos vienen del hotel.
 */
export async function getRoomStatuses(hotelId: string): Promise<RoomStatus[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("room_statuses")
    .select("suite, estado, notas, updated_at")
    .eq("hotel_id", hotelId);
  if (error) {
    console.error("getRoomStatuses error:", error.message);
    return [];
  }
  return ((data ?? []) as RoomStatusRow[]).map(mapRoomStatus);
}

/** Fija el estado de un cuarto (upsert por hotel_id+suite). */
export async function setRoomStatus(
  hotelId: string,
  suite: string,
  estado: RoomStatusType,
  notas = "",
): Promise<void> {
  const supabase = createAdminClient();
  await escribir("room_status.fijar", supabase
    .from("room_statuses")
    .upsert(
      { hotel_id: hotelId, suite, estado, notas, updated_at: new Date().toISOString() },
      { onConflict: "hotel_id,suite" },
    ));
}

// ── OPERACIONES: LIMPIEZA ──────────────────────────────────────────────────────

export type CleaningTaskEstado = "PENDIENTE" | "HECHA";

export interface CleaningTask {
  id: string;
  suite: string;
  fecha: string;
  estado: CleaningTaskEstado;
  asignado: string;
  notas: string;
}

interface CleaningTaskRow {
  id: string;
  suite: string | null;
  fecha: string | null;
  estado: string | null;
  asignado: string | null;
  notas: string | null;
}

function mapCleaningTask(r: CleaningTaskRow): CleaningTask {
  return {
    id: r.id,
    suite: r.suite ?? "",
    fecha: r.fecha ?? "",
    estado: (r.estado ?? "PENDIENTE") as CleaningTaskEstado,
    asignado: r.asignado ?? "",
    notas: r.notas ?? "",
  };
}

/** Tareas de limpieza del hotel. */
export async function getCleaningTasks(hotelId: string): Promise<CleaningTask[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select("id, suite, fecha, estado, asignado, notas")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getCleaningTasks error:", error.message);
    return [];
  }
  return ((data ?? []) as CleaningTaskRow[]).map(mapCleaningTask);
}

/** Crea una tarea de limpieza. Devuelve su id. */
export async function createCleaningTask(
  hotelId: string,
  data: { suite: string; fecha: string; asignado?: string; notas?: string },
): Promise<string> {
  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("cleaning_tasks")
    .insert({
      hotel_id: hotelId,
      suite: data.suite,
      fecha: data.fecha,
      estado: "PENDIENTE",
      asignado: data.asignado ?? "",
      notas: data.notas ?? "",
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(`createCleaningTask error: ${error?.message ?? "sin id"}`);
  return (inserted as { id: string }).id;
}

/** Edita una tarea de limpieza (estado/asignado/notas). */
export async function updateCleaningTask(
  hotelId: string,
  id: string,
  changes: Partial<{ estado: CleaningTaskEstado; asignado: string; notas: string }>,
): Promise<void> {
  const supabase = createAdminClient();
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    patch[key] = value as string;
  }
  if (Object.keys(patch).length === 0) return;
  await escribir("limpieza.actualizar", supabase
    .from("cleaning_tasks")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id));
}

// ── OPERACIONES: MANTENIMIENTO ─────────────────────────────────────────────────

export type MaintenanceEstado = "ABIERTA" | "EN_PROCESO" | "CERRADA";
export type MaintenancePrioridad = "baja" | "media" | "alta";

export interface MaintenanceTask {
  id: string;
  suite: string;
  titulo: string;
  estado: MaintenanceEstado;
  prioridad: MaintenancePrioridad;
  notas: string;
}

interface MaintenanceTaskRow {
  id: string;
  suite: string | null;
  titulo: string | null;
  estado: string | null;
  prioridad: string | null;
  notas: string | null;
}

function mapMaintenanceTask(r: MaintenanceTaskRow): MaintenanceTask {
  return {
    id: r.id,
    suite: r.suite ?? "",
    titulo: r.titulo ?? "",
    estado: (r.estado ?? "ABIERTA") as MaintenanceEstado,
    prioridad: (r.prioridad ?? "media") as MaintenancePrioridad,
    notas: r.notas ?? "",
  };
}

/** Tareas de mantenimiento del hotel. */
export async function getMaintenanceTasks(hotelId: string): Promise<MaintenanceTask[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("maintenance_tasks")
    .select("id, suite, titulo, estado, prioridad, notas")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMaintenanceTasks error:", error.message);
    return [];
  }
  return ((data ?? []) as MaintenanceTaskRow[]).map(mapMaintenanceTask);
}

/** Crea una tarea de mantenimiento. Devuelve su id. */
export async function createMaintenanceTask(
  hotelId: string,
  data: {
    suite: string;
    titulo: string;
    prioridad?: MaintenancePrioridad;
    notas?: string;
  },
): Promise<string> {
  const supabase = createAdminClient();
  const { data: inserted, error } = await supabase
    .from("maintenance_tasks")
    .insert({
      hotel_id: hotelId,
      suite: data.suite,
      titulo: data.titulo,
      estado: "ABIERTA",
      prioridad: data.prioridad ?? "media",
      notas: data.notas ?? "",
    })
    .select("id")
    .single();
  if (error || !inserted)
    throw new Error(`createMaintenanceTask error: ${error?.message ?? "sin id"}`);
  return (inserted as { id: string }).id;
}

/** Edita una tarea de mantenimiento (estado/prioridad/notas/titulo). */
export async function updateMaintenanceTask(
  hotelId: string,
  id: string,
  changes: Partial<{
    estado: MaintenanceEstado;
    prioridad: MaintenancePrioridad;
    titulo: string;
    notas: string;
  }>,
): Promise<void> {
  const supabase = createAdminClient();
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    patch[key] = value as string;
  }
  if (Object.keys(patch).length === 0) return;
  await escribir("mantenimiento.actualizar", supabase
    .from("maintenance_tasks")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id));
}

// ── OTA CALENDARS ─────────────────────────────────────────────────────────────

/** Canales OTA configurados del hotel. */
export async function getAllOTACalendars(hotelId: string): Promise<OTACalendar[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ota_channels")
    .select("*")
    .eq("hotel_id", hotelId);
  if (error) {
    console.error("getAllOTACalendars error:", error.message);
    return [];
  }
  return ((data ?? []) as OTAChannelRow[]).map(mapOTACalendar);
}

/**
 * Crea o actualiza un canal OTA (upsert por id). Al guardar resetea el estado de
 * sync (status 'pending', sin ultima_sync, blocks_found 0), igual que el origen.
 */
export async function saveOTACalendar(
  hotelId: string,
  cal: Omit<OTACalendar, "lastSync" | "status" | "blocksFound">,
): Promise<void> {
  const supabase = createAdminClient();
  await escribir("ota.guardarCalendario", supabase.from("ota_channels").upsert(
    {
      id: cal.id,
      hotel_id: hotelId,
      room_name: cal.roomName,
      tipo: cal.platform,
      ical_url: cal.icalUrl,
      active: cal.active,
      ultima_sync: null,
      status: "pending",
      blocks_found: 0,
    },
    { onConflict: "id" },
  ));
}

/** Registra el resultado de una sincronización iCal. */
export async function updateOTASyncResult(
  hotelId: string,
  id: string,
  status: "ok" | "error",
  blocksFound: number,
): Promise<void> {
  const supabase = createAdminClient();
  await escribir("ota.resultadoSync", supabase
    .from("ota_channels")
    .update({
      ultima_sync: new Date().toISOString(),
      status,
      blocks_found: blocksFound,
    })
    .eq("hotel_id", hotelId)
    .eq("id", id));
}

/** Elimina un canal OTA (por id, dentro del hotel). */
export async function deleteOTACalendar(hotelId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  await escribir("ota.borrarCalendario", supabase
    .from("ota_channels")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("id", id));
}

// ── CONFIG / BOT (columna jsonb `config` del hotel) ────────────────────────────

// TODO Fase 6: leer/escribir bot_enabled en la columna jsonb `config` de la tabla
// `hotels` cuando el panel pase el hotel. Por ahora, sin acceso garantizado a esa
// columna desde aquí, devolvemos defaults seguros. NO se crea dependencia a Sheets.

/** Estado del bot. Default: encendido (true). */
export async function getBotStatus(hotelId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hoteles")
    .select("config")
    .eq("id", hotelId)
    .maybeSingle();
  if (error || !data) return true; // default: encendido
  const config = (data as { config: Record<string, unknown> | null }).config;
  const value = config?.bot_enabled;
  return value === undefined ? true : value !== false;
}

/** Enciende/apaga el bot escribiendo en config.bot_enabled del hotel. */
export async function setBotStatus(hotelId: string, enabled: boolean): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hoteles")
    .select("config")
    .eq("id", hotelId)
    .maybeSingle();
  if (error) {
    console.error("setBotStatus read error:", error.message);
    return;
  }
  const current = ((data as { config: Record<string, unknown> | null } | null)?.config) ?? {};
  const next = { ...current, bot_enabled: enabled };
  const { error: updErr } = await supabase
    .from("hoteles")
    .update({ config: next })
    .eq("id", hotelId);
  if (updErr) console.error("setBotStatus write error:", updErr.message);
}

/** Entrenamiento de Camila que el hotel edita en el panel (vive en extras.bot). */
export interface BotTrainingInput {
  nombre?: string;
  tono?: string;
  saludo?: string;
  instrucciones?: string;
  escalarWhatsapp?: string;
  pago?: {
    titular?: string;
    banco?: string;
    clabe?: string;
    cuenta?: string;
    notas?: string;
  };
  emojis?: {
    nivel?: "nada" | "bajo" | "medio" | "alto";
    preferidos?: string;
  };
  faqs?: { q: string; a: string }[];
}

/**
 * Guarda la configuración/entrenamiento del bot: on/off e idioma en la columna
 * `config`, y el entrenamiento en `extras.bot`. Relee fresco justo antes de
 * escribir y hace merge no-destructivo para no pisar otras claves del panel.
 */
export async function saveBotConfig(
  hotelId: string,
  input: {
    enabled?: boolean;
    lang?: "es" | "en";
    adminPhone?: string; // número autorizado para apagar/encender por WhatsApp (config.bot_admin_phone)
    probadoAt?: string; // marca "ya probé el bot" (extras.bot.probadoAt) — NO toca entrenadoAt
    prueba?: boolean; // una interacción de prueba exitosa: incrementa extras.bot.pruebas
    bot?: BotTrainingInput;
  },
): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hoteles")
    .select("config, extras")
    .eq("id", hotelId)
    .maybeSingle();
  if (error) {
    console.error("saveBotConfig read error:", error.message);
    return;
  }
  const row = data as {
    config: Record<string, unknown> | null;
    extras: Record<string, unknown> | null;
  } | null;
  const config = { ...(row?.config ?? {}) };
  const extras = { ...(row?.extras ?? {}) };
  if (input.enabled !== undefined) config.bot_enabled = input.enabled;
  if (input.lang) config.bot_lang = input.lang;
  if (input.adminPhone !== undefined) config.bot_admin_phone = input.adminPhone;
  if (input.bot || input.probadoAt !== undefined || input.prueba) {
    const prev = (extras.bot as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...prev };
    // Guardar entrenamiento marca entrenadoAt; probar el bot solo marca probadoAt.
    if (input.bot) Object.assign(merged, input.bot, { entrenadoAt: new Date().toISOString() });
    if (input.probadoAt !== undefined) merged.probadoAt = input.probadoAt;
    // Criterio honesto de "probada": cuenta interacciones de prueba exitosas
    // (chat demo o verificador) y solo marca probadoAt al llegar a 3.
    if (input.prueba) {
      const pruebas = (Number(merged.pruebas) || 0) + 1;
      merged.pruebas = pruebas;
      if (pruebas >= 3 && !merged.probadoAt) merged.probadoAt = new Date().toISOString();
    }
    extras.bot = merged;
  }
  const { error: updErr } = await supabase
    .from("hoteles")
    .update({ config, extras })
    .eq("id", hotelId);
  if (updErr) console.error("saveBotConfig write error:", updErr.message);
}

// ── AGENT METRICS (tabla agent_activity — sql/kora-agent-activity.sql) ────────

export type AgentActivityType =
  | "whatsapp_conv"
  | "whatsapp_reserva"
  | "resena_capturada"
  | "email_confirmacion"
  | "email_preestancia"
  | "email_postestancia"
  | "blog_publicado"
  | "cotizacion_auto_enviada";

export interface AgentMetric {
  tipo: string;
  fecha: string;
  detalle: string;
}

/** Día actual en zona México — las métricas de agentes se agrupan por día local. */
function hoyMX(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

// Registra una actividad de agente. FAIL-SAFE por diseño: una métrica nunca
// debe tumbar el flujo que la emite — si la tabla no existe todavía (ver
// sql/kora-agent-activity.sql) solo se registra el error y se sigue.
// `dedupe` evita contar dos veces el mismo detalle el mismo día (p. ej. la
// misma conversación de WhatsApp consultando el API varias veces).
export async function logAgentActivity(
  hotelId: string,
  tipo: AgentActivityType,
  detalle = "",
  dedupe = false,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const fecha = hoyMX();
    if (dedupe && detalle) {
      const yaHay = await leer<{ id: string }[]>(
        "agent_activity.dedupe",
        supabase
          .from("agent_activity")
          .select("id")
          .eq("hotel_id", hotelId)
          .eq("tipo", tipo)
          .eq("fecha", fecha)
          .eq("detalle", detalle)
          .limit(1),
      );
      if (yaHay && yaHay.length > 0) return;
    }
    await escribirMejorEsfuerzo(
      "agent_activity.registrar",
      supabase.from("agent_activity").insert({ hotel_id: hotelId, tipo, fecha, detalle }),
    );
  } catch (e) {
    console.error("logAgentActivity:", e);
  }
}

// Actividad del último año (tope defensivo de filas). FAIL-SAFE: sin tabla → [].
export async function getAgentMetrics(hotelId: string): Promise<AgentMetric[]> {
  try {
    const supabase = createAdminClient();
    const desde = new Date(Date.now() - 366 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("agent_activity")
      .select("tipo, fecha, detalle")
      .eq("hotel_id", hotelId)
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .limit(5000);
    if (error) {
      console.error("getAgentMetrics:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      tipo: String(r.tipo ?? ""),
      fecha: String(r.fecha ?? ""),
      detalle: String(r.detalle ?? ""),
    }));
  } catch (e) {
    console.error("getAgentMetrics:", e);
    return [];
  }
}

// ── CONVERSACIONES DE CAMILA (texto del bot de WhatsApp) ───────────────────────

export interface TurnoConversacion {
  rol: "user" | "assistant";
  texto: string;
  ts?: string; // ISO; lo pone el servidor si no viene
}

const CAMILA_MAX_TURNOS = 300; // tope de mensajes guardados por hilo
const CAMILA_MAX_CHARS = 4000; // tope por mensaje

// Guarda (acumula) los mensajes de un hilo huésped↔Camila. Una fila por
// (hotel_id, chat_id): lee la fila, agrega los turnos nuevos y hace upsert.
// FAIL-SAFE: si la tabla no existe (ver sql/kora-camila-conversaciones.sql) o
// algo falla, solo se registra el error — nunca debe romper la respuesta del bot.
export async function logCamilaConversacion(
  hotelId: string,
  chatId: string,
  turnos: TurnoConversacion[],
): Promise<void> {
  try {
    const id = (chatId ?? "").trim().slice(0, 80);
    const nuevos = (Array.isArray(turnos) ? turnos : [])
      .filter((t) => t && (t.rol === "user" || t.rol === "assistant") && typeof t.texto === "string")
      .map((t) => ({
        rol: t.rol,
        texto: t.texto.trim().slice(0, CAMILA_MAX_CHARS),
        ts: t.ts || new Date().toISOString(),
      }))
      .filter((t) => t.texto.length > 0);
    if (!id || nuevos.length === 0) return;

    const supabase = createAdminClient();
    // Lanza si falla, y el catch de esta función lo recoge SIN escribir. Es lo
    // correcto: con `?? []` un error de lectura hacía que `previos` quedara
    // vacío y el upsert de abajo PISARA el historial entero de la conversación
    // con sólo los turnos nuevos. Perder los turnos nuevos es mucho más barato
    // que borrar el hilo completo.
    const fila = await leer<{ mensajes: unknown }>(
      "camila.historial",
      supabase
        .from("camila_conversaciones")
        .select("mensajes")
        .eq("hotel_id", hotelId)
        .eq("chat_id", id)
        .maybeSingle(),
    );

    const previos = Array.isArray(fila?.mensajes) ? (fila.mensajes as TurnoConversacion[]) : [];
    const mensajes = [...previos, ...nuevos].slice(-CAMILA_MAX_TURNOS);
    const ultimo_at = nuevos[nuevos.length - 1].ts;

    await escribirMejorEsfuerzo("camila.conversacion", supabase
      .from("camila_conversaciones")
      .upsert(
        { hotel_id: hotelId, chat_id: id, mensajes, ultimo_at },
        { onConflict: "hotel_id,chat_id" },
      ));
  } catch (e) {
    console.error("logCamilaConversacion:", e);
  }
}

// ── MÉTRICAS REDES (sin tabla aún) ─────────────────────────────────────────────

export interface RedMetrica {
  fecha: string;
  ig_seguidores: number;
  ig_alcance: number;
  ig_interacciones: number;
  fb_seguidores: number;
  fb_alcance: number;
  notas: string;
}

// TODO Fase 6: tabla social_metrics. Por ahora devuelve lista vacía.
export async function getRedMetricas(_hotelId: string): Promise<RedMetrica[]> {
  // TODO Fase 6: tabla social_metrics — SELECT por hotel_id.
  return [];
}

// TODO Fase 6: tabla social_metrics. Por ahora no-op.
export async function saveRedMetrica(
  _hotelId: string,
  _data: Omit<RedMetrica, "fecha">,
): Promise<void> {
  // TODO Fase 6: tabla social_metrics — insertar la métrica del día.
  return;
}
