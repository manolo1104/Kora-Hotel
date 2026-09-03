// Portal del huésped: consulta de reserva por folio + email (sin cuenta).
// La "autenticación" es el par folio (alta entropía) + email coincidente.
// SOLO servidor.

import { createAdminClient } from "@/lib/supabase/admin";
import { liberarExperienciaVentas } from "@/lib/db/experiencias";
import { bookingRules, politicaDelHotel } from "@/lib/booking";
import {
  politicaDe,
  reembolsoPorCancelar,
  fechaLimiteDevolucion,
  textoPolitica,
  type Politica,
  type Reembolso,
} from "@/lib/politica";
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
  /**
   * La política que el huésped aceptó al reservar. `null` en las reservas
   * anteriores al 2 sep 2026 y mientras no se corra
   * `sql/kora-politica-cancelacion.sql`; en ese caso se usa la del hotel, que
   * es el comportamiento de siempre.
   */
  politica_snapshot?: Record<string, unknown> | null;
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
  /** La política que decide: la que el huésped ACEPTÓ, si se guardó. */
  politica: Politica;
  /** Cuánto le toca si cancela ahora mismo, y por qué. */
  reembolso: Reembolso;
}

/** Busca la reserva por folio + email (case-insensitive). null si no coincide. */
export async function findGuestBooking(folio: string, email: string): Promise<GuestBooking | null> {
  const f = folio.trim().toUpperCase();
  const e = email.trim().toLowerCase();
  if (!f || !e) return null;

  const supabase = createAdminClient();
  // El folio es único por (hotel_id, confirmacion), no global: pueden existir
  // varios hoteles con el mismo folio. El match real es folio+email; un tope
  // bajo podía truncar justo la reserva del huésped.
  const CAMPOS =
    "id, hotel_id, confirmacion, cliente, email, checkin, checkout, noches, huespedes, habitaciones, total, anticipo, estado, rate_plan, hoteles(nombre, slug, whatsapp, extras, config)";
  const buscar = (campos: string) =>
    supabase.from("bookings").select(campos).eq("confirmacion", f).limit(50);

  // Se pide `politica_snapshot`; si la columna todavía no existe, PostgREST
  // rechaza el SELECT ENTERO y el portal del huésped se quedaría muerto. Se
  // reintenta sin ella y se dice en el log, en vez de disimularlo: la reserva
  // cae a la política vigente del hotel, que es el comportamiento de siempre.
  let { data, error } = await buscar(
    CAMPOS.replace("rate_plan,", "rate_plan, politica_snapshot,"),
  );
  if (error) {
    const faltaColumna =
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /politica_snapshot/i.test(error.message ?? "");
    if (!faltaColumna) {
      console.error("findGuestBooking error:", error);
      return null;
    }
    console.error(
      "[portal] bookings.politica_snapshot no existe todavía; la cancelación usa " +
        "la política VIGENTE del hotel. Falta correr sql/kora-politica-cancelacion.sql.",
    );
    ({ data, error } = await buscar(CAMPOS));
    if (error) {
      console.error("findGuestBooking error:", error);
      return null;
    }
  }

  const row = ((data ?? []) as unknown as GuestBookingRow[]).find(
    (b) => (b.email ?? "").trim().toLowerCase() === e,
  );
  if (!row || !row.hoteles) return null;

  const hotelLike = { extras: row.hoteles.extras, config: row.hoteles.config };
  const rules = bookingRules(hotelLike);

  // 🔴 LA COPIA MANDA. Si la reserva guardó qué política aceptó el huésped, esa
  // es la que decide — no la que el hotelero tenga hoy. Sin esto, cambiar
  // «gratis hasta 7 días» por «hasta 2» alteraba retroactivamente las
  // condiciones de reservas ya pagadas y aceptadas, y el huésped que reclamaba
  // tenía razón. Las reservas anteriores al 2 sep 2026 no tienen copia y caen a
  // la política vigente, que es el comportamiento de siempre.
  const politica = row.politica_snapshot
    ? politicaDe(row.politica_snapshot as Record<string, unknown>)
    : politicaDelHotel(hotelLike);

  const hoy = hoyMX();
  const reembolso = reembolsoPorCancelar({
    politica,
    checkin: row.checkin,
    hoy,
    ratePlan: row.rate_plan,
  });

  // La fecha límite sale de la política, no de un número suelto. Se conserva el
  // respaldo por `cancelacionDias` para una política sin ningún escalón con
  // devolución, donde no hay fecha que enseñar.
  const fechaLimite =
    fechaLimiteDevolucion(politica, row.checkin) ??
    fechaLimiteCancelacion(row.checkin, rules.cancelacionDias);

  let motivoNoCancelable: GuestBooking["motivoNoCancelable"] = null;
  if (row.estado !== "CONFIRMADA" && row.estado !== "MANUAL") motivoNoCancelable = "estado";
  else if (row.rate_plan === "nrf") motivoNoCancelable = "nrf";
  else if (reembolso.pct === 0 && reembolso.regla === "sin-plazo") motivoNoCancelable = "plazo";

  return {
    row,
    cancelable: motivoNoCancelable === null,
    motivoNoCancelable,
    fechaLimite,
    // El texto que lee el huésped se DERIVA de la política, no de un campo
    // suelto que pudiera contradecirla.
    politicaCancelacion: textoPolitica(politica),
    cancelacionDias: rules.cancelacionDias,
    politica,
    reembolso,
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
    // Cuánto le toca y por qué, en la misma respuesta: el huésped ve el número
    // ANTES de pulsar «cancelar», no después de reclamar.
    reembolsoPct: b.reembolso.pct,
    reembolsoMotivo: b.reembolso.motivo,
    escalones: b.politica.escalones,
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
