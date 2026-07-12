// ============================================================
// MOTOR DE RESERVAS — tipos, precios y lógica de carrito (PURO)
// Portado de mi-hotel/lib/booking.ts. Diferencia multi-tenant: ya NO hay un
// arreglo global de cuartos; las funciones que necesitan la lista de cuartos la
// reciben por parámetro (cada hotel trae los suyos desde lib/booking/rooms.ts).
// Sin dependencias de datos/IO: solo cálculo.
// ============================================================

export interface BookingRoom {
  id: number | string;
  name: string; // nombre del TIPO (y, si cantidad=1, también su única unidad)
  description?: string;
  price: number;
  priceTiers: Record<number, number>;
  maxGuests: number;
  image?: string;
  images?: string[];
  features?: string[];
  // Inventario: un tipo puede tener N unidades físicas. cantidad=1 (default) =
  // comportamiento previo. `unidades` son los nombres reales que usan blocks/iCal.
  cantidad: number;
  unidades: string[];
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
 * Ajuste de precio de una temporada o del recargo de fin de semana:
 * "porcentaje" (+40 / -20 sobre la base) o "fijo" (precio exacto por noche).
 */
export interface SeasonAdjustment {
  tipo: "porcentaje" | "fijo";
  valor: number;
}

/**
 * Temporada de tarifa por rango de fechas. El precio de esas noches sube/baja
 * según `ajuste`. Aplica IGUAL a todos los cuartos (un +40% sube todos). El
 * precio por-cuarto llegará con la migración a tipos de habitación.
 */
export interface Temporada {
  id: string;
  nombre: string;
  desde: string; // 'YYYY-MM-DD' inclusive
  hasta: string; // 'YYYY-MM-DD' inclusive
  ajuste: SeasonAdjustment;
  minNoches?: number; // mín. de noches si la estancia LLEGA en esta temporada
}

/** Recargo automático para ciertos días de la semana (p. ej. vie/sáb). */
export interface RecargoFinDeSemana {
  activo: boolean;
  dias: number[]; // getDay(): 0=Dom … 6=Sáb (default vie/sáb = [5,6])
  ajuste: SeasonAdjustment;
}

/**
 * Precio por noche. Por defecto es el precio base. Un hotel puede configurar
 * (vía `opts`): temporadas por fecha, recargo de fin de semana y/o el descuento
 * entre semana (lun–jue, comportamiento previo). Precedencia por noche:
 *   1) temporada que cubra la fecha (gana la primera de la lista),
 *   2) recargo de fin de semana,
 *   3) descuento entre semana,
 *   4) precio base.
 */
export interface NightPriceOpts {
  weekdayDiscount?: number; // MXN a restar lun–jue; 0 = sin descuento
  weekdayDiscountUntil?: string; // 'YYYY-MM-DD'; a partir de aquí no aplica
  temporadas?: Temporada[];
  recargoFinDeSemana?: RecargoFinDeSemana;
}

/** Aplica un ajuste (porcentaje o fijo) a un precio base. Nunca baja de 0. */
function applyAdjustment(base: number, adj: SeasonAdjustment): number {
  if (adj.tipo === "fijo") return Math.max(0, Math.round(adj.valor));
  return Math.max(0, Math.round(base * (1 + adj.valor / 100)));
}

export function getRoomNightPrice(
  room: BookingRoom,
  guests: number,
  dateStr: string,
  opts: NightPriceOpts = {},
): number {
  const base = getRoomBasePrice(room, guests);
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return base;

  // 1) Temporada por rango de fechas (comparación de strings ISO: sin TZ).
  //    Gana la PRIMERA temporada de la lista que cubra la fecha.
  for (const t of opts.temporadas ?? []) {
    if (dateStr >= t.desde && dateStr <= t.hasta) {
      return applyAdjustment(base, t.ajuste);
    }
  }

  // 2) Recargo de fin de semana (solo si no cayó en temporada).
  const rfs = opts.recargoFinDeSemana;
  if (rfs?.activo && Array.isArray(rfs.dias) && rfs.dias.includes(d.getDay())) {
    return applyAdjustment(base, rfs.ajuste);
  }

  // 3) Descuento entre semana (lun–jue, comportamiento previo).
  const desc = opts.weekdayDiscount ?? 0;
  if (desc <= 0) return base;
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
  quantity?: number; // unidades del tipo (default 1); permite "2 Deluxe"
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
    const qty = Math.max(1, Math.floor(item.quantity ?? 1));
    return sum + calcRoomStayTotal(room, item.guestCount, checkin, checkout, opts) * qty;
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
  const iva = Math.round((t / factor) * (IVA_PCT / 100));
  // Sin ISH, el renglón de ISH no se muestra en la UI: el residuo de redondeo
  // se absorbe en la base para que lo VISIBLE siempre sume el total exacto.
  if (pct <= 0) return { base: t - iva, iva, ish: 0, ishPct: 0, total: t };
  const base = Math.round(t / factor);
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

// ── Experiencias vendibles (tours, traslados, cena, spa) ──────
// Add-on "rico": igual que AddonRule pero con cobro por "unidad" (cantidad que
// elige el huésped, p. ej. 2 boletos) y un tope opcional. La versión de datos
// vive en lib/mini.ts (Experiencia); aquí el tipo es solo lo que el cálculo
// necesita, para mantener el engine sin dependencias.
export interface ExperienciaRule {
  nombre: string;
  precio: number;
  cobro: "estancia" | "noche" | "persona" | "unidad";
  cantidadMax?: number; // tope de unidades (solo cobro="unidad"); 0/undefined = sin tope
  // Agenda: metadatos de validación/anotación (el checkout revisa que la fecha
  // elegida caiga en un día permitido). NO participan en el cálculo del precio.
  dias?: number[]; // días de la semana en que se ofrece (0=Dom … 6=Sáb); vacío = todos
  horarios?: string[]; // horarios de salida; vacío = sin horario fijo
  cupoDia?: number; // lugares por día (0/undefined = sin límite); no aplica a cobro="noche"
}

/**
 * Lugares que una selección CONSUME del cupo diario de su experiencia:
 * unidad → cantidad de boletos, persona → huéspedes, estancia → 1.
 * cobro="noche" no elige día → no consume cupo (devuelve 0).
 */
export function experienciaCupoQty(
  e: Pick<ExperienciaRule, "cobro" | "cantidadMax">,
  qty: number,
  guests: number,
): number {
  if (e.cobro === "noche") return 0;
  if (e.cobro === "persona") return Math.max(1, guests);
  if (e.cobro === "estancia") return 1;
  const cap = e.cantidadMax && e.cantidadMax > 0 ? Math.floor(e.cantidadMax) : Infinity;
  return Math.min(cap, Math.max(1, Math.floor(Number(qty) || 1)));
}

/** Regla del descuento de paquete (extras.experienciasBundle). */
export interface ExperienciasBundleRule {
  min?: number; // mínimo de experiencias distintas (default 2)
  pct?: number; // % de descuento sobre el total de experiencias (0 = apagado)
}

/**
 * Descuento de paquete: si el huésped eligió `count` experiencias DISTINTAS
 * (count ≥ min, min mínimo 2 — un descuento por 1 sola no es paquete) se
 * descuenta pct% del total de experiencias. Redondeado a pesos. Puro.
 */
export function calcExperienciasBundleDiscount(
  experienciasTotal: number,
  count: number,
  rule?: ExperienciasBundleRule | null,
): number {
  const pct = Math.min(90, Math.max(0, Number(rule?.pct) || 0));
  const min = Math.max(2, Math.floor(Number(rule?.min) || 2));
  if (!pct || count < min || experienciasTotal <= 0) return 0;
  return Math.round(experienciasTotal * (pct / 100));
}

/** Una experiencia elegida: índice en el catálogo del hotel + cantidad.
 * fecha/hora (agenda) son anotaciones para el hotel; no cambian el precio. */
export interface ExperienciaSelection {
  i: number;
  qty: number; // solo relevante para cobro="unidad"; se ignora en los demás
  fecha?: string; // YYYY-MM-DD del día elegido dentro de la estancia
  hora?: string; // uno de los horarios del hotel
}

/**
 * Fechas (YYYY-MM-DD) en las que una experiencia puede tomarse dentro de la
 * estancia: del check-in al check-out INCLUSIVE (un traslado de salida ocurre el
 * día del check-out), filtradas por los días de semana en que se ofrece
 * (0=Dom … 6=Sáb; vacío = todos). Pura y sin zona horaria: las fechas se
 * descomponen a mano y el día de semana se calcula en UTC.
 */
export function experienciaFechasDisponibles(
  dias: number[] | undefined,
  checkin: string,
  checkout: string,
): string[] {
  const parse = (f: string) => {
    const [y, m, d] = f.split("-").map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
  };
  const ini = parse(checkin);
  const fin = parse(checkout);
  if (ini == null || fin == null || fin < ini) return [];
  const permitidos = Array.isArray(dias) && dias.length > 0 ? new Set(dias) : null;
  const out: string[] = [];
  const DIA_MS = 86_400_000;
  // Tope defensivo de 62 días: ninguna estancia real del motor dura más.
  for (let t = ini, n = 0; t <= fin && n < 62; t += DIA_MS, n++) {
    const dt = new Date(t);
    if (permitidos && !permitidos.has(dt.getUTCDay())) continue;
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Total de las experiencias seleccionadas. Multiplicador por cobro:
 *   estancia → ×1, noche → ×noches, persona → ×huéspedes, unidad → ×qty (topeada
 *   a cantidadMax). Índices inválidos se ignoran. Igual que en el resto del
 *   motor, el monto NUNCA se confía al cliente: solo el índice y la cantidad.
 */
export function calcExperienciasTotal(
  catalog: ExperienciaRule[],
  selections: ExperienciaSelection[],
  nights: number,
  guests: number,
): number {
  return selections.reduce((sum, sel) => {
    const e = catalog[sel?.i];
    if (!e) return sum;
    const price = Math.max(0, Number(e.precio) || 0);
    if (e.cobro === "unidad") {
      const cap = e.cantidadMax && e.cantidadMax > 0 ? Math.floor(e.cantidadMax) : Infinity;
      const qty = Math.min(cap, Math.max(1, Math.floor(Number(sel?.qty) || 1)));
      return sum + price * qty;
    }
    const mult =
      e.cobro === "noche"
        ? Math.max(1, nights)
        : e.cobro === "persona"
          ? Math.max(1, guests)
          : 1; // estancia
    return sum + price * mult;
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
