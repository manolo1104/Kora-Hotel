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

import { createAdminClient } from "@/lib/supabase/admin";
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

/** Divide un CSV de habitaciones en nombres limpios. Helper puro. */
function splitRooms(habitacionesStr: string): string[] {
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
  estado: "CONFIRMADA" | "CANCELADA" | "MANUAL";
  comoNosConocio: string;
  anticipo: number;
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
  const estado: AdminBooking["estado"] =
    r.estado === "CANCELADA" ? "CANCELADA" : r.estado === "MANUAL" ? "MANUAL" : "CONFIRMADA";
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
  };
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
): Promise<string> {
  const supabase = createAdminClient();
  const confirmacion = generarConfirmacion("PE-M");

  const { data: inserted, error } = await supabase
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

  if (error || !inserted) {
    throw new Error(`createManualBooking error: ${error?.message ?? "sin id"}`);
  }
  const bookingId = (inserted as { id: string }).id;

  // Reflejar ocupación: un block 'RESERVADO' por cuarto, ligado a la reserva.
  const rooms = splitRooms(data.habitacion);
  if (rooms.length > 0) {
    const rows = rooms.map((habitacion) => ({
      hotel_id: hotelId,
      habitacion,
      checkin: data.checkin,
      checkout: data.checkout,
      status: "RESERVADO",
      booking_id: bookingId,
    }));
    const { error: blkErr } = await supabase.from("blocks").insert(rows);
    if (blkErr) console.error("createManualBooking blocks error:", blkErr.message);
  }

  return confirmacion;
}

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
): Promise<void> {
  const supabase = createAdminClient();
  // Solo pasamos las columnas presentes en `changes` (mapeo 1:1 de nombres).
  const patch: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    patch[key] = value as string | number;
  }
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("updateBooking error:", error.message);
}

/**
 * Cancela una reserva: estado='CANCELADA' y borra los blocks ligados (por
 * booking_id) para liberar disponibilidad.
 */
export async function cancelBooking(hotelId: string, id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("bookings")
    .update({ estado: "CANCELADA" })
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) {
    console.error("cancelBooking error:", error.message);
    return;
  }

  // Libera la disponibilidad: borra los bloqueos de esta reserva.
  const { error: blkErr } = await supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("booking_id", id);
  if (blkErr) console.error("cancelBooking unblock error:", blkErr.message);
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
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("status", "BLOQUEADO")
    .in("habitacion", rooms)
    .lt("checkin", checkout)
    .gt("checkout", checkin);
  if (error) console.error("unblockRooms error:", error.message);
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
  data: Omit<AdminQuote, "id" | "fecha" | "estado">,
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

  const { error } = await supabase
    .from("quotes")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("updateQuote error:", error.message);
}

/** Cambia solo el estado de una cotización. */
export async function updateQuoteStatus(
  hotelId: string,
  id: string,
  estado: AdminQuote["estado"],
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quotes")
    .update({ estado })
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("updateQuoteStatus error:", error.message);
}

/** Elimina una cotización (por id, dentro del hotel). */
export async function deleteQuote(hotelId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("deleteQuote error:", error.message);
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
  const { error } = await supabase
    .from("guest_notes")
    .upsert(
      { hotel_id: hotelId, email, notas, updated_at: new Date().toISOString() },
      { onConflict: "hotel_id,email" },
    );
  if (error) console.error("saveGuestNote error:", error.message);
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
    if (b.estado !== "CANCELADA") {
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
  const { error } = await supabase
    .from("room_statuses")
    .upsert(
      { hotel_id: hotelId, suite, estado, notas, updated_at: new Date().toISOString() },
      { onConflict: "hotel_id,suite" },
    );
  if (error) console.error("setRoomStatus error:", error.message);
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
  const { error } = await supabase
    .from("cleaning_tasks")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("updateCleaningTask error:", error.message);
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
  const { error } = await supabase
    .from("maintenance_tasks")
    .update(patch)
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("updateMaintenanceTask error:", error.message);
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
  const { error } = await supabase.from("ota_channels").upsert(
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
  );
  if (error) console.error("saveOTACalendar error:", error.message);
}

/** Registra el resultado de una sincronización iCal. */
export async function updateOTASyncResult(
  hotelId: string,
  id: string,
  status: "ok" | "error",
  blocksFound: number,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ota_channels")
    .update({
      ultima_sync: new Date().toISOString(),
      status,
      blocks_found: blocksFound,
    })
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("updateOTASyncResult error:", error.message);
}

/** Elimina un canal OTA (por id, dentro del hotel). */
export async function deleteOTACalendar(hotelId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ota_channels")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("id", id);
  if (error) console.error("deleteOTACalendar error:", error.message);
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

// ── AGENT METRICS (sin tabla aún) ──────────────────────────────────────────────

export type AgentActivityType =
  | "whatsapp_conv"
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

// TODO Fase 6: tabla agent_activity. Por ahora no-op / vacío.
export async function logAgentActivity(
  _hotelId: string,
  _tipo: AgentActivityType,
  _detalle = "",
): Promise<void> {
  // TODO Fase 6: tabla agent_activity — insertar { hotel_id, fecha, tipo, detalle }.
  return;
}

// TODO Fase 6: tabla agent_activity. Por ahora devuelve lista vacía.
export async function getAgentMetrics(_hotelId: string): Promise<AgentMetric[]> {
  // TODO Fase 6: tabla agent_activity — SELECT por hotel_id.
  return [];
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
