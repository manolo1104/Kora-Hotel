// Capa de datos de RESEÑAS reales de huéspedes sobre Supabase (multi-tenant).
// Las deja el huésped desde la página de captura (app/h/[slug]/resena) atadas al
// folio de su reserva → verificables (a diferencia de hoteles.extras.resenas,
// tecleadas a mano). Alimentan el aggregateRating honesto de /h/[slug] y el panel.
//
// FAIL-SAFE por diseño: si la tabla `reviews` no existe todavía (ver
// sql/kora-reviews.sql), todo degrada con gracia — se registra el error y se
// devuelve vacío/ok:false, nunca se tumba el flujo que llama.
//
// REGLA: hotelId resuelto desde la sesión/slug, nunca del body. SOLO servidor.

import { createAdminClient } from "@/lib/supabase/admin";

export interface ResenaInput {
  bookingId?: string | null;
  confirmacion?: string | null;
  cliente?: string | null;
  estrellas: number;
  texto?: string | null;
}

export interface Resena {
  id: string;
  cliente: string;
  estrellas: number;
  texto: string;
  respuesta: string | null;
  publicada: boolean;
  fecha: string;
  confirmacion: string | null;
}

interface ReviewRow {
  id: string;
  cliente: string | null;
  estrellas: number | null;
  texto: string | null;
  respuesta: string | null;
  publicada: boolean | null;
  fecha: string | null;
  confirmacion: string | null;
}

function hoyMX(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function mapResena(r: ReviewRow): Resena {
  return {
    id: r.id,
    cliente: r.cliente ?? "Huésped",
    estrellas: Math.max(1, Math.min(5, Number(r.estrellas) || 0)),
    texto: r.texto ?? "",
    respuesta: r.respuesta ?? null,
    publicada: r.publicada !== false,
    fecha: r.fecha ?? "",
    confirmacion: r.confirmacion ?? null,
  };
}

/**
 * Crea (o actualiza) la reseña de una reserva. Una por folio: si el huésped ya
 * había dejado una para esa reserva, se sobrescribe (no duplica). Fail-safe.
 */
export async function crearResena(
  hotelId: string,
  input: ResenaInput,
): Promise<{ ok: boolean; actualizada?: boolean; error?: string }> {
  const estrellas = Math.round(Number(input.estrellas));
  if (!(estrellas >= 1 && estrellas <= 5)) return { ok: false, error: "estrellas-invalidas" };
  const confirmacion = (input.confirmacion ?? "").trim() || null;
  const row = {
    hotel_id: hotelId,
    booking_id: input.bookingId ?? null,
    confirmacion,
    cliente: (input.cliente ?? "").trim().slice(0, 120) || "Huésped",
    estrellas,
    texto: (input.texto ?? "").trim().slice(0, 1500),
    fecha: hoyMX(),
  };
  try {
    const supabase = createAdminClient();
    // Una reseña por folio: si ya existe, se actualiza (evita duplicar si el
    // huésped reenvía el formulario). El índice único es parcial, así que la
    // dedupe se hace explícita en vez de con upsert.
    if (confirmacion) {
      const { data: existing } = await supabase
        .from("reviews")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("confirmacion", confirmacion)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("reviews")
          .update({ estrellas, texto: row.texto, cliente: row.cliente, fecha: row.fecha })
          .eq("hotel_id", hotelId)
          .eq("id", existing.id);
        if (error) {
          console.error("crearResena update:", error.message);
          return { ok: false, error: error.message };
        }
        return { ok: true, actualizada: true };
      }
    }
    const { error } = await supabase.from("reviews").insert(row);
    if (error) {
      console.error("crearResena insert:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("crearResena:", e);
    return { ok: false, error: "excepcion" };
  }
}

/** Reseñas VISIBLES para la página pública (publicada=true). Fail-safe → []. */
export async function getResenasPublicadas(hotelId: string, limit = 30): Promise<Resena[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, cliente, estrellas, texto, respuesta, publicada, fecha, confirmacion")
      .eq("hotel_id", hotelId)
      .eq("publicada", true)
      .order("fecha", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("getResenasPublicadas:", error.message);
      return [];
    }
    return ((data ?? []) as ReviewRow[]).map(mapResena);
  } catch (e) {
    console.error("getResenasPublicadas:", e);
    return [];
  }
}

/** TODAS las reseñas del hotel (para el panel: incluye ocultas). Fail-safe → []. */
export async function getResenasHotel(hotelId: string, limit = 300): Promise<Resena[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, cliente, estrellas, texto, respuesta, publicada, fecha, confirmacion")
      .eq("hotel_id", hotelId)
      .order("fecha", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("getResenasHotel:", error.message);
      return [];
    }
    return ((data ?? []) as ReviewRow[]).map(mapResena);
  } catch (e) {
    console.error("getResenasHotel:", e);
    return [];
  }
}

/** Respuesta pública del hotelero a una reseña. Fail-safe. */
export async function responderResena(
  hotelId: string,
  id: string,
  respuesta: string,
): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("reviews")
      .update({ respuesta: respuesta.trim().slice(0, 1500) || null })
      .eq("hotel_id", hotelId)
      .eq("id", id);
    if (error) {
      console.error("responderResena:", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("responderResena:", e);
    return { ok: false };
  }
}

/** Mostrar u ocultar una reseña en la página pública. Fail-safe. */
export async function ocultarResena(
  hotelId: string,
  id: string,
  publicada: boolean,
): Promise<{ ok: boolean }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("reviews")
      .update({ publicada })
      .eq("hotel_id", hotelId)
      .eq("id", id);
    if (error) {
      console.error("ocultarResena:", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("ocultarResena:", e);
    return { ok: false };
  }
}
