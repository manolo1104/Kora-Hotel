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
import { escribir } from "@/lib/db/result";
import { alertar } from "@/lib/alertas";
import { hotelRooms } from "@/lib/booking";

export interface AvailabilityResult {
  available: boolean;
  unavailableRooms: string[];
}

/** Disponibilidad de un TIPO de habitación: cuántas unidades libres y cuáles. */
export interface TypeAvailability {
  id: number | string;
  name: string; // nombre del tipo
  cantidad: number; // unidades totales del tipo
  freeCount: number; // unidades libres para las fechas
  freeUnitNames: string[]; // nombres de las unidades libres (para asignar)
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
  excludeBookingId?: string | null,
): Promise<string[]> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  // Solape (half-open): b.checkin < checkout AND checkin < b.checkout.
  let query = supabase
    .from("blocks")
    .select("habitacion, checkin, checkout, status, expires_at, hold_session, booking_id")
    .eq("hotel_id", hotelId)
    .lt("checkin", checkout)
    .gt("checkout", checkin)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (excludeSession) query = query.or(`hold_session.is.null,hold_session.neq.${excludeSession}`);
  // Al EDITAR una reserva, sus propios blocks no deben contar como ocupación
  // (si no, la reserva "chocaría" consigo misma al revalidar).
  if (excludeBookingId) query = query.or(`booking_id.is.null,booking_id.neq.${excludeBookingId}`);
  // Tope EXPLÍCITO. PostgREST corta las respuestas por `db.max_rows` sin decirlo:
  // un truncamiento silencioso aquí devuelve MENOS cuartos ocupados de los que
  // hay, o sea, sobreventa. Con el tope escrito, si alguna vez se alcanza se
  // sabe por el log en vez de por dos huéspedes en la misma cabaña.
  const TOPE = 5000;
  const { data, error } = await query.limit(TOPE);
  if (error) throw error;
  if ((data?.length ?? 0) >= TOPE) {
    console.error(
      `[availability] getOccupiedRoomNames alcanzó el tope de ${TOPE} bloqueos ` +
        `(hotel ${hotelId}, ${checkin}→${checkout}). La ocupación puede estar INCOMPLETA.`,
    );
  }
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
 * Unidades libres POR TIPO para [checkin, checkout). Base del motor por cantidad:
 * cada tipo puede tener N unidades físicas (BookingRoom.unidades); una unidad está
 * libre si su nombre NO está ocupado. Devuelve también los nombres de unidad libres
 * para poder ASIGNAR unidades concretas al reservar (la reserva de esos nombres
 * sigue pasando por el candado atómico existente, así que no hay sobreventa).
 * Fail-closed: ante error de BD, 0 libres en todos los tipos.
 */
export async function freeUnitsByType(
  hotelId: string,
  hotel: Parameters<typeof hotelRooms>[0],
  checkin: string,
  checkout: string,
  excludeSession?: string | null,
): Promise<TypeAvailability[]> {
  return (await freeUnitsByTypeResult(hotelId, hotel, checkin, checkout, excludeSession)).types;
}

export interface FreeUnitsResult {
  /** false = la CONSULTA falló. No significa que el hotel esté lleno. */
  ok: boolean;
  types: TypeAvailability[];
}

/**
 * Igual que `freeUnitsByType`, pero distingue "no hay lugar" de "no pude
 * consultar". El fail-closed (0 libres ante error) es correcto para el motor
 * web —mejor pedir reintento que sobrevender— pero pésimo para un chat: Camila
 * no puede distinguir un error de un hotel lleno y le dice al huésped que no hay
 * cuartos cuando sí los hay. Quien necesite esa diferencia usa esta función.
 */
export async function freeUnitsByTypeResult(
  hotelId: string,
  hotel: Parameters<typeof hotelRooms>[0],
  checkin: string,
  checkout: string,
  excludeSession?: string | null,
): Promise<FreeUnitsResult> {
  const rooms = hotelRooms(hotel);
  const ceros = () =>
    rooms.map((r) => ({ id: r.id, name: r.name, cantidad: r.cantidad, freeCount: 0, freeUnitNames: [] }));
  if (!checkin || !checkout || new Date(checkout) <= new Date(checkin)) {
    return { ok: true, types: ceros() };
  }
  let occSet: Set<string>;
  try {
    occSet = new Set(await getOccupiedRoomNames(hotelId, checkin, checkout, excludeSession));
  } catch (e) {
    console.error("freeUnitsByType error:", e);
    return { ok: false, types: ceros() };
  }
  return {
    ok: true,
    types: rooms.map((r) => {
      const freeUnitNames = r.unidades.filter((u) => !occSet.has(u));
      return { id: r.id, name: r.name, cantidad: r.cantidad, freeCount: freeUnitNames.length, freeUnitNames };
    }),
  };
}

/**
 * Fechas completamente reservadas (todos los cuartos ocupados) en los próximos
 * meses — para deshabilitar días en el calendario público. Si se pasan los
 * nombres de cuartos VIGENTES, los bloqueos de cuartos renombrados/borrados no
 * cuentan (sin esto, un block viejo podía cerrar un día que sí es vendible).
 */
export async function getFullyBookedDates(
  hotelId: string,
  totalRooms: number,
  monthsAhead = 6,
  currentRoomNames?: string[],
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

  const vigentes = currentRoomNames?.length ? new Set(currentRoomNames) : null;
  const perDate = new Map<string, Set<string>>();
  for (const b of (data ?? []) as BlockRow[]) {
    if (vigentes && !vigentes.has(b.habitacion)) continue;
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
  // LANZA si falla. Un hold que no se escribe es un cuarto que sigue pareciendo
  // libre mientras un huésped lo está pagando: dos personas compran la misma
  // noche y el webhook acaba reembolsándole a una de las dos. Los llamadores
  // (checkout web y Camila) responden 500 y el huésped reintenta, que es
  // infinitamente más barato que la sobreventa.
  await escribir("blocks.holdTemporal", supabase.from("blocks").insert(rows));
}

export interface ApartadoResult {
  ok: boolean;
  /** Las unidades que quedaron apartadas, en el orden de los tipos pedidos. */
  unidades: string[];
  motivo?: "no-disponible" | "tope-de-apartados" | "error";
  detalle?: string;
  /** true = la base todavía no tiene el RPC y se apartó por el camino viejo. */
  degradado?: boolean;
}

/** Sólo se avisa una vez por instancia de que falta el RPC; si no, es spam. */
let yaAvisadoSinRpc = false;

/**
 * ELEGIR Y APARTAR, EN UNA SOLA OPERACIÓN Y BAJO CANDADO.
 *
 * El defecto que arregla (K-17, K-148): hoy el motor pregunta qué unidades hay
 * libres, se va a construir la sesión de pago de Stripe —una llamada de red a
 * otra empresa— y sólo entonces aparta. Entre la lectura y la escritura no hay
 * nada que impida que otro huésped haga exactamente lo mismo: los dos ven libre
 * la última cabaña, los dos llegan a la caja, los dos pagan, y al segundo el
 * webhook le devuelve el dinero con un correo de disculpa por un cuarto que sí
 * estaba libre cuando lo compró. Medido contra un Postgres real: el camino
 * viejo deja 2 apartados sobre 1 unidad; éste deja 1.
 *
 * Por eso NO se le pasan las unidades ya elegidas, sino las CANDIDATAS: elegir
 * es justo lo que tiene que pasar dentro del candado. El RPC toma el mismo
 * `pg_advisory_xact_lock(hotel)` que `crear_reserva_atomica`, así que apartar y
 * reservar se serializan entre sí sin trabajo extra.
 *
 * DEGRADA si la base todavía no tiene la función (`sql/kora-e3-apartado-atomico.sql`
 * sin correr): vuelve al comportamiento de siempre y lo dice en el log y por
 * correo. Prefiero un despliegue que no arregla a un despliegue que no vende.
 */
export async function apartarUnidades(
  hotelId: string,
  candidatas: { tipo: string; cantidad: number; unidades: string[] }[],
  checkin: string,
  checkout: string,
  sessionId: string,
  opts: { minutos?: number; maxUnidades?: number; prevSession?: string | null } = {},
): Promise<ApartadoResult> {
  const { minutos = 35, maxUnidades = 0, prevSession = null } = opts;
  const pedidas = candidatas.reduce((s, c) => s + Math.max(0, c.cantidad), 0);
  if (pedidas === 0) return { ok: true, unidades: [] };

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("apartar_unidades_atomico", {
    p_hotel_id: hotelId,
    p_asignacion: candidatas,
    p_checkin: checkin,
    p_checkout: checkout,
    p_session: sessionId,
    p_minutos: minutos,
    p_max_holds: maxUnidades,
    p_prev_session: prevSession,
  });

  if (!error) {
    const unidades = (data ?? []) as string[];
    // Contrato: el RPC lanza si no alcanza, así que nunca debería devolver de
    // menos. Si lo hiciera, apartar menos de lo que se va a cobrar es vender
    // aire: se corta aquí en vez de mandar al huésped a pagar.
    if (unidades.length !== pedidas) {
      return {
        ok: false,
        unidades: [],
        motivo: "error",
        detalle: `el candado devolvió ${unidades.length} unidades de ${pedidas}`,
      };
    }
    return { ok: true, unidades };
  }

  const msg = error.message ?? "";
  if (msg.startsWith("CUARTO_NO_DISPONIBLE")) {
    return { ok: false, unidades: [], motivo: "no-disponible", detalle: msg };
  }
  if (msg.startsWith("TOPE_DE_APARTADOS")) {
    return { ok: false, unidades: [], motivo: "tope-de-apartados", detalle: msg };
  }

  // La función no existe todavía → camino viejo, avisando. `PGRST202` es
  // PostgREST ("no está en el schema cache") y `42883` es Postgres.
  const falta = error.code === "PGRST202" || error.code === "42883" || /does not exist|Could not find the function/i.test(msg);
  if (falta) {
    if (!yaAvisadoSinRpc) {
      yaAvisadoSinRpc = true;
      await alertar(
        "falta correr sql/kora-e3-apartado-atomico.sql",
        `El motor está apartando cuartos por el camino VIEJO (leer y luego escribir, sin ` +
          `candado), que permite sobreventa cuando dos huéspedes pagan a la vez. No es ` +
          `urgente-hoy, pero hasta correr ese SQL el arreglo del paso 3.10 no tiene efecto. ` +
          `Detalle: ${msg}`,
      );
    }
    console.error("[availability] apartar_unidades_atomico no existe; degradando al camino viejo");
    const elegidas = candidatas.flatMap((c) => c.unidades.slice(0, c.cantidad));
    if (elegidas.length !== pedidas) {
      return { ok: false, unidades: [], motivo: "no-disponible", detalle: "sin unidades libres suficientes" };
    }
    if (prevSession && prevSession !== sessionId) await releaseHold(hotelId, prevSession);
    await createTemporaryHold(hotelId, elegidas, checkin, checkout, sessionId, minutos);
    return { ok: true, unidades: elegidas, degradado: true };
  }

  return { ok: false, unidades: [], motivo: "error", detalle: msg };
}

/**
 * Extiende el hold de una sesión. Se usa cuando el huésped genera un voucher
 * OXXO: el cuarto queda apartado mientras va a pagar en efectivo.
 */
export async function extendHold(hotelId: string, sessionId: string, hours: number): Promise<void> {
  const supabase = createAdminClient();
  const expires = new Date(Date.now() + hours * 3_600_000).toISOString();
  // LANZA si falla: si el hold no se extiende, el cuarto se libera mientras el
  // huésped va al OXXO a pagar. El único llamador lo envuelve en `.catch()` a
  // propósito (un webhook no puede caerse por esto), pero ahora ese `catch` es
  // una decisión visible y no la ausencia de comprobación.
  await escribir("blocks.extenderHold", supabase
    .from("blocks")
    .update({ expires_at: expires })
    .eq("hotel_id", hotelId)
    .eq("status", "HOLD")
    .eq("hold_session", sessionId)
    // Sólo se extiende lo que TODAVÍA está vivo (K-236). Sin esta línea, un
    // apartado ya vencido —cuyo cuarto puede haber reservado otra persona hace
    // rato— resucitaba con 24 horas nuevas por delante y volvía a bloquearlo.
    // El caso real: el huésped pide un voucher OXXO justo después de que su
    // apartado expiró.
    .gt("expires_at", new Date().toISOString()));
}

/**
 * Libera el hold de una sesión (al abandonar el carrito o tras confirmar).
 *
 * Devuelve `false` si el DELETE falló. Quien la llame ANTES de crear una reserva
 * tiene que tratar ese `false` como error transitorio y reintentar: si el hold
 * sigue en pie, el RPC atómico lo cuenta como solape contra sí mismo y responde
 * CUARTO_NO_DISPONIBLE. El webhook de Stripe interpreta eso como falta real de
 * cuarto y reembolsa —con correo de disculpa— una reserva pagada cuyo cuarto
 * estaba libre. Antes esta función devolvía `void`, así que un timeout puntual de
 * Supabase era indistinguible de un borrado correcto.
 */
export async function releaseHold(hotelId: string, sessionId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("status", "HOLD")
    .eq("hold_session", sessionId);
  if (error) {
    console.error("releaseHold error:", error);
    return false;
  }
  return true;
}

/**
 * Deja anotado en el apartado a qué sesión de pago de Stripe corresponde, para
 * poder apagarla cuando el huésped suelte el cuarto (K-102). Mejor esfuerzo: si
 * la columna no existe todavía, no pasa nada — simplemente no se podrá apagar
 * la sesión, que es exactamente como está hoy.
 */
export async function anotarSesionStripe(
  hotelId: string,
  sessionId: string,
  stripeSessionId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("blocks")
    .update({ stripe_session_id: stripeSessionId })
    .eq("hotel_id", hotelId)
    .eq("status", "HOLD")
    .eq("hold_session", sessionId);
  if (error) console.error("[availability] anotarSesionStripe:", error.message);
}

/** La sesión de Stripe anotada en un apartado, si la hay. */
export async function sesionStripeDelApartado(
  hotelId: string,
  sessionId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blocks")
    .select("stripe_session_id")
    .eq("hotel_id", hotelId)
    .eq("status", "HOLD")
    .eq("hold_session", sessionId)
    .not("stripe_session_id", "is", null)
    .limit(1);
  if (error) {
    console.error("[availability] sesionStripeDelApartado:", error.message);
    return null;
  }
  return (data?.[0]?.stripe_session_id as string | undefined) ?? null;
}

/**
 * Borra los apartados ya vencidos. La función existe en la base desde la fase 1
 * y NO LA LLAMABA NADIE (K-265): los apartados muertos se quedaban en `blocks`
 * para siempre. No causan sobreventa —todas las lecturas filtran por
 * `expires_at`— pero engordan la tabla y vuelven ilegible cualquier consulta a
 * mano. La llama el cron diario; devuelve cuántos borró, o null si no pudo.
 */
export async function limpiarHoldsVencidos(): Promise<number | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("limpiar_holds_vencidos");
  if (error) {
    console.error("[availability] limpiar_holds_vencidos:", error.message);
    return null;
  }
  return typeof data === "number" ? data : 0;
}

/**
 * Libera UNA noche de un bloqueo manual conservando el resto, en una sola
 * transacción.
 *
 * El defecto que arregla (K-80, K-179): el panel borraba el bloqueo ENTERO y
 * después reinsertaba los tramos de antes y de después. Entre las dos
 * escrituras, todas esas noches quedaban vendibles; y si la reinserción fallaba,
 * el bloqueo ya no existía y nadie se enteraba hasta que se vendiera una noche
 * que el hotelero había cerrado a propósito.
 *
 * Devuelve cuántos tramos quedaron (0, 1 o 2), o `null` si la base todavía no
 * tiene la función — en cuyo caso el llamador hace lo de siempre.
 */
export async function recortarBloqueo(
  hotelId: string,
  blockId: string,
  fecha: string,
): Promise<{ ok: true; tramos: number } | { ok: false; falta: boolean; detalle: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("recortar_bloqueo", {
    p_hotel_id: hotelId,
    p_block_id: blockId,
    p_fecha: fecha,
  });
  if (!error) return { ok: true, tramos: typeof data === "number" ? data : 0 };
  const msg = error.message ?? "";
  const falta =
    error.code === "PGRST202" || error.code === "42883" || /Could not find the function/i.test(msg);
  return { ok: false, falta, detalle: msg };
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
  // LANZA si falla. Es la escritura más cara del repo: si no queda, la noche
  // vendida sigue apareciendo libre en el motor, en el panel y en el feed de las
  // OTAs. Sobreventa silenciosa.
  await escribir("blocks.bloquear", supabase.from("blocks").insert(rows));
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
