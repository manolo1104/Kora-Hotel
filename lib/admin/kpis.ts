import type { AdminBooking } from './sheets-admin';

const TOTAL_SUITES = 13;

function parseTotal(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  return parseInt(String(raw).replace(/[^0-9]/g, ''), 10) || 0;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function bookingInRange(b: AdminBooking, from: Date, to: Date): boolean {
  if (!b.checkin) return false;
  const ci = new Date(b.checkin + 'T00:00:00');
  return ci >= from && ci < to && b.estado !== 'CANCELADA';
}

function calcNightsForBooking(b: AdminBooking): number {
  if (b.noches > 0) return b.noches;
  if (b.checkin && b.checkout) {
    const diff = (new Date(b.checkout).getTime() - new Date(b.checkin).getTime()) / 86400000;
    return Math.max(0, Math.round(diff));
  }
  return 0;
}

export function calcKPIs(bookings: AdminBooking[]) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Semana actual
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // Mes actual
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diasMes = daysInMonth(now.getFullYear(), now.getMonth());

  // Mes anterior
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  // Año actual
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

  const bookingsWeek = bookings.filter(b => bookingInRange(b, weekStart, weekEnd));
  const bookingsMes = bookings.filter(b => bookingInRange(b, monthStart, monthEnd));
  const bookingsPrevMes = bookings.filter(b => bookingInRange(b, prevMonthStart, prevMonthEnd));
  const bookingsYear = bookings.filter(b => bookingInRange(b, yearStart, yearEnd));

  const ingresosWeek = bookingsWeek.reduce((s, b) => s + b.total, 0);
  const ingresosMes = bookingsMes.reduce((s, b) => s + b.total, 0);
  const ingresosPrevMes = bookingsPrevMes.reduce((s, b) => s + b.total, 0);
  const ingresosYear = bookingsYear.reduce((s, b) => s + b.total, 0);

  const nochesMes = bookingsMes.reduce((s, b) => s + calcNightsForBooking(b), 0);
  const nochesPrevMes = bookingsPrevMes.reduce((s, b) => s + calcNightsForBooking(b), 0);
  const nochesDisponiblesMes = TOTAL_SUITES * diasMes;

  const ocupacionMes = nochesMes > 0 ? Math.round((nochesMes / nochesDisponiblesMes) * 100) : 0;
  const ocupacionPrevMes = nochesPrevMes > 0 ? Math.round((nochesPrevMes / (TOTAL_SUITES * daysInMonth(prevMonthStart.getFullYear(), prevMonthStart.getMonth()))) * 100) : 0;

  const adrMes = nochesMes > 0 ? Math.round(ingresosMes / nochesMes) : 0;
  const revparMes = Math.round((adrMes * ocupacionMes) / 100);

  // Ingresos por mes (últimos 12)
  const porMes: { mes: string; ingresos: number; reservas: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const mBooks = bookings.filter(b => bookingInRange(b, mStart, mEnd));
    porMes.push({
      mes: mStart.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      ingresos: mBooks.reduce((s, b) => s + b.total, 0),
      reservas: mBooks.length,
    });
  }

  // Suites más vendidas
  const suitesMap = new Map<string, { noches: number; ingresos: number }>();
  for (const b of bookingsYear) {
    const key = b.habitaciones || 'Sin asignar';
    const prev = suitesMap.get(key) || { noches: 0, ingresos: 0 };
    suitesMap.set(key, {
      noches: prev.noches + calcNightsForBooking(b),
      ingresos: prev.ingresos + b.total,
    });
  }
  const suitesMasVendidas = Array.from(suitesMap.entries())
    .map(([suite, data]) => ({ suite, ...data }))
    .sort((a, b) => b.ingresos - a.ingresos)
    .slice(0, 8);

  // Delta mes vs mes anterior
  const deltaIngresos = ingresosPrevMes > 0
    ? Math.round(((ingresosMes - ingresosPrevMes) / ingresosPrevMes) * 100)
    : 0;
  const deltaOcupacion = ocupacionPrevMes > 0
    ? ocupacionMes - ocupacionPrevMes
    : 0;

  return {
    semana: {
      ingresos: ingresosWeek,
      reservas: bookingsWeek.length,
    },
    mes: {
      ingresos: ingresosMes,
      reservas: bookingsMes.length,
      ocupacion: ocupacionMes,
      adr: adrMes,
      revpar: revparMes,
      deltaIngresos,
      deltaOcupacion,
    },
    año: {
      ingresos: ingresosYear,
      reservas: bookingsYear.length,
    },
    porMes,
    suitesMasVendidas,
  };
}
