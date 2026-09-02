import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { FORECAST_DIAS } from "@/lib/oferta";
import { hoyHotel } from "@/lib/fecha-hotel";
import { ocupaElCuarto } from "@/lib/booking/estado-operativo";
import type { AdminBooking } from './sheets-admin';

const OTA_COMMISSION = 0.15; // 15% Booking.com / Airbnb

// OJO: sólo para fechas que ya son "un día concreto" (las barras del forecast,
// que se construyen sumando días a partir de hoy). Para saber QUÉ DÍA ES HOY va
// `hoyHotel()`: `toISOString()` es UTC y de las 18:00 a la medianoche adelantaba
// un día, contradiciendo a la lista de Reservas. Ver lib/fecha-hotel.ts.
function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function parseTotal(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  return parseInt(String(raw).replace(/[^0-9]/g, ''), 10) || 0;
}

// Unidades que ocupa una reserva (el CSV de habitaciones puede traer varias).
// Una reserva de 2 unidades cuenta como 2 en la ocupación, no como 1.
function countUnits(habitaciones: string): number {
  return String(habitaciones || '').split(',').map((s) => s.trim()).filter(Boolean).length;
}

function isActive(b: AdminBooking): boolean {
  // `reservaCuenta` incluye REEMBOLSADA: un cuarto devuelto no está ocupado.
  return reservaCuenta(b.estado);
}

function bookingCoversDate(b: AdminBooking, date: Date): boolean {
  if (!b.checkin || !b.checkout || !isActive(b)) return false;
  const ci = new Date(b.checkin + 'T00:00:00');
  const co = new Date(b.checkout + 'T00:00:00');
  return ci <= date && date < co;
}


export interface TodayMovement {
  tipo: 'checkin' | 'checkout';
  cliente: string;
  habitaciones: string;
  huespedes: number;
  noches: number;
  total: number;
  confirmacion: string;
}

export interface DayForecast {
  fecha: string;
  label: string;
  ocupadas: number;
  porcentaje: number;
}

export interface OriginBreakdown {
  label: string;
  count: number;
  ingresos: number;
  color: string;
}

export interface AgentSummary {
  whatsapp: { conversacionesHoy: number; conversacionesMes: number };
  emails: { confirmacion: number; preestancia: number; postestancia: number };
  blogs: number;
}

export interface InsightsData {
  hoy: {
    fecha: string;
    suitesOcupadas: number;
    porcentajeOcupacion: number;
    movimientos: TodayMovement[];
  };
  mes: {
    ingresos: number;
    reservas: number;
    revpar: number;
    adr: number;
    ocupacion: number;
  };
  forecastDias: DayForecast[];
  origen: OriginBreakdown[];
  ahorroOTAs: number;
  agentes: AgentSummary;
  /** Total de cuartos del hotel (para que el cliente no hardcodee "13"). */
  totalSuites: number;
}

export function calcInsights(
  bookings: AdminBooking[],
  agentMetrics: { tipo: string; fecha: string }[],
  // Sin valor por defecto A PROPÓSITO. Era `= TOTAL_SUITES`, un 13 escrito a
  // mano heredado de Paraíso: en un producto multi-hotel, el día que alguien
  // llamara sin pasarlo, ese hotel habría enseñado su ocupación calculada sobre
  // los cuartos de OTRO. Los dos únicos que llaman ya pasan `totalUnits(hotel)`.
  totalSuites: number
): InsightsData {
  const now = new Date();
  // Hoy en la zona del hotel, no en UTC: era lo que hacía que estas cifras
  // contradijeran a la lista de Reservas cada tarde. Ver lib/fecha-hotel.ts.
  const todayStr = hoyHotel(now);
  const today = new Date(todayStr + 'T00:00:00');

  // ── HOY ─────────────────────────────────────────────────────────────
  const suitesOcupadasHoy = bookings
    // La MISMA función que usa el mapa de cuartos: antes las gráficas
    // seguían contando ocupado al que ya salió y no contaban al walk-in.
    .filter(b => ocupaElCuarto(b, todayStr))
    .reduce((s, b) => s + countUnits(b.habitaciones), 0);
  const pctOcupacion = Math.round((suitesOcupadasHoy / totalSuites) * 100);

  const checkins: TodayMovement[] = bookings
    .filter(b => b.checkin === todayStr && isActive(b))
    .map(b => ({
      tipo: 'checkin',
      cliente: b.cliente,
      habitaciones: b.habitaciones,
      huespedes: b.huespedes,
      noches: b.noches || calcNights(b),
      total: parseTotal(b.total),
      confirmacion: b.confirmacion,
    }));

  const checkouts: TodayMovement[] = bookings
    .filter(b => b.checkout === todayStr && isActive(b))
    .map(b => ({
      tipo: 'checkout',
      cliente: b.cliente,
      habitaciones: b.habitaciones,
      huespedes: b.huespedes,
      noches: b.noches || calcNights(b),
      total: parseTotal(b.total),
      confirmacion: b.confirmacion,
    }));

  // ── MES ACTUAL ───────────────────────────────────────────────────────
  const mesStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mesEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diasMes = mesEnd.getDate() === 1
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    : 30;

  const bookingsMes = bookings.filter(b => {
    if (!b.checkin || !isActive(b)) return false;
    const ci = new Date(b.checkin + 'T00:00:00');
    return ci >= mesStart && ci < mesEnd;
  });

  const ingresosMes = bookingsMes.reduce((s, b) => s + parseTotal(b.total), 0);
  // × unidades: una reserva de 2 cuartos son 2 noches-cuarto, no 1. `kpis.ts:69`
  // ya lo hacía así y este bloque no, de modo que el mismo hotel enseñaba dos
  // ocupaciones y dos ADR distintos según la pantalla.
  const nochesMes = bookingsMes.reduce(
    (s, b) => s + (b.noches || calcNights(b)) * countUnits(b.habitaciones),
    0,
  );
  const nochesDisp = totalSuites * diasMes;
  const ocupacionMes = nochesMes > 0 ? Math.round((nochesMes / nochesDisp) * 100) : 0;
  const adrMes = nochesMes > 0 ? Math.round(ingresosMes / nochesMes) : 0;
  const revparMes = Math.round((adrMes * ocupacionMes) / 100);

  // ── FORECAST (los días los fija lib/oferta.ts, que es lo que el sitio promete) ──
  // El nombre NO lleva el número a propósito: se llamaba `forecast7dias` y el día
  // que el número cambie, un nombre con "7" dentro empieza a mentir.
  const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const forecastDias: DayForecast[] = Array.from({ length: FORECAST_DIAS }, (_, i) => {
    const d = addDays(today, i);
    const ocupadas = bookings
      .filter(b => bookingCoversDate(b, d))
      .reduce((s, b) => s + countUnits(b.habitaciones), 0);
    return {
      fecha: toDateStr(d),
      label: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DIAS_ES[d.getDay()],
      ocupadas,
      porcentaje: Math.round((ocupadas / totalSuites) * 100),
    };
  });

  // ── ORIGEN DE RESERVAS (mes actual) ──────────────────────────────────
  const origenMap: Record<string, { count: number; ingresos: number }> = {
    Web: { count: 0, ingresos: 0 },
    'Camila (bot)': { count: 0, ingresos: 0 },
    WhatsApp: { count: 0, ingresos: 0 },
    Manual: { count: 0, ingresos: 0 },
  };

  for (const b of bookingsMes) {
    const total = parseTotal(b.total);
    if (b.estado === 'MANUAL') {
      origenMap['Manual'].count++;
      origenMap['Manual'].ingresos += total;
    } else if (b.origen === 'bot') {
      // Reserva CERRADA por el bot de WhatsApp (Camila): el foso vendiendo solo.
      origenMap['Camila (bot)'].count++;
      origenMap['Camila (bot)'].ingresos += total;
    } else if (b.notas?.toLowerCase().includes('whatsapp') || b.comoNosConocio?.toLowerCase().includes('whatsapp')) {
      origenMap['WhatsApp'].count++;
      origenMap['WhatsApp'].ingresos += total;
    } else {
      origenMap['Web'].count++;
      origenMap['Web'].ingresos += total;
    }
  }

  const ORIGIN_COLORS: Record<string, string> = {
    Web: '#C9A97A',
    'Camila (bot)': '#2dd4bf',
    WhatsApp: '#4ade80',
    Manual: '#93c5fd',
  };

  const origen: OriginBreakdown[] = Object.entries(origenMap)
    .filter(([, v]) => v.count > 0)
    .map(([label, v]) => ({ label, ...v, color: ORIGIN_COLORS[label] }));

  // ── AHORRO OTAs (año corriente, reservas directas) ───────────────────
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const bookingsYear = bookings.filter(b => {
    if (!b.checkin || !isActive(b)) return false;
    return new Date(b.checkin + 'T00:00:00') >= yearStart;
  });
  const ingresosYear = bookingsYear.reduce((s, b) => s + parseTotal(b.total), 0);
  const ahorroOTAs = Math.round(ingresosYear * OTA_COMMISSION);

  // ── MÉTRICAS AGENTES ─────────────────────────────────────────────────
  const mesMesStr = todayStr.substring(0, 7); // "2026-05"

  const waHoy = agentMetrics.filter(m => m.tipo === 'whatsapp_conv' && m.fecha === todayStr).length;
  const waMes = agentMetrics.filter(m => m.tipo === 'whatsapp_conv' && m.fecha.startsWith(mesMesStr)).length;
  const emailConf = agentMetrics.filter(m => m.tipo === 'email_confirmacion' && m.fecha.startsWith(mesMesStr)).length;
  const emailPre = agentMetrics.filter(m => m.tipo === 'email_preestancia' && m.fecha.startsWith(mesMesStr)).length;
  const emailPost = agentMetrics.filter(m => m.tipo === 'email_postestancia' && m.fecha.startsWith(mesMesStr)).length;
  const blogs = agentMetrics.filter(m => m.tipo === 'blog_publicado' && m.fecha.startsWith(mesMesStr)).length;

  return {
    hoy: {
      fecha: todayStr,
      suitesOcupadas: suitesOcupadasHoy,
      porcentajeOcupacion: pctOcupacion,
      movimientos: [...checkins, ...checkouts],
    },
    mes: {
      ingresos: ingresosMes,
      reservas: bookingsMes.length,
      revpar: revparMes,
      adr: adrMes,
      ocupacion: ocupacionMes,
    },
    forecastDias,
    origen,
    ahorroOTAs,
    agentes: {
      whatsapp: { conversacionesHoy: waHoy, conversacionesMes: waMes },
      emails: { confirmacion: emailConf, preestancia: emailPre, postestancia: emailPost },
      blogs,
    },
    totalSuites,
  };
}

function calcNights(b: AdminBooking): number {
  if (!b.checkin || !b.checkout) return 0;
  const diff = (new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / 86400000;
  return Math.max(0, Math.round(diff));
}
