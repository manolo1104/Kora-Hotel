// Catálogo de tours y paquetes para Cotizaciones y el modal de reservas.
//
// De dónde sale: SÓLO de `hotel.extras.cotizaciones`, o sea de lo que el
// hotelero dio de alta en su panel. Si no configuró nada, la respuesta es una
// lista vacía y la sección se oculta sola.
//
// LO QUE HUBO ANTES, y por qué ya no está: estos catálogos vivían hardcodeados
// en CotizacionesClient con los tours de Paraíso ("Expedición Tamul", suites
// "Flor de Liz"...), y CUALQUIER hotel los veía en sus desplegables — una fuga
// entre clientes. Se acotó a un fallback por slug como puente hasta que hubiera
// editor en el panel; el editor ya existe, así que el puente se retiró. Un
// catálogo de regalo es que un hotelero abra una reserva y vea paquetes con los
// nombres de habitación y los precios de otro hotel, sin haber creado ninguno.
//
// Módulo sin 'use client': lo importan el server (page.tsx) y los componentes
// cliente.

export interface TourCat {
  nombre: string;
  precio: number;
}

export interface PaqueteCat {
  nombre: string;
  habitacionDefault: string;
  noches: number;
  personas: number;
  precio: number;
  descripcion: string;
}

// Forma de extras.cotizaciones (lo que el hotelero configura en el panel).
export interface CotizacionesExtras {
  tours?: TourCat[];
  paquetes?: PaqueteCat[];
}

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Normaliza/valida los tours guardados en extras.cotizaciones. */
export function toursDeExtras(cot: unknown): TourCat[] {
  const raw = (cot as CotizacionesExtras | null)?.tours;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => ({ nombre: s((t as TourCat)?.nombre), precio: Math.max(0, num((t as TourCat)?.precio)) }))
    .filter((t) => t.nombre);
}

/** Normaliza/valida los paquetes guardados en extras.cotizaciones. */
export function paquetesDeExtras(cot: unknown): PaqueteCat[] {
  const raw = (cot as CotizacionesExtras | null)?.paquetes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      const o = p as PaqueteCat;
      return {
        nombre: s(o?.nombre),
        habitacionDefault: s(o?.habitacionDefault),
        noches: Math.max(1, Math.round(num(o?.noches, 1))),
        personas: Math.max(1, Math.round(num(o?.personas, 1))),
        precio: Math.max(0, num(o?.precio)),
        descripcion: s(o?.descripcion),
      };
    })
    .filter((p) => p.nombre);
}

/**
 * Tours ofrecidos por el hotel. SÓLO los que el hotelero configuró.
 *
 * Ya no hay fallback a un catálogo escrito a mano. Lo había —los tours de
 * Paraíso para el hotel con slug `paraiso-encantado`— como puente hasta que
 * existiera el editor del panel, y ese editor ya existe. Un catálogo de regalo
 * significa que un hotelero abre el alta de una reserva y ve cinco paquetes con
 * los nombres de habitación y los precios de OTRO hotel, sin haber creado
 * ninguno. Vacío es la respuesta correcta: la sección se oculta sola.
 */
export function catalogoTours(cot?: unknown): TourCat[] {
  return toursDeExtras(cot);
}

/** Paquetes ofrecidos por el hotel. SÓLO los que el hotelero configuró. */
export function catalogoPaquetes(cot?: unknown): PaqueteCat[] {
  return paquetesDeExtras(cot);
}
