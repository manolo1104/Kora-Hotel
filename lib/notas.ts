// El campo `notas` de una reserva o cotización: leerlo y escribirlo, en UN solo
// sitio. Función pura, sin base de datos ni React — la usan igual el servidor,
// los correos, los documentos y el panel.
//
// ─── QUÉ ES ESE CAMPO ────────────────────────────────────────────────────────
//
// `bookings.notas` y `quotes.notas` guardan cinco cosas en una sola columna de
// texto, separadas por marcas de máquina y SIEMPRE en este orden:
//
//   <texto para el cliente> ||INTERNO|| <texto interno> ||TOURS|| [json] ||PAQUETES|| [json] ||HABS|| [json]
//
// Ninguno de los bloques es obligatorio. El orden sí: es lo que permite cortar
// cada uno por las marcas que vienen DESPUÉS.
//
// ─── POR QUÉ ESTE ARCHIVO EXISTE (K-10, K-35, K-36, K-37, K-129) ─────────────
//
// Había CINCO copias de este parser y tres estaban rotas, cada una de una forma
// distinta, porque cada copia olvidaba cortar por una marca diferente:
//
//   · `app/api/admin/reservas/[id]/send-email`: los tours se cortaban por
//     ||PAQUETES|| pero NO por ||HABS||. Una reserva con tours y habitaciones
//     pero sin paquetes —que es el caso normal— le pasaba a JSON.parse el texto
//     `[…tours]||HABS||[…habs]`, reventaba, y el `catch` devolvía []. Resultado:
//     **los tours que el huésped PAGÓ desaparecían de su correo de confirmación.**
//   · `components/admin/ReservationModal`: los paquetes tampoco se cortaban por
//     ||HABS||, así que se esfumaban al reabrir la reserva para editarla.
//   · `app/panel/…/cotizaciones/CotizacionesClient`: los tours no se cortaban
//     por NADA. Una cotización con tours y cualquier otro bloque detrás perdía
//     los tours enteros al reabrirla.
//
// El que sí estaba bien era `lib/docs/assemble.ts`, y de ahí sale éste.
//
// La lección, que es la razón de que esto viva en un archivo propio: cinco
// copias de veinte líneas no divergen porque alguien se equivoque una vez, sino
// porque al añadir un bloque nuevo (`||HABS||` llegó después que `||TOURS||`)
// hay que acordarse de tocar las cinco. Con una sola, no hay nada que recordar.

/** Un tour vendido con la reserva. `precio` es POR PERSONA. */
export interface TourItem {
  nombre: string;
  personas: number;
  precio: number;
}

/** Un paquete vendido con la reserva. `precio` es el total del paquete. */
export interface PaqueteItem {
  nombre: string;
  habitacion: string;
  noches: number;
  personas: number;
  precio: number;
}

/** Una habitación de la reserva, con su ocupación. */
export interface HabItem {
  suite: string;
  huespedes: number;
  /** Tarifa por noche fijada a mano para ESTA habitación (la escribe el panel). */
  precioOverride?: number;
}

export interface NotasReserva {
  /** Lo que el hotelero escribió PARA EL CLIENTE (sale en correos y documentos). */
  cliente: string;
  /** Lo que escribió para el equipo. NUNCA debe salir de Kora. */
  interno: string;
  tours: TourItem[];
  paquetes: PaqueteItem[];
  habitaciones: HabItem[];
}

export const INTERNO_SEP = "||INTERNO||";
export const TOURS_SEP = "||TOURS||";
export const PAQUETES_SEP = "||PAQUETES||";
export const HABS_SEP = "||HABS||";

/** Las marcas, en el orden en que aparecen. El orden es el contrato. */
const MARCAS = [INTERNO_SEP, TOURS_SEP, PAQUETES_SEP, HABS_SEP];

/**
 * El trozo que empieza en `marca` y termina en la siguiente marca que exista.
 * Cortar por TODAS las posteriores —y no por una elegida a mano— es justo lo
 * que las cinco copias hacían mal.
 */
function trozo(notas: string, marca: string): string | null {
  const i = notas.indexOf(marca);
  if (i === -1) return null;
  let resto = notas.slice(i + marca.length);
  for (const siguiente of MARCAS.slice(MARCAS.indexOf(marca) + 1)) {
    resto = resto.split(siguiente)[0];
  }
  return resto;
}

/** JSON.parse que nunca lanza y que sólo acepta arreglos. */
function arreglo<T>(crudo: string | null): T[] {
  if (!crudo) return [];
  try {
    const v = JSON.parse(crudo);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Lee el campo `notas` completo. Nunca lanza; los bloques que falten van vacíos. */
export function parseNotas(notas: string | null | undefined): NotasReserva {
  const s = notas ?? "";
  const primeraMarca = MARCAS.map((m) => s.indexOf(m)).filter((i) => i !== -1);
  const finCliente = primeraMarca.length ? Math.min(...primeraMarca) : s.length;
  return {
    cliente: s.slice(0, finCliente).trim(),
    interno: (trozo(s, INTERNO_SEP) ?? "").trim(),
    tours: arreglo<TourItem>(trozo(s, TOURS_SEP)),
    paquetes: arreglo<PaqueteItem>(trozo(s, PAQUETES_SEP)),
    habitaciones: arreglo<HabItem>(trozo(s, HABS_SEP)),
  };
}

/**
 * Sólo el texto que ve el cliente. Es el atajo que más se usa (correos y
 * documentos), y tenerlo aquí evita que alguien lo vuelva a hacer con un
 * `.split()` suelto que se deje una marca.
 */
export function notasDelCliente(notas: string | null | undefined): string {
  return parseNotas(notas).cliente;
}

/**
 * Escribe el campo. Es la otra mitad del contrato: había DOS escritores
 * (`CotizacionesClient` y `ReservationModal`) con el mismo formato copiado a
 * mano, y bastaba con que uno añadiera un bloque para que el otro se quedara
 * atrás. Los bloques vacíos no se escriben.
 */
export function construirNotas(n: Partial<NotasReserva>): string {
  let out = (n.cliente ?? "").trim();
  if ((n.interno ?? "").trim()) out += `${INTERNO_SEP}${(n.interno ?? "").trim()}`;
  if (n.tours?.length) out += `${TOURS_SEP}${JSON.stringify(n.tours)}`;
  if (n.paquetes?.length) out += `${PAQUETES_SEP}${JSON.stringify(n.paquetes)}`;
  if (n.habitaciones?.length) out += `${HABS_SEP}${JSON.stringify(n.habitaciones)}`;
  return out;
}

/** Lo que suman los tours (precio POR PERSONA × personas). */
export function totalTours(tours: TourItem[]): number {
  return tours.reduce((s, t) => s + (Number(t.precio) || 0) * (Number(t.personas) || 0), 0);
}

/** Lo que suman los paquetes (precio total de cada uno). */
export function totalPaquetes(paquetes: PaqueteItem[]): number {
  return paquetes.reduce((s, p) => s + (Number(p.precio) || 0), 0);
}
