// Herramienta de disponibilidad de Camila. Fuente ÚNICA que usan /api/agent
// (bot vivo) y /api/admin/bot-preview (chat de prueba). SOLO servidor, lectura.

import { hotelRooms, nightOpts, calcRoomStayTotal, formatMXN } from "@/lib/booking";
import { freeUnitsByTypeResult } from "@/lib/db/availability";
import type { HotelRow } from "@/lib/tenant";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export interface BotAvailability {
  hotel: string;
  checkin: string;
  checkout: string;
  hayDisponibilidad: boolean;
  disponibles: {
    id: string | number;
    nombre: string;
    maxHuespedes: number;
    /** Personas con las que se calculó `total` (el link de pago cobrará esto). */
    huespedesCotizados: number;
    /** Cuántos cuartos FÍSICOS de este tipo quedan libres. */
    unidadesLibres: number;
    total: number;
    totalTexto: string;
  }[];
  linkReserva: string;
  /**
   * Sólo cuando la consulta NO se pudo responder. Existe para que Camila no
   * disfrace un fallo de "no hay lugar": ver el comentario de abajo.
   */
  error?: "fechas-invalidas" | "servicio-no-disponible";
}

/**
 * Disponibilidad real + precio total por tipo de cuarto para unas fechas.
 *
 * `huespedes` importa: en un hotel con tarifas por número de personas, el precio
 * de 2 no es el de 4. Antes se cotizaba SIEMPRE a ocupación máxima mientras el
 * link de pago cobraba por los huéspedes reales, así que el huésped veía un
 * número en WhatsApp y otro en Stripe. Con tarifas planas los dos coinciden, que
 * es por lo que el defecto llevaba tiempo sin verse. Por defecto 2, el mismo
 * supuesto que ya usa el bloque CUARTOS del cerebro.
 */
export async function botAvailability(
  hotel: HotelRow,
  checkin: string,
  checkout: string,
  huespedes = 2,
): Promise<BotAvailability> {
  const base = { hotel: hotel.nombre, checkin, checkout, linkReserva: `${SITE}/h/${hotel.slug}/reservar` };

  // Una fecha que no se entendió NO es un hotel lleno. Antes las dos cosas
  // acababan en `hayDisponibilidad:false` y Camila le decía al huésped que no
  // había cuartos cuando lo que pasaba es que no entendió lo que escribió.
  if (!FECHA.test(checkin) || !FECHA.test(checkout) || checkout <= checkin) {
    return { ...base, hayDisponibilidad: false, disponibles: [], error: "fechas-invalidas" };
  }

  // Se cuenta por UNIDAD física, no por tipo. Antes preguntaba por nombres de
  // TIPO ("Cabaña"), pero la ocupación se guarda por unidad ("Cabaña 2"), así
  // que en cuanto se vendía UNA de tres cabañas el tipo entero desaparecía de la
  // oferta y Camila le decía al huésped que ya no había — con dos libres.
  const { ok, types } = await freeUnitsByTypeResult(hotel.id, hotel, checkin, checkout);
  if (!ok) {
    return { ...base, hayDisponibilidad: false, disponibles: [], error: "servicio-no-disponible" };
  }

  const opts = nightOpts(hotel);
  const porId = new Map(hotelRooms(hotel).map((r) => [r.id, r]));
  const disponibles = types.flatMap((t) => {
    if (t.freeCount <= 0) return [];
    const r = porId.get(t.id);
    if (!r) return []; // no debería pasar: ambos salen de hotelRooms(hotel)
    const ocupacion = Math.max(1, Math.min(r.maxGuests, Math.floor(huespedes) || 2));
    const total = calcRoomStayTotal(r, ocupacion, checkin, checkout, opts);
    return [
      {
        id: t.id,
        nombre: t.name,
        maxHuespedes: r.maxGuests,
        huespedesCotizados: ocupacion,
        unidadesLibres: t.freeCount,
        total,
        totalTexto: formatMXN(total),
      },
    ];
  });

  return { ...base, hayDisponibilidad: disponibles.length > 0, disponibles };
}
