'use client';

import styles from './ingresos.module.css';

interface KPIs {
  semana: { ingresos: number; reservas: number };
  mes: { ingresos: number; reservas: number; ocupacion: number; adr: number; revpar: number; deltaIngresos: number; deltaOcupacion: number };
  año: { ingresos: number; reservas: number };
  porMes: { mes: string; ingresos: number; reservas: number }[];
  suitesMasVendidas: { suite: string; noches: number; ingresos: number }[];
}

interface Props { kpis: KPIs }

function KPICard({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number }) {
  return (
    <div className={styles.kpiCard}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      {sub && <p className={styles.kpiSub}>{sub}</p>}
      {delta !== undefined && (
        <p className={styles.kpiDelta} style={{ color: delta >= 0 ? '#2d7a34' : '#c9484a' }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs mes anterior
        </p>
      )}
    </div>
  );
}

const MXN = (v: number) => `$${v.toLocaleString('es-MX')}`;

// Gráfica de barras inline en SVG (reemplaza recharts, que no existe en Kora).
// Mantiene los mismos datos (kpis.porMes) y el verde de marca.
function IngresosBarChart({ data }: { data: { mes: string; ingresos: number }[] }) {
  const W = 720, H = 260;
  const padL = 44, padR = 16, padT = 8, padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...data.map(d => d.ingresos));
  // Redondea el tope a un "k" agradable para los ticks del eje Y.
  const niceMax = Math.ceil(max / 1000) * 1000 || 1000;
  const n = data.length || 1;
  const slot = plotW / n;
  const barW = Math.min(40, slot * 0.6);
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Ingresos por mes">
      {/* Grid + eje Y */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const val = (niceMax / ticks) * i;
        const y = padT + plotH - (val / niceMax) * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="11" fill="#4b5563">
              ${Math.round(val / 1000)}k
            </text>
          </g>
        );
      })}
      {/* Barras */}
      {data.map((d, i) => {
        const h = (d.ingresos / niceMax) * plotH;
        const x = padL + slot * i + (slot - barW) / 2;
        const y = padT + plotH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx={4} fill="#1B4332">
              <title>{`${d.mes}: ${MXN(d.ingresos)} MXN`}</title>
            </rect>
            <text x={x + barW / 2} y={H - padB + 16} textAnchor="middle" fontSize="11" fill="#4b5563">
              {d.mes}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function IngresosClient({ kpis }: Props) {
  const anioActual = new Date().getFullYear();
  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Ingresos</h1>
        <p className={styles.pageSub}>Métricas en tiempo real de tu hotel</p>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KPICard label="Ingresos esta semana" value={MXN(kpis.semana.ingresos)} sub={`${kpis.semana.reservas} reservas`} />
        <KPICard label="Ingresos este mes" value={MXN(kpis.mes.ingresos)} sub={`${kpis.mes.reservas} reservas`} delta={kpis.mes.deltaIngresos} />
        <KPICard label="Ocupación del mes" value={`${kpis.mes.ocupacion}%`} delta={kpis.mes.deltaOcupacion} />
        <KPICard label="ADR (precio promedio/noche)" value={MXN(kpis.mes.adr)} sub="Average Daily Rate" />
        <KPICard label="RevPAR" value={MXN(kpis.mes.revpar)} sub="Revenue per Available Room" />
        <KPICard label={`Ingresos año ${anioActual}`} value={MXN(kpis.año.ingresos)} sub={`${kpis.año.reservas} reservas totales`} />
      </div>

      {/* Gráfica de ingresos por mes */}
      <div className={styles.chartCard}>
        <h2 className={styles.chartTitle}>Ingresos por mes (últimos 12 meses)</h2>
        <IngresosBarChart data={kpis.porMes} />
      </div>

      {/* Suites más vendidas */}
      <div className={styles.tableCard}>
        <h2 className={styles.chartTitle}>Suites más vendidas (año actual)</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>Suite</th><th>Noches vendidas</th><th>Ingresos</th></tr>
          </thead>
          <tbody>
            {kpis.suitesMasVendidas.map(s => (
              <tr key={s.suite}>
                <td>{s.suite}</td>
                <td>{s.noches} noches</td>
                <td className={styles.total}>{MXN(s.ingresos)}</td>
              </tr>
            ))}
            {kpis.suitesMasVendidas.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign:'center', padding: 24, color: 'var(--sage)' }}>Sin datos de ventas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
