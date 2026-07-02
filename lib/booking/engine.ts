// ============================================================
// MOTOR DE RESERVAS — tipos, precios y lógica de carrito (PURO)
// Portado de mi-hotel/lib/booking.ts. Diferencia multi-tenant: ya NO hay un
// arreglo global de cuartos; las funciones que necesitan la lista de cuartos la
// reciben por parámetro (cada hotel trae los suyos desde lib/booking/rooms.ts).
// Sin dependencias de datos/IO: solo cálculo.
// ============================================================

export interface BookingRoom {
  id: number | string;
  name: string;
  description?: string;
  price: number;
  priceTiers: Record<number, number>;
  maxGuests: number;
  image?: string;
  images?: string[];
  features?: string[];
}

// ── Precios ──────────────────────────────────────────────
export function getRoomBasePrice(room: BookingRoom, guests: number): number {
  const tiers = room.priceTiers || {};
  const g = Math.max(1, Math.min(guests, room.maxGuests || guests));
  if (tiers[g] !== undefined) return tiers[g];
  for (let i = g - 1; i >= 1; i--) {
    if (tiers[i] !== undefined) return tiers[i];
  }
  return room.price;
}

/**
 * Precio por noche. Por defecto es el precio base. Un hotel puede activar el
 * descuento entre semana (lun–jue) vía `opts`. (En mi-hotel era un -$300 fijo
 * con corte el 15-jun-2026; aquí se vuelve configurable por hotel.)
 */
export interface NightPriceOpts {
  weekdayDiscount?: number; // MXN a restar lun–jue; 0 = sin descuento
  weekdayDiscountUntil?: string; // 'YYYY-MM-DD'; a partir de aquí no aplica
}

export function getRoomNightPrice(
  room: BookingRoom,
  guests: number,
  dateStr: string,
  opts: NightPriceOpts = {},
): number {
  const base = getRoomBasePrice(room, guests);
  const desc = opts.weekdayDiscount ?? 0;
  if (desc <= 0) return base;
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return base;
  if (opts.weekdayDiscountUntil && d >= new Date(`${opts.weekdayDiscountUntil}T12:00:00`)) {
    return base;
  }
  const day = d.getDay(); // 0=Dom … 4=Jue
  const isWeekday = day >= 1 && day <= 4;
  return isWeekday ? Math.max(0, base - desc) : base;
}

export function calcRoomStayTotal(
  room: BookingRoom,
  guests: number,
  checkin: string,
  checkout: string,
  opts: NightPriceOpts = {},
): number {
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return getRoomBasePrice(room, guests);
  }
  let total = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    total += getRoomNightPrice(room, guests, `${y}-${m}-${d}`, opts);
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export function calcNights(checkin: string, checkout: string): number {
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

// ── Carrito ───────────────────────────────────────────────
export interface CartItem {
  roomId: number | string;
  guestCount: number;
}

export function calcCartSubtotal(
  rooms: BookingRoom[],
  cart: CartItem[],
  checkin: string,
  checkout: string,
  opts: NightPriceOpts = {},
): number {
  return cart.reduce((sum, item) => {
    const room = rooms.find((r) => r.id === item.roomId);
    if (!room) return sum;
    return sum + calcRoomStayTotal(room, item.guestCount, checkin, checkout, opts);
  }, 0);
}

/**
 * Cuánto cobrar ahora. Por defecto 50% para 2+ noches y 100% para 1 noche
 * (comportamiento previo). El hotel puede configurar el % y el umbral de noches.
 */
export function calcDepositAmount(
  total: number,
  nights: number,
  opts: { pct?: number; minNights?: number } = {},
): number {
  const pct = opts.pct ?? 50;
  const minNights = opts.minNights ?? 2;
  return nights >= minNights ? Math.round(total * (pct / 100)) : Math.round(total);
}

// ── Rate plans ────────────────────────────────────────────
// Tarifa "No reembolsable": descuento % sobre el subtotal de habitaciones
// (no aplica a extras). El % viene de las reglas del hotel.
export type RatePlan = "flex" | "nrf";

export function calcNrfDiscount(roomsSubtotal: number, pct: number): number {
  const p = Math.max(0, Math.min(Number(pct) || 0, 50));
  return Math.round(Math.max(0, roomsSubtotal) * (p / 100));
}

// ── Desglose de impuestos ─────────────────────────────────
// Los precios del hotel son FINALES (impuestos incluidos). El desglose separa
// tarifa base + IVA 16% + ISH (% del estado, configurable) sin cambiar el total.
export const IVA_PCT = 16;

export interface TaxBreakdown {
  base: number;
  iva: number;
  ish: number;
  ishPct: number;
  total: number;
}

export function calcTaxBreakdown(total: number, ishPct = 0): TaxBreakdown {
  const t = Math.max(0, Math.round(total));
  const pct = Math.max(0, Math.min(Number(ishPct) || 0, 10));
  const factor = 1 + IVA_PCT / 100 + pct / 100;
  const base = Math.round(t / factor);
  const iva = Math.round((t / factor) * (IVA_PCT / 100));
  const ish = Math.max(0, t - base - iva); // residuo: el desglose siempre suma el total
  return { base, iva, ish, ishPct: pct, total: t };
}

// ── Extras vendibles (add-ons) ────────────────────────────────
export interface AddonRule {
  nombre: string;
  precio: number;
  tipo: "estancia" | "noche" | "persona";
}

/** Total de los extras seleccionados (por índice en la lista del hotel). */
export function calcAddonsTotal(
  addons: AddonRule[],
  selected: number[],
  nights: number,
  guests: number,
): number {
  return selected.reduce((sum, i) => {
    const a = addons[i];
    if (!a) return sum;
    const p = Math.max(0, Number(a.precio) || 0);
    const mult =
      a.tipo === "noche" ? Math.max(1, nights) : a.tipo === "persona" ? Math.max(1, guests) : 1;
    return sum + p * mult;
  }, 0);
}

// ── Estado de reserva (se persiste en sessionStorage) ────────
export interface BookingState {
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  children: number;
  cart: CartItem[];
  promoCode: string | null;
  promoDiscount: number;
  amountTotal?: number;
  amountPaid?: number;
  amountPending?: number;
  isDeposit?: boolean;
}

export const BOOKING_STATE_KEY = "kora_booking_state";

export function saveBookingState(state: BookingState): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(BOOKING_STATE_KEY, JSON.stringify(state));
  }
}

export function loadBookingState(): BookingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BOOKING_STATE_KEY);
    return raw ? (JSON.parse(raw) as BookingState) : null;
  } catch {
    return null;
  }
}

export function formatMXN(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`;
}

// ── Promos (opcional, por hotel) ─────────────────────────────
// Un hotel puede definir promos en su config. Modelo simple por porcentaje o
// "n-ésima noche gratis". Sin promos configuradas, no hay descuento.
export interface PromoRule {
  code: string;
  tipo: "porcentaje" | "noche_gratis" | "monto";
  valor: number; // % (0..100), índice de noche (1-based) o monto fijo
  minNoches?: number;
  noches?: number; // si la promo exige exactamente N noches
}

export interface PromoValidation {
  valid: boolean;
  error?: string;
  rule?: PromoRule;
}

export function validatePromo(
  promos: PromoRule[],
  code: string,
  nights: number,
  cartLength: number,
): PromoValidation {
  const rule = promos.find((p) => p.code.toUpperCase() === code.toUpperCase());
  if (!rule) return { valid: false, error: "❌ Código inválido. Verifica e intenta de nuevo." };
  if (cartLength === 0) return { valid: false, error: "❌ Agrega al menos una habitación primero." };
  if (rule.minNoches && nights < rule.minNoches)
    return { valid: false, error: `❌ Aplica para ${rule.minNoches}+ noches.` };
  if (rule.noches && nights !== rule.noches)
    return { valid: false, error: `❌ Aplica únicamente para ${rule.noches} noches.` };
  return { valid: true, rule };
}

function nightByIndex(checkin: string, checkout: string, idx: number): string | null {
  const start = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + idx);
  if (cursor >= end) return null;
  const y = cursor.getFullYear();
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  const d = String(cursor.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calcPromoDiscount(
  rooms: BookingRoom[],
  rule: PromoRule,
  cart: CartItem[],
  checkin: string,
  checkout: string,
  nights: number,
  opts: NightPriceOpts = {},
): number {
  const subtotal = calcCartSubtotal(rooms, cart, checkin, checkout, opts);
  if (rule.tipo === "monto") return Math.min(rule.valor, subtotal);
  if (rule.tipo === "porcentaje") return Math.round(subtotal * (rule.valor / 100));
  if (rule.tipo === "noche_gratis") {
    const nightDate = nightByIndex(checkin, checkout, Math.max(0, rule.valor - 1));
    if (!nightDate) return 0;
    return cart.reduce((sum, item) => {
      const room = rooms.find((r) => r.id === item.roomId);
      if (!room) return sum;
      return sum + getRoomNightPrice(room, item.guestCount, nightDate, opts);
    }, 0);
  }
  return 0;
}
