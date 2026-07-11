// Catálogo de tours y paquetes para Cotizaciones y el modal de reservas.
//
// PUENTE MULTI-TENANT (temporal): antes estos catálogos vivían HARDCODEADOS en
// CotizacionesClient con los tours de Paraíso Encantado ("Expedición Tamul",
// suites "Flor de Liz"...), así que CUALQUIER otro hotel los veía en sus
// dropdowns — una fuga de datos entre clientes. Ahora el catálogo se resuelve por
// hotel: hoy solo el hotel piloto (Paraíso) trae catálogo; el resto ve VACÍO
// (sección oculta) hasta que se configure el suyo.
//
// Fase 2 sustituirá esta resolución por-slug con un editor en el panel que guarde
// el catálogo en hotel.extras.cotizaciones. Cuando eso exista, ESTE archivo es el
// único lugar que hay que tocar. Módulo sin 'use client': lo importan tanto el
// server (page.tsx) como los componentes cliente.

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

// Slug del hotel piloto en la plataforma (verificado en la BD).
const PARAISO_SLUG = 'paraiso-encantado';

export const PARAISO_TOURS: TourCat[] = [
  { nombre: 'Expedición Tamul (Sótano + Cascada + Cenote)', precio: 1450 },
  { nombre: 'Ruta Surrealista (Las Pozas + Huichihuayán)', precio: 1300 },
  { nombre: 'Cascadas del Meco (El Meco + El Salto)', precio: 1600 },
  { nombre: 'Paraíso Escalonado (Minas Viejas + Micos)', precio: 1500 },
  { nombre: 'Ruta Acuática (Puente de Dios + Siete Cascadas)', precio: 1500 },
  { nombre: 'Sótano de las Golondrinas', precio: 800 },
  { nombre: 'Tour personalizado', precio: 0 },
];

export const PARAISO_PAQUETES: PaqueteCat[] = [
  { nombre: 'Noche de Selva',      habitacionDefault: 'Suite Flor de Liz 1', noches: 2, personas: 2, precio: 5200,  descripcion: '2 noches · spa privado · 2 desayunos · Las Pozas' },
  { nombre: 'Ruta de las Pozas',   habitacionDefault: 'Jungla',              noches: 3, personas: 2, precio: 8900,  descripcion: '3 noches · desayunos · tour Las Pozas · tour Tamul' },
  { nombre: 'Familia Huasteca',    habitacionDefault: 'Helechos 1',          noches: 3, personas: 4, precio: 13500, descripcion: '3 noches · suite familiar · desayunos · tour Las Pozas' },
  { nombre: 'Selva en Silencio',   habitacionDefault: 'Suite LindaVista',    noches: 3, personas: 2, precio: 6900,  descripcion: '3 noches · tour Las Pozas (grupo reducido) · late check-out' },
  { nombre: 'Paquete personalizado', habitacionDefault: 'Jungla',            noches: 2, personas: 2, precio: 0,     descripcion: '' },
];

/** Tours ofrecidos por este hotel (vacío si aún no configura los suyos). */
export function catalogoTours(slug: string): TourCat[] {
  return slug === PARAISO_SLUG ? PARAISO_TOURS : [];
}

/** Paquetes ofrecidos por este hotel (vacío si aún no configura los suyos). */
export function catalogoPaquetes(slug: string): PaqueteCat[] {
  return slug === PARAISO_SLUG ? PARAISO_PAQUETES : [];
}
