// Portal del huésped: consulta de reserva por folio + email (sin cuenta).
// La "autenticación" es el par folio (alta entropía) + email coincidente.
// SOLO servidor.

import { createAdminClient } from "@/lib/supabase/admin";
import { liberarExperienciaVentas } from "@/lib/db/experiencias";
import { bookingRules } from "@/lib/booking";
import type { MiniExtras } from "@/lib/mini";

export interface GuestBookingRow {
  id: string;
  hotel_id: string;
  confirmacion: string;
  cliente: string | null;
  email: string | null;
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  habitaciones: string;
  total: number;
  anticipo: number;
  estado: string;
  rate_plan: string | null;
  hoteles: {
    nombre: string;
    slug: string;
    whatsapp: string | null;
    extras: Record<string, unknown> | null;
    config: Record<string, unknown> | null;
  } | null;
}

function hoyMX(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/** Última fecha (YYYY-MM-DD) en la que aún se puede cancelar gratis. */
export function fechaLimiteCancelacion(checkin: string, cancelacionDias: number): string {
  const d = new Date(`${checkin}T12:00:00`);
  d.setDate(d.getDate() - Math.max(0, cancelacionDias));
  return d.toISOString().slice(0, 10);
}

export interface GuestBooking {
  row: GuestBookingRow;
  cancelable: boolean;
  motivoNoCancelable: "nrf" | "plazo" | "estado" | null;
  fechaLimite: string;
  politicaCancelacion: string | null;
  cancelacionDias: number;
}

/** Busca la reserva por folio + email (case-insensitive). null si no coincide. */
export async function findGuestBooking(folio: string, email: string): Promise<GuestBooking | null> {
  const f = folio.trim().toUpperCase();
  const e = email.trim().toLowerCase();
  if (!f || !e) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, hotel_id, confirmacion, cliente, email, checkin, checkout, noches, huespedes, habitaciones, total, anticipo, estado, rate_plan, hoteles(nombre, slug, whatsapp, extras, config)",
    )
    // El folio es único por (hotel_id, confirmacion), no global: pueden existir
    // varios hoteles con el mismo folio. El match real es folio+email; un tope
    // bajo podía truncar justo la reserva del huésped.
    .eq("confirmacion", f)
    .limit(50);
  if (error) {
    console.error("findGuestBooking error:", error);
    return null;
  }

  const row = ((data ?? []) as unknown as GuestBookingRow[]).find(
    (b) => (b.email ?? "").trim().toLowerCase() === e,
  );
  if (!row || !row.hoteles) return null;

  const rules = bookingRules({ extras: row.hoteles.extras, config: row.hoteles.config });
  const extras = (row.hoteles.extras ?? {}) as MiniExtras;
  const fechaLimite = fechaLimiteCancelacion(row.checkin, rules.cancelacionDias);

  let motivoNoCancelable: GuestBooking["motivoNoCancelable"] = null;
  if (row.estado !== "CONFIRMADA" && row.estado !== "MANUAL") motivoNoCancelable = "estado";
  else if (row.rate_plan === "nrf") motivoNoCancelable = "nrf";
  else if (hoyMX() > fechaLimite) motivoNoCancelable = "plazo";

  return {
    row,
    cancelable: motivoNoCancelable === null,
    motivoNoCancelable,
    fechaLimite,
    politicaCancelacion: extras.politicas?.cancelacion || null,
    cancelacionDias: rules.cancelacionDias,
  };
}

/** Payload seguro para el cliente (sin ids internos ni payment intent). */
export function serializeGuestBooking(b: GuestBooking) {
  return {
    folio: b.row.confirmacion,
    cliente: b.row.cliente,
    checkin: b.row.checkin,
    checkout: b.row.checkout,
    noches: b.row.noches,
    huespedes: b.row.huespedes,
    habitaciones: b.row.habitaciones,
    total: Number(b.row.total) || 0,
    anticipo: Number(b.row.anticipo) || 0,
    estado: b.row.estado,
    ratePlan: b.row.rate_plan === "nrf" ? "nrf" : "flex",
    hotel: {
      nombre: b.row.hoteles?.nombre ?? "",
      slug: b.row.hoteles?.slug ?? "",
      whatsapp: b.row.hoteles?.whatsapp ?? null,
    },
    cancelable: b.cancelable,
    motivoNoCancelable: b.motivoNoCancelable,
    fechaLimite: b.fechaLimite,
    cancelacionDias: b.cancelacionDias,
    politicaCancelacion: b.politicaCancelacion,
  };
}

/**
 * Cancela la reserva y libera sus bloqueos de ocupación.
 *
 * Devuelve `false` también cuando la reserva YA estaba cancelada: el UPDATE
 * lleva `.neq("estado","CANCELADA")` y sólo gana la primera petición. Sin eso,
 * un doble clic en «Cancelar» —o el reintento de un móvil con mala señal— la
 * cancelaba dos veces y mandaba DOS correos al huésped y DOS al hotel, que es
 * como un hotelero acaba llamando a preguntar si canceló una o dos reservas.
 * El llamador distingue este caso del error real por `yaCancelada`.
 */
export async function cancelGuestBooking(
  b: GuestBooking,
): Promise<{ ok: boolean; yaCancelada?: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ estado: "CANCELADA" })
    .eq("hotel_id", b.row.hotel_id)
    .eq("id", b.row.id)
    .neq("estado", "CANCELADA")
    .select("id");
  if (error) {
    console.error("cancelGuestBooking error:", error);
    return { ok: false };
  }
  // Cero filas = otra petición llegó primero. No es un error, pero tampoco
  // puede seguir: lo que va debajo manda los correos.
  if (!data || data.length === 0) return { ok: false, yaCancelada: true };
  const { error: blockErr } = await supabase
    .from("blocks")
    .delete()
    .eq("hotel_id", b.row.hotel_id)
    .eq("booking_id", b.row.id);
  if (blockErr) console.error("cancelGuestBooking blocks error:", blockErr);
  // Cupo de experiencias: los lugares de la reserva quedan libres (fail-safe).
  await liberarExperienciaVentas(b.row.hotel_id, b.row.confirmacion);
  return { ok: true };
}
