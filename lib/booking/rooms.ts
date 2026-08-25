// Lectura de los cuartos de un hotel (desde hoteles.habitaciones jsonb) hacia el
// tipo BookingRoom que consume el motor. Acepta el formato simple que Kora ya
// guarda ({nombre, precio, descripcion}) y un formato rico con tarifas por
// número de huéspedes ({nombre, precio, priceTiers, maxGuests, fotos...}).

import type {
  BookingRoom,
  NightPriceOpts,
  Temporada,
  RecargoFinDeSemana,
  SeasonAdjustment,
} from "@/lib/booking/engine";

interface HabitacionRaw {
  id?: number | string;
  nombre?: string;
  name?: string;
  precio?: number | string;
  price?: number | string;
  descripcion?: string;
  description?: string;
  priceTiers?: Record<string | number, number>;
  // El panel guarda "Precios por número de personas" como `tarifas` ([{personas,
  // precio}]); el motor lo normaliza a priceTiers para cobrarlo (antes se ignoraba).
  tarifas?: Array<{ personas?: number | string; precio?: number | string }>;
  maxGuests?: number;
  capacidad?: number;
  fotos?: string[];
  images?: string[];
  image?: string;
  features?: string[];
  camas?: Array<{ tipo?: string; cantidad?: number | string }>; // camas del tipo
  cantidad?: number | string; // unidades físicas del tipo (default 1)
  unidades?: string[]; // nombres explícitos de cada unidad (opcional)
  accesibilidad?: string; // cómo se llega: escalones, planta baja, elevador…
}

/** Normaliza las camas jsonb a {tipo, cantidad}[] válidas (descarta basura). */
function parseCamas(raw: unknown): { tipo: string; cantidad: number }[] {
  if (!Array.isArray(raw)) return [];
  const out: { tipo: string; cantidad: number }[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const tipo = String(o.tipo ?? "").trim();
    const cantidad = Math.max(1, Math.min(20, Math.round(Number(o.cantidad) || 0)));
    if (tipo && cantidad > 0) out.push({ tipo, cantidad });
  }
  return out;
}

interface HotelLike {
  habitaciones?: unknown;
  config?: Record<string, unknown> | null;
  extras?: Record<string, unknown> | null;
}

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  // Conservar el punto decimal: "1,500.50" → 1500.5. (parseInt lo trituraba a
  // 150050 y el motor cobraba 100×; la mini-página, con Number(), mostraba bien.)
  if (typeof v === "string") return parseFloat(v.replace(/[^0-9.]/g, "")) || fallback;
  return fallback;
}

/**
 * Deriva los nombres de las unidades físicas de un tipo. Fuente ÚNICA de verdad
 * (blocks, iCal, analítica, asignación de la RPC la usan):
 *  - `unidades` explícitas y no vacías → se usan (limpias);
 *  - `cantidad <= 1` → `[name]` (idéntico a hoy: no huérfana blocks/iCal);
 *  - `cantidad > 1` → `[name, "<name> 2", …, "<name> N"]` (la 1ª conserva el
 *    nombre pelón para no romper el historial al subir de 1→N).
 */
export function deriveUnidades(name: string, cantidad: number, unidadesRaw?: string[]): string[] {
  if (Array.isArray(unidadesRaw)) {
    const limpias = unidadesRaw.map((u) => String(u).trim()).filter(Boolean);
    if (limpias.length) return limpias;
  }
  if (cantidad <= 1) return [name];
  const out = [name];
  for (let n = 2; n <= cantidad; n++) out.push(`${name} ${n}`);
  return out;
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
    // Fallback: el panel guarda las tarifas por nº de personas en `tarifas`
    // ([{personas, precio}]). Si no vino priceTiers, se construye de ahí para
    // que el motor SÍ cobre esos precios (antes el motor las ignoraba).
    if (Object.keys(priceTiers).length === 0 && Array.isArray(h.tarifas)) {
      for (const t of h.tarifas) {
        const g = Math.round(Number(t?.personas));
        const p = toNum(t?.precio, 0);
        if (Number.isInteger(g) && g > 0 && p > 0) priceTiers[g] = p;
      }
    }
    if (Object.keys(priceTiers).length === 0) priceTiers = { [maxGuests]: price };
    const images = Array.isArray(h.fotos) ? h.fotos : Array.isArray(h.images) ? h.images : undefined;
    const cantidad = Math.max(1, Math.min(50, Math.round(toNum(h.cantidad, 1)) || 1));
    const unidades = deriveUnidades(name, cantidad, h.unidades);
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
      camas: parseCamas(h.camas),
      cantidad,
      unidades,
      accesibilidad:
        typeof h.accesibilidad === "string" && h.accesibilidad.trim()
          ? h.accesibilidad.trim()
          : undefined,
    };
  });
}

/**
 * Nombres de TIPO, uno por tipo ("Cabaña"). SÓLO para listas en pantalla.
 *
 * NUNCA para consultar `blocks`: ahí viven nombres de UNIDAD ("Cabaña 2"), así
 * que un filtro por tipo descarta todas las unidades salvo la primera. Para
 * inventario, `unitNamesOf` / `totalUnits`; para disponibilidad,
 * `freeUnitsByType`.
 *
 * Antes se llamaba `roomNamesOf` y su comentario decía "NO cambiar: lo usan iCal
 * y check-availability" — una instrucción equivocada que es justo la causa de
 * que el feed de las OTAs y Camila cuenten tipos en vez de cuartos.
 */
export function tipoNamesOf(hotel: HotelLike): string[] {
  return hotelRooms(hotel).map((r) => r.name);
}

/** Unidades físicas de un tipo (fuente de verdad para blocks/iCal/asignación). */
export function unitNamesOfType(room: BookingRoom): string[] {
  return room.unidades;
}

/** Todas las unidades físicas del hotel (denominador de inventario real). */
export function unitNamesOf(hotel: HotelLike): string[] {
  return hotelRooms(hotel).flatMap((r) => r.unidades);
}

/** Total de unidades físicas del hotel (suma de cantidades). */
export function totalUnits(hotel: HotelLike): number {
  return unitNamesOf(hotel).length;
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

// ── Temporadas (extras.temporadas) y recargo de fin de semana ─────────────────
// Se leen del jsonb con validación estricta: una entrada mal formada se descarta
// (no revienta el motor). Precios server-side, así que aquí es donde se clampan.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseAdjustment(raw: unknown): SeasonAdjustment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tipo = o.tipo === "fijo" ? "fijo" : o.tipo === "porcentaje" ? "porcentaje" : null;
  if (!tipo) return null;
  const valor = Number(o.valor);
  if (!Number.isFinite(valor)) return null;
  // Porcentaje: -90..+500. Fijo: precio ≥ 0.
  return tipo === "porcentaje"
    ? { tipo, valor: Math.max(-90, Math.min(500, valor)) }
    : { tipo, valor: Math.max(0, valor) };
}

function parseTemporadas(raw: unknown): Temporada[] {
  if (!Array.isArray(raw)) return [];
  const out: Temporada[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const desde = typeof o.desde === "string" ? o.desde : "";
    const hasta = typeof o.hasta === "string" ? o.hasta : "";
    if (!ISO_DATE.test(desde) || !ISO_DATE.test(hasta) || desde > hasta) continue;
    const ajuste = parseAdjustment(o.ajuste);
    if (!ajuste) continue;
    const minNoches =
      o.minNoches != null && Number.isFinite(Number(o.minNoches))
        ? Math.max(1, Math.min(30, Math.round(Number(o.minNoches))))
        : undefined;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : `${desde}_${hasta}`,
      nombre: typeof o.nombre === "string" && o.nombre ? o.nombre : "Temporada",
      desde,
      hasta,
      ajuste,
      minNoches,
    });
  }
  return out;
}

function parseRecargoFinDeSemana(raw: unknown): RecargoFinDeSemana | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (o.activo !== true) return undefined;
  const ajuste = parseAdjustment(o.ajuste);
  if (!ajuste) return undefined;
  const dias = Array.isArray(o.dias)
    ? o.dias.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  return { activo: true, dias: dias.length ? dias : [5, 6], ajuste };
}

/** Temporadas válidas del hotel (extras.temporadas), ya parseadas y clampadas. */
export function temporadasDe(hotel: HotelLike): Temporada[] {
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  return parseTemporadas(extras.temporadas);
}

/** Opciones de precio por noche derivadas de la config del hotel. */
export function nightOpts(hotel: HotelLike): NightPriceOpts {
  const cfg = (hotel.config ?? {}) as Record<string, unknown>;
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  return {
    weekdayDiscount: toNum(cfg.weekdayDiscount, 0),
    weekdayDiscountUntil:
      typeof cfg.weekdayDiscountUntil === "string" ? cfg.weekdayDiscountUntil : undefined,
    temporadas: parseTemporadas(extras.temporadas),
    recargoFinDeSemana: parseRecargoFinDeSemana(extras.recargoFinDeSemana),
  };
}

/**
 * Mínimo de noches exigido por la temporada en la que LLEGA la estancia (0 si
 * ninguna). Min-LOS por fecha de llegada, como los channel managers. Gana la
 * primera temporada de la lista que cubra el check-in (misma regla que el precio).
 */
export function seasonMinNoches(hotel: HotelLike, checkin: string): number {
  if (!ISO_DATE.test(checkin)) return 0;
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  for (const t of parseTemporadas(extras.temporadas)) {
    if (checkin >= t.desde && checkin <= t.hasta) return t.minNoches ?? 0;
  }
  return 0;
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
