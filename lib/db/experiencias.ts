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
import { alertar } from "@/lib/alertas";

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
  excluirApartado?: string | null,
): Promise<Record<string, Record<string, number>>> {
  if (nombres.length === 0) return {};
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("experiencia_ventas")
      .select("experiencia, fecha, qty, confirmacion, hold_session, expires_at")
      .eq("hotel_id", hotelId)
      .in("experiencia", nombres)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .limit(5000);
    if (error) {
      console.error("ventasPorExperiencia:", error.message);
      return {};
    }
    const ahora = Date.now();
    const out: Record<string, Record<string, number>> = {};
    for (const r of data ?? []) {
      const nombre = String(r.experiencia ?? "");
      const fecha = String(r.fecha ?? "");
      if (!nombre || !fecha) continue;
      // Una fila SIN folio es un lugar APARTADO: cuenta mientras no caduque.
      // Si ya caducó, el huésped no pagó y el lugar volvió a estar a la venta.
      const apartado = !r.confirmacion;
      if (apartado) {
        const vence = r.expires_at ? Date.parse(String(r.expires_at)) : 0;
        if (!vence || vence <= ahora) continue;
        // Y el apartado PROPIO no se cuenta contra uno mismo (si no, reintentar
        // el checkout se choca con su propia reserva de lugares).
        if (excluirApartado && r.hold_session === excluirApartado) continue;
      }
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
 * APARTA los lugares de una reserva que todavía no está pagada.
 *
 * El defecto que arregla (K-18): el cupo se COMPROBABA en la caja y se ESCRIBÍA
 * en el webhook, o sea, al pagar. Entre una cosa y otra —los minutos que el
 * huésped pasa en Stripe— cualquier número de personas pasaba la misma
 * comprobación, todas la pasaban, y el tour de 8 lugares acababa con 14
 * vendidos. Ahora el lugar se aparta cuando se promete y se confirma cuando se
 * paga; si no paga, caduca solo junto con el cuarto.
 *
 * Mejor esfuerzo a propósito: si las columnas todavía no existen
 * (`sql/kora-e3-apartado-atomico.sql` sin correr) se comporta como antes —el
 * cupo se sigue comprobando, sólo que sin apartar— y lo dice en el log. Un
 * despliegue no debe dejar de vender por esto.
 */
export async function apartarExperienciaVentas(
  hotelId: string,
  holdSession: string,
  items: ExperienciaVenta[],
  minutos: number,
): Promise<boolean> {
  const limpios = items.filter((i) => i.experiencia && i.fecha && i.qty > 0);
  if (!holdSession || limpios.length === 0) return true;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("experiencia_ventas").insert(
      limpios.map((i) => ({
        hotel_id: hotelId,
        confirmacion: null,
        hold_session: holdSession,
        experiencia: i.experiencia.slice(0, 120),
        fecha: i.fecha,
        qty: Math.max(1, Math.floor(i.qty)),
        expires_at: new Date(Date.now() + minutos * 60_000).toISOString(),
      })),
    );
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    console.error(
      "[experiencias] no se pudieron apartar los lugares (¿falta correr " +
        "sql/kora-e3-apartado-atomico.sql?):",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

/** Suelta los lugares apartados por una sesión que no llegó a pagar. */
export async function liberarExperienciaApartado(
  hotelId: string,
  holdSession: string,
): Promise<void> {
  if (!holdSession) return;
  try {
    const supabase = createAdminClient();
    await supabase
      .from("experiencia_ventas")
      .delete()
      .eq("hotel_id", hotelId)
      .eq("hold_session", holdSession)
      .is("confirmacion", null);
  } catch (e) {
    console.error("[experiencias] liberarExperienciaApartado:", e);
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
  holdSession?: string | null,
): Promise<void> {
  const limpios = items.filter((i) => i.experiencia && i.fecha && i.qty > 0);
  if (!confirmacion || limpios.length === 0) return;
  try {
    const supabase = createAdminClient();
    // Si los lugares ya estaban APARTADOS por esta sesión, esto es un ascenso,
    // no un alta: se les pone el folio y se les quita el vencimiento. Insertar
    // de nuevo los contaría dos veces hasta que caducara el apartado.
    if (holdSession) {
      const { data, error } = await supabase
        .from("experiencia_ventas")
        .update({ confirmacion, expires_at: null })
        .eq("hotel_id", hotelId)
        .eq("hold_session", holdSession)
        .is("confirmacion", null)
        .select("id");
      if (!error && (data?.length ?? 0) > 0) return;
    }
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
    if (error) throw new Error(error.message);
  } catch (e) {
    // Fail-safe DELIBERADO: esto corre después de que la reserva ya está creada
    // y cobrada. Lanzar aquí haría que Stripe reintentara el webhook y duplicara
    // trabajo ya hecho. Pero el cupo de experiencias queda mal contado, así que
    // se avisa: es un lugar que se puede vender dos veces.
    await alertar(
      "no se registró el cupo de una experiencia",
      `Hotel ${hotelId}, reserva ${confirmacion}. ${e instanceof Error ? e.message : String(e)}. ` +
        `La reserva SÍ existe; lo que no quedó contado son los lugares.`,
    );
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
    if (error) throw new Error(error.message);
  } catch (e) {
    // Mismo caso al revés: si no se liberan, quedan lugares fantasma ocupados.
    await alertar(
      "no se liberó el cupo de una experiencia",
      `Hotel ${hotelId}, reserva ${confirmacion}. ${e instanceof Error ? e.message : String(e)}. ` +
        `Quedan lugares contados como vendidos que ya no lo están.`,
    );
  }
}
