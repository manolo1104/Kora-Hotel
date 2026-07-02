// Capa de datos de DISPONIBILIDAD y BLOQUEOS sobre Supabase (multi-tenant).
// Portado de mi-hotel/lib/sheets.ts: en Sheets había una hoja Disponibilidad +
// BloqueosTemporal + cross-check con Reservas. Aquí TODO vive en la tabla
// `blocks` (RESERVADO/BLOQUEADO/MANTENIMIENTO/OTA/HOLD) con hotel_id, y el
// anti-overbooking real lo hace el RPC crear_reserva_atomica (ver lib/db/bookings.ts).
//
// REGLA: el hotelId SIEMPRE llega ya resuelto desde la sesión/slug (lib/tenant.ts),
// NUNCA del body del cliente. Service-role + filtro explícito por hotel_id.
//
// SOLO servidor.

import { createAdminClient } from "@/lib/supabase/admin";

export interface AvailabilityResult {
  available: boolean;
  unavailableRooms: string[];
}

interface BlockRow {
  habitacion: string;
  checkin: string;
  checkout: string;
  status: string;
  expires_at: string | null;
}

/** Fechas 'YYYY-MM-DD' de [checkin, checkout) (la noche de salida queda libre). */
function dateRange(checkin: string, checkout: string): string[] {
  const start = new Date(`${checkin}T00:00:00`);
  const end = new Date(`${checkout}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  const out: string[] = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function mexicoTodayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/**
 * Cuartos ocupados del hotel que se solapan con [checkin, checkout).
 * Un hold vencido (expires_at en el pasado) NO cuenta. Se puede excluir la
 * sesión propia (para que el hold del propio carrito no se bloquee a sí mismo).
 */
export async function getOccupiedRoomNames(
  hotelId: string,
  checkin: string,
  checkout: string,
  excludeSession?: string | null,
): Promise<string[]> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  // Solape (half-open): b.checkin < checkout AND checkin < b.checkout.
  let query = supabase
    .from("blocks")
    .select("habitacion, checkin, checkout, status, expires_at, hold_session")
    .eq("hotel_id", hotelId)
    .lt("checkin", checkout)
    .gt("checkout", checkin)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (excludeSession) query = query.or(`hold_session.is.null,hold_session.neq.${excludeSession}`);
  const { data, error } = await query;
  if (error) throw error;
  const names = new Set<string>();
  for (const b of (data ?? []) as (BlockRow & { hold_session: string | null })[]) {
    names.add(b.habitacion);
  }
  return [...names];
}

/**
 * ¿Están disponibles los cuartos pedidos para [checkin, checkout)?
 * Fail-closed: ante error de BD marcamos los cuartos como NO disponibles
 * (sobrevender es peor que pedir reintentar).
 */
export async function checkAvailability(
  hotelId: string,
  checkin: string,
  checkout: string,
  roomNames: string[],
  excludeSession?: string | null,
): Promise<AvailabilityResult> {
  if (!checkin || !checkout || new Date(checkout) <= new Date(checkin)) {
    return { available: false, unavailableRooms: roomNames };
  }
  try {
    const occupied = await getOccupiedRoomNames(hotelId, checkin, checkout, excludeSession);
    const unavailableRooms = roomNames.filter((n) => occupied.includes(n));
    return { available: unavailableRooms.length === 0, unavailableRooms };
  } catch (e) {
    console.error("checkAvailability error:", e);
    return { available: false, unavailableRooms: roomNames };
  }
}

/**
 * Fechas completamente reservadas (todos los cuartos ocupados) en los próximos
 * meses — para deshabilitar días en el calendario público.
 */
export async function getFullyBookedDates(
  hotelId: string,
  totalRooms: number,
  monthsAhead = 6,
): Promise<string[]> {
  if (totalRooms <= 0) return [];
  const supabase = createAdminClient();
  const today = mexicoTodayStr();
  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setMonth(cutoff.getMonth() + monthsAhead);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("blocks")
    .select("habitacion, checkin, checkout, expires_at")
    .eq("hotel_id", hotelId)
    .gt("checkout", today)
    .lt("checkin", cutoffStr)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (error) {
    console.error("getFullyBookedDates error:", error);
    return [];
  }

  const perDate = new Map<string, Set<string>>();
  for (const b of (data ?? []) as BlockRow[]) {
    for (const date of dateRange(b.checkin, b.checkout)) {
      if (date < today || date > cutoffStr) continue;
      if (!perDate.has(date)) perDate.set(date, new Set());
      perDate.get(date)!.add(b.habitacion);
    }
  }
  const fully: string[] = [];
  for (const [date, rooms] of perDate) {
    if (rooms.size >= totalRooms) fully.push(date);
  }
  return fully.sort();
}

/** Hold temporal de carrito (10 min por defecto) para los cuartos elegidos. */
export async function createTemporaryHold(
  hotelId: string,
  roomNames: string[],
  checkin: string,
  checkout: string,
  sessionId: string,
  minutes = 10,
): Promise<void> {
  if (roomNames.length === 0) return;
  const supabase = createAdminClient();
  const expires = new Date(Date.now() + minutes * 60_000).toISOString();
  const rows = roomNames.map((habitacion) => ({
    hotel_id: hotelId,
    habitacion,
    checkin,
    checkout,
    status: "HOLD",
    expires_at: expires,
    hold_session: sessionId,
  }));
  const { error } = await supabase.from("blocks").insert(rows);
  if (error) console.error("createTemporaryHold error:", error);
}

/**
 * Extiende el hold de una sesión. Se usa cuando el huésped genera un voucher
 * OXXO: el cuarto queda apartado mientras va a pagar en efectivo.
 */
export async function extendHold(hotelId: string, sessionId: string, hours: number): Promise<void> {
  const supabase = createAdminClient();
  const expires = new Date(Date.now() + hours * 3_600_000).toISOString();
  const { error } = await supabase
    .from("blocks")
    .update({ expires_at: expires })
    .eq("hotel_id", hotelId)
    .eq("status", "HOLD")
    .eq("hold_session", sessionId);
  if (error) console.error("extendHold error:", error);
}

/** Libera el hold de una sesión (al abandonar el carrito o tras confirmar). */
export async function releaseHold(hotelId: string, sessionId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("status", "HOLD")
    .eq("hold_session", sessionId);
  if (error) console.error("releaseHold error:", error);
}

/** Bloqueo manual de fechas (BLOQUEADO / MANTENIMIENTO) desde el panel. */
export async function blockDates(
  hotelId: string,
  roomNames: string[],
  checkin: string,
  checkout: string,
  status: "BLOQUEADO" | "MANTENIMIENTO" = "BLOQUEADO",
): Promise<void> {
  if (roomNames.length === 0) return;
  const supabase = createAdminClient();
  const rows = roomNames.map((habitacion) => ({
    hotel_id: hotelId,
    habitacion,
    checkin,
    checkout,
    status,
  }));
  const { error } = await supabase.from("blocks").insert(rows);
  if (error) console.error("blockDates error:", error);
}

/** Elimina un bloqueo por id (desbloquear desde el panel). */
export async function unblock(hotelId: string, blockId: string): Promise<{ ok: boolean }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("id", blockId);
  if (error) {
    console.error("unblock error:", error);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Reemplaza TODOS los bloqueos OTA de un cuarto con los nuevos rangos del iCal.
 * Así las cancelaciones en la OTA se reflejan al re-sincronizar. Devuelve cuántos
 * rangos quedaron bloqueados.
 */
export async function updateOTABlocks(
  hotelId: string,
  roomName: string,
  fuenteOta: string,
  dateRanges: Array<{ checkin: string; checkout: string }>,
): Promise<number> {
  const supabase = createAdminClient();
  // Borra los OTA previos de este cuarto/fuente.
  await supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("habitacion", roomName)
    .eq("status", "OTA")
    .eq("fuente_ota", fuenteOta);

  if (dateRanges.length === 0) return 0;
  const rows = dateRanges.map(({ checkin, checkout }) => ({
    hotel_id: hotelId,
    habitacion: roomName,
    checkin,
    checkout,
    status: "OTA",
    fuente_ota: fuenteOta,
  }));
  const { error } = await supabase.from("blocks").insert(rows);
  if (error) {
    console.error("updateOTABlocks error:", error);
    return 0;
  }
  return rows.length;
}
