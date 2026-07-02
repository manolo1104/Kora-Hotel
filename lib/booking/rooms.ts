// Lectura de los cuartos de un hotel (desde hoteles.habitaciones jsonb) hacia el
// tipo BookingRoom que consume el motor. Acepta el formato simple que Kora ya
// guarda ({nombre, precio, descripcion}) y un formato rico con tarifas por
// número de huéspedes ({nombre, precio, priceTiers, maxGuests, fotos...}).

import type { BookingRoom, NightPriceOpts } from "@/lib/booking/engine";

interface HabitacionRaw {
  id?: number | string;
  nombre?: string;
  name?: string;
  precio?: number | string;
  price?: number | string;
  descripcion?: string;
  description?: string;
  priceTiers?: Record<string | number, number>;
  maxGuests?: number;
  capacidad?: number;
  fotos?: string[];
  images?: string[];
  image?: string;
  features?: string[];
}

interface HotelLike {
  habitaciones?: unknown;
  config?: Record<string, unknown> | null;
  extras?: Record<string, unknown> | null;
}

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, ""), 10) || fallback;
  return fallback;
}

/** Convierte las habitaciones jsonb del hotel en BookingRoom[] para el motor. */
export function hotelRooms(hotel: HotelLike): BookingRoom[] {
  const list = Array.isArray(hotel.habitaciones) ? (hotel.habitaciones as HabitacionRaw[]) : [];
  return list.map((h, i) => {
    const name = String(h.nombre ?? h.name ?? `Habitación ${i + 1}`).trim();
    const price = toNum(h.precio ?? h.price, 0);
    const maxGuests = h.maxGuests ?? h.capacidad ?? 2;
    // priceTiers: si no viene, tarifa plana al precio base.
    let priceTiers: Record<number, number> = {};
    if (h.priceTiers && typeof h.priceTiers === "object") {
      for (const [k, v] of Object.entries(h.priceTiers)) {
        const g = Number(k);
        if (!Number.isNaN(g)) priceTiers[g] = toNum(v, price);
      }
    }
    if (Object.keys(priceTiers).length === 0) priceTiers = { [maxGuests]: price };
    const images = Array.isArray(h.fotos) ? h.fotos : Array.isArray(h.images) ? h.images : undefined;
    return {
      id: h.id ?? i + 1,
      name,
      description: h.descripcion ?? h.description,
      price,
      priceTiers,
      maxGuests,
      image: h.image ?? images?.[0],
      images,
      features: h.features,
    };
  });
}

/** Nombres de cuarto del hotel (para disponibilidad). */
export function roomNamesOf(hotel: HotelLike): string[] {
  return hotelRooms(hotel).map((r) => r.name);
}

/**
 * Normaliza un nombre de cuarto. Genérico = trim. Un hotel puede declarar alias
 * en config.roomAliases ({ "Suite Jungla": "Jungla", ... }) para reconciliar
 * variantes (acentos, prefijos) que lleguen de OTAs o de datos viejos.
 */
export function normalizeRoomName(hotel: HotelLike, name: string): string {
  const trimmed = String(name).trim();
  const aliases = (hotel.config?.roomAliases ?? {}) as Record<string, string>;
  return aliases[trimmed] || trimmed;
}

/** Opciones de precio por noche derivadas de la config del hotel (descuento entre semana). */
export function nightOpts(hotel: HotelLike): NightPriceOpts {
  const cfg = (hotel.config ?? {}) as Record<string, unknown>;
  return {
    weekdayDiscount: toNum(cfg.weekdayDiscount, 0),
    weekdayDiscountUntil:
      typeof cfg.weekdayDiscountUntil === "string" ? cfg.weekdayDiscountUntil : undefined,
  };
}

// ── Reglas de reserva configurables por hotel (extras.reglas) ─────────────────
export interface BookingRules {
  anticipoPct: number; // % a cobrar como anticipo (10..100)
  anticipoMinNoches: number; // mín. noches para anticipo parcial; menos = cobra 100%
  minNoches: number; // mín. de noches por reserva
  nrfActiva: boolean; // ¿ofrece tarifa No Reembolsable?
  nrfPct: number; // % de descuento de la tarifa no reembolsable (5..50)
  cancelacionDias: number; // días antes del check-in con cancelación gratis (0..30)
  pagoEnHotel: boolean; // ¿permite reservar con tarjeta como garantía y pagar al llegar?
  ishPct: number; // % de ISH del estado para el desglose (0..10)
  nightOpts: NightPriceOpts;
}

function clampNum(v: unknown, def: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, toNum(v, def)));
}

/**
 * Reglas de reserva del hotel. El anticipo y el mínimo de noches viven en
 * extras.reglas (editables por el hotelero); el descuento entre semana sigue en
 * config (vía nightOpts). Valores por defecto = comportamiento previo (50% / 2 noches).
 */
export function bookingRules(hotel: HotelLike): BookingRules {
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const reglas = (extras.reglas ?? {}) as Record<string, unknown>;
  const impuestos = (extras.impuestos ?? {}) as Record<string, unknown>;
  return {
    anticipoPct: clampNum(reglas.anticipoPct, 50, 10, 100),
    anticipoMinNoches: clampNum(reglas.anticipoMinNoches, 2, 1, 30),
    minNoches: clampNum(reglas.minNoches, 1, 1, 30),
    nrfActiva: reglas.nrfActiva === true,
    nrfPct: clampNum(reglas.nrfPct, 10, 5, 50),
    cancelacionDias: clampNum(reglas.cancelacionDias, 2, 0, 30),
    pagoEnHotel: reglas.pagoEnHotel === true,
    // ISH admite decimales (hay estados con 2.5%): no usar toNum (solo enteros).
    ishPct: Math.max(0, Math.min(10, Number(impuestos.ishPct) || 0)),
    nightOpts: nightOpts(hotel),
  };
}
