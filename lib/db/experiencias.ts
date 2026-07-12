// Ventas de experiencias por día (tabla experiencia_ventas — ver
// sql/kora-experiencia-ventas.sql). Soporta el CUPO DIARIO del Sprint 3:
// el webhook registra lugares vendidos al confirmar la reserva, las
// cancelaciones los liberan, y el checkout/motor los leen para no vender
// más lugares de los que el hotel tiene.
//
// FAIL-SAFE por diseño: si la tabla no existe todavía, nada truena — las
// escrituras solo se registran en logs y las lecturas devuelven "sin ventas"
// (es decir, sin cupo aplicado). SOLO servidor.

import { createAdminClient } from "@/lib/supabase/admin";

export interface ExperienciaVenta {
  experiencia: string; // nombre (identidad, como las habitaciones en blocks)
  fecha: string; // YYYY-MM-DD
  qty: number; // lugares consumidos
}

/**
 * Lugares vendidos por (experiencia, fecha) dentro de un rango. Devuelve un
 * mapa `nombre → { fecha → vendidos }`. Fail-safe: {} si la tabla no existe.
 */
export async function ventasPorExperiencia(
  hotelId: string,
  nombres: string[],
  desde: string,
  hasta: string,
): Promise<Record<string, Record<string, number>>> {
  if (nombres.length === 0) return {};
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("experiencia_ventas")
      .select("experiencia, fecha, qty")
      .eq("hotel_id", hotelId)
      .in("experiencia", nombres)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .limit(5000);
    if (error) {
      console.error("ventasPorExperiencia:", error.message);
      return {};
    }
    const out: Record<string, Record<string, number>> = {};
    for (const r of data ?? []) {
      const nombre = String(r.experiencia ?? "");
      const fecha = String(r.fecha ?? "");
      if (!nombre || !fecha) continue;
      out[nombre] = out[nombre] ?? {};
      out[nombre][fecha] = (out[nombre][fecha] ?? 0) + (Number(r.qty) || 0);
    }
    return out;
  } catch (e) {
    console.error("ventasPorExperiencia:", e);
    return {};
  }
}

/**
 * Registra los lugares que consumió una reserva confirmada. Idempotencia
 * best-effort: borra lo previo del mismo folio antes de insertar (por si el
 * webhook reintenta). Fail-safe: un error nunca tumba la creación de la reserva.
 */
export async function registrarExperienciaVentas(
  hotelId: string,
  confirmacion: string,
  items: ExperienciaVenta[],
): Promise<void> {
  const limpios = items.filter((i) => i.experiencia && i.fecha && i.qty > 0);
  if (!confirmacion || limpios.length === 0) return;
  try {
    const supabase = createAdminClient();
    await supabase
      .from("experiencia_ventas")
      .delete()
      .eq("hotel_id", hotelId)
      .eq("confirmacion", confirmacion);
    const { error } = await supabase.from("experiencia_ventas").insert(
      limpios.map((i) => ({
        hotel_id: hotelId,
        confirmacion,
        experiencia: i.experiencia.slice(0, 120),
        fecha: i.fecha,
        qty: Math.max(1, Math.floor(i.qty)),
      })),
    );
    if (error) console.error("registrarExperienciaVentas:", error.message);
  } catch (e) {
    console.error("registrarExperienciaVentas:", e);
  }
}

/** Libera los lugares de una reserva (cancelación). Fail-safe. */
export async function liberarExperienciaVentas(
  hotelId: string,
  confirmacion: string,
): Promise<void> {
  if (!confirmacion) return;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("experiencia_ventas")
      .delete()
      .eq("hotel_id", hotelId)
      .eq("confirmacion", confirmacion);
    if (error) console.error("liberarExperienciaVentas:", error.message);
  } catch (e) {
    console.error("liberarExperienciaVentas:", e);
  }
}
