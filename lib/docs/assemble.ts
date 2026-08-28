// Arma los datos por-defecto de los documentos (cotización / reserva) a partir
// del registro + el hotel, y aplica encima los overrides guardados (columna
// `doc`). Lo usan el /render (PDF final) y la página del editor: misma fuente de
// verdad. SOLO se usa desde el servidor (recibe la fila del hotel).

import type { HotelRow } from "@/lib/tenant";
import type { AdminQuote, AdminBooking } from "@/lib/db/admin";
import { bookingBrandFromHotel, type BookingBrand } from "@/lib/email/booking-branded";
import { bookingRules } from "@/lib/booking/rooms";
import { calcDepositAmount } from "@/lib/booking/engine";
import type { CotizacionDocData, ReservaDocData, DocConcepto } from "./documento-branded";
import { parseNotas, type PaqueteItem, type HabItem } from "@/lib/notas";

// ── Helpers de formato ───────────────────────────────────────────────────────
const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MF = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function money(n: number): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
// "YYYY-MM-DD" → Date local (o null).
function dateOnly(s: string): Date | null {
  const d = new Date((s || "") + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function isoDate(s: string): Date | null {
  const d = new Date(s || "");
  return isNaN(d.getTime()) ? null : d;
}
function dia(s: string): string {
  const d = dateOnly(s);
  return d ? String(d.getDate()) : "—";
}
function detalleMesAnio(s: string): string {
  const d = dateOnly(s);
  return d ? `${WD[d.getDay()]} · ${MS[d.getMonth()]} ${d.getFullYear()}` : "";
}
function fmtCorta(d: Date): string {
  return `${d.getDate()} ${MS[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}
function fmtLarga(d: Date): string {
  return `${d.getDate()} de ${MF[d.getMonth()]} ${d.getFullYear()}`;
}
function nochesTxt(n: number): string {
  return `${n} ${n === 1 ? "noche" : "noches"}`;
}
function limpiaSuites(csv: string): string {
  return csv
    .split(",")
    .map((s) => s.replace(/\s*\([^)]*\)/g, "").trim())
    .filter(Boolean)
    .join(", ");
}

// ── Parsers del campo `notas` (sobrecargado con separadores) ─────────────────
interface TourItem { nombre: string; personas: number; precio: number }

// Éste era el ÚNICO de los cinco parsers que cortaba bien, y de aquí salió
// `lib/notas.ts`. Se queda como envoltorio para que no haya dos.
const parseTours = (notas: string) => parseNotas(notas).tours;
const parsePaquetes = (notas: string) => parseNotas(notas).paquetes;
const parseHabs = (notas: string) => parseNotas(notas).habitaciones;

// Conceptos = línea de hospedaje (total − extras) + tours + paquetes. Es la misma
// aproximación que ya usaban los /render (no hay desglose persistido).
function construirConceptos(
  habitacion: string,
  noches: number,
  total: number,
  tours: TourItem[],
  paquetes: PaqueteItem[],
): DocConcepto[] {
  const toursTotal = tours.reduce((s, t) => s + (Number(t.precio) || 0) * (Number(t.personas) || 0), 0);
  const paqTotal = paquetes.reduce((s, p) => s + (Number(p.precio) || 0), 0);
  const hospedaje = Math.max(0, total - toursTotal - paqTotal);
  const conceptos: DocConcepto[] = [
    {
      nombre: habitacion || "Hospedaje",
      descripcion: `Alojamiento · ${nochesTxt(noches)}`,
      cantidad: nochesTxt(noches),
      precio_unitario: money(noches ? hospedaje / noches : hospedaje),
      importe: money(hospedaje),
    },
    ...tours.map((t) => ({
      nombre: t.nombre,
      descripcion: `Experiencia · ${t.personas} ${t.personas === 1 ? "persona" : "personas"}`,
      cantidad: `${t.personas} pax`,
      precio_unitario: money(t.precio),
      importe: money((Number(t.precio) || 0) * (Number(t.personas) || 0)),
    })),
    ...paquetes.map((p) => ({
      nombre: `🎁 ${p.nombre}`,
      descripcion: p.habitacion ? `Paquete · ${p.habitacion}` : "Paquete",
      cantidad: "1",
      precio_unitario: money(p.precio),
      importe: money(p.precio),
    })),
  ];
  return conceptos;
}

/** Overrides guardados (columna `doc`): un Partial de los datos del documento. */
export type DocOverridesCotizacion = Partial<CotizacionDocData>;
export type DocOverridesReserva = Partial<ReservaDocData>;

// ── Cotización ───────────────────────────────────────────────────────────────
export function cotizacionDefaults(hotel: HotelRow, q: AdminQuote): CotizacionDocData {
  const noches = q.noches || 1;
  const total = q.precioTotal || 0;
  const habitacion = limpiaSuites(q.suite);
  const habs = parseHabs(q.notas);
  const huespedes = habs.length
    ? habs.reduce((s, h) => s + (Number(h.huespedes) || 0), 0)
    : Math.max(1, limpiaSuites(q.suite).split(",").filter(Boolean).length * 2);
  const tours = parseTours(q.notas);
  const paquetes = parsePaquetes(q.notas);

  const rules = bookingRules(hotel);
  const anticipo = calcDepositAmount(total, noches, {
    pct: rules.anticipoPct,
    minNights: rules.anticipoMinNoches,
  });

  const emision = isoDate(q.fecha) ?? new Date(0);
  const vigente = isoDate(q.fecha);
  if (vigente) vigente.setDate(vigente.getDate() + 7);

  return {
    folio: q.id,
    fecha_emision: isoDate(q.fecha) ? fmtCorta(emision) : "",
    valida_hasta: vigente ? fmtLarga(vigente) : "",
    cliente_nombre: q.cliente || "—",
    cliente_email: q.email || "",
    cliente_telefono: q.telefono || "",
    habitacion: habitacion || "—",
    huespedes: String(huespedes),
    noches: String(noches),
    entrada_dia: dia(q.checkin),
    entrada_detalle: detalleMesAnio(q.checkin),
    salida_dia: dia(q.checkout),
    salida_detalle: detalleMesAnio(q.checkout),
    conceptos: construirConceptos(habitacion, noches, total, tours, paquetes),
    subtotal: money(total),
    total: money(total),
    moneda: "MXN",
    anticipo_pct: `${rules.anticipoPct}%`,
    anticipo: money(anticipo),
    saldo: money(Math.max(0, total - anticipo)),
  };
}

export function assembleCotizacion(
  hotel: HotelRow,
  q: AdminQuote,
): { brand: BookingBrand; data: CotizacionDocData } {
  const defaults = cotizacionDefaults(hotel, q);
  const saved = (q.doc ?? {}) as DocOverridesCotizacion;
  return { brand: bookingBrandFromHotel(hotel), data: { ...defaults, ...saved } };
}

// ── Reserva ──────────────────────────────────────────────────────────────────
export function reservaDefaults(hotel: HotelRow, b: AdminBooking): ReservaDocData {
  const noches = b.noches || 1;
  const total = b.total || 0;
  const anticipo = b.anticipo || 0;
  const habitacion = limpiaSuites(b.habitaciones);
  const huespedes = b.huespedes || Math.max(1, habitacion.split(",").filter(Boolean).length * 2);
  const tours = parseTours(b.notas);
  const paquetes = parsePaquetes(b.notas);

  const reservada = isoDate(b.fecha);

  return {
    folio: b.confirmacion,
    fecha_reserva: reservada ? fmtCorta(reservada) : "",
    cliente_nombre: b.cliente || "—",
    cliente_email: b.email || "",
    cliente_telefono: b.telefono || "",
    habitacion: habitacion || "—",
    huespedes: String(huespedes),
    noches: String(noches),
    entrada_dia: dia(b.checkin),
    entrada_detalle: `${detalleMesAnio(b.checkin)} · desde 3:00 PM`,
    salida_dia: dia(b.checkout),
    salida_detalle: `${detalleMesAnio(b.checkout)} · antes 12:00 PM`,
    conceptos: construirConceptos(habitacion, noches, total, tours, paquetes),
    total_estancia: money(total),
    moneda: "MXN",
    anticipo_pagado: money(anticipo),
    restante: money(Math.max(0, total - anticipo)),
    // Sin columnas de pago: default legible (editable en el editor).
    metodo_pago: "Anticipo registrado",
    fecha_pago: reservada ? fmtCorta(reservada) : "",
  };
}

export function assembleReserva(
  hotel: HotelRow,
  b: AdminBooking,
): { brand: BookingBrand; data: ReservaDocData } {
  const defaults = reservaDefaults(hotel, b);
  const saved = (b.doc ?? {}) as DocOverridesReserva;
  return { brand: bookingBrandFromHotel(hotel), data: { ...defaults, ...saved } };
}
