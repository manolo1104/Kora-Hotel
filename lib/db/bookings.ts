// Capa de datos de RESERVAS sobre Supabase (multi-tenant). La creación pasa por
// el RPC transaccional crear_reserva_atomica (anti-overbooking real). SOLO servidor.
//
// REGLA: hotelId resuelto desde la sesión/slug, nunca del body.

import { createAdminClient } from "@/lib/supabase/admin";

export interface CrearReservaInput {
  habitaciones: string[]; // nombres de cuarto
  checkin: string; // YYYY-MM-DD
  checkout: string;
  confirmacion: string;
  cliente?: string | null;
  telefono?: string | null;
  email?: string | null;
  total?: number;
  anticipo?: number;
  huespedes?: number;
  paymentIntentId?: string | null;
  estado?: "CONFIRMADA" | "MANUAL";
  origen?: string;
  comoNosConocio?: string | null;
  notas?: string | null;
}

export interface CrearReservaResult {
  ok: boolean;
  bookingId?: string;
  error?: string;
  /** true cuando el RPC rechazó por cuarto ya ocupado (overbooking evitado). */
  unavailable?: boolean;
}

/**
 * Crea la reserva de forma atómica (verifica solape + inserta booking + blocks
 * 'RESERVADO' bajo un lock por hotel). Idempotente por (hotel_id, payment_intent_id):
 * si ya existe la reserva de ese pago, devuelve su id sin duplicar.
 */
export async function createBookingAtomic(
  hotelId: string,
  input: CrearReservaInput,
): Promise<CrearReservaResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("crear_reserva_atomica", {
    p_hotel_id: hotelId,
    p_habitaciones: input.habitaciones,
    p_checkin: input.checkin,
    p_checkout: input.checkout,
    p_confirmacion: input.confirmacion,
    p_cliente: input.cliente ?? null,
    p_telefono: input.telefono ?? null,
    p_email: input.email ?? null,
    p_total: input.total ?? 0,
    p_anticipo: input.anticipo ?? 0,
    p_huespedes: input.huespedes ?? 1,
    p_payment_intent_id: input.paymentIntentId ?? null,
    p_estado: input.estado ?? "CONFIRMADA",
    p_origen: input.origen ?? "web",
    p_como_nos_conocio: input.comoNosConocio ?? null,
    p_notas: input.notas ?? null,
  });

  if (error) {
    const unavailable = /CUARTO_NO_DISPONIBLE/.test(error.message);
    if (!unavailable) console.error("createBookingAtomic error:", error);
    return { ok: false, error: error.message, unavailable };
  }
  return { ok: true, bookingId: data as string };
}

/** Idempotencia del webhook: ¿ya hay reserva para este payment_intent? */
export async function findBookingByPaymentIntent(
  hotelId: string,
  paymentIntentId: string,
): Promise<{ id: string; confirmacion: string } | null> {
  if (!paymentIntentId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, confirmacion")
    .eq("hotel_id", hotelId)
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();
  return (data as { id: string; confirmacion: string }) ?? null;
}

/** Una reserva completa por id (dentro del hotel). */
export async function getBooking(hotelId: string, id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Genera un folio tipo "PE-3F9KZ2" con el prefijo del hotel. */
export function generarConfirmacion(prefijo: string | null | undefined): string {
  const p = (prefijo || "KO").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "KO";
  let s = "";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${p}-${s}`;
}
