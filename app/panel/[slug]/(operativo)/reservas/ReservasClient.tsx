'use client';

import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { estadoOperativo, contadoresDeHoy, type EstadoOperativo } from "@/lib/booking/estado-operativo";
import { hoyHotel } from '@/lib/fecha-hotel';
import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, RefreshCw, Send, Download, Loader2, ChevronDown, ChevronUp, Sun, LogOut, LogIn, Printer, QrCode, UserCheck, Undo2 } from 'lucide-react';
import type { AdminBooking } from '@/lib/admin/sheets-admin';
import type { BookingRoom } from '@/lib/booking';
import ReservationModal from '@/components/admin/ReservationModal';
import RegistroModal from './RegistroModal';
import styles from './reservas.module.css';

// ── Operational state ────────────────────────────────────────────────────────
//
// La lógica vive en lib/booking/estado-operativo.ts, no aquí: los contadores de
// la vista "Hoy" la reimplementaban con filtros a mano y no coincidían con los
// chips de las filas. Ahora chip y número salen de la misma llamada, y hay
// pruebas que lo vigilan (tests/estado-operativo.test.ts).

type OpsState = EstadoOperativo;

const getOpsState = estadoOperativo;

const OPS_LABEL: Record<OpsState, string> = {
  CHECK_IN_HOY:  'Por llegar hoy',
  CHECK_OUT_HOY: 'Check-out Hoy',
  EN_CASA:       'En Casa',
  PROXIMA:       'Próxima',
  COMPLETADA:    'Completada',
  CANCELADA:     'Cancelada',
  REEMBOLSADA:   'Reembolsada',
  NO_SHOW:       'No Show',
  SALIO:         'Salió',
};

// Cada estado apunta a un PAR de variables, no a dos hex sueltos: así el tema
// oscuro los voltea a fondo teñido oscuro + texto claro (ver admin.module.css)
// en vez de dejarlos como parches brillantes sobre el panel.
const OPS_COLOR: Record<OpsState, { bg: string; color: string }> = {
  CHECK_IN_HOY:  { bg: 'var(--chip-ok-bg)',     color: 'var(--chip-ok-text)' },
  CHECK_OUT_HOY: { bg: 'var(--chip-aviso-bg)',  color: 'var(--chip-aviso-text)' },
  EN_CASA:       { bg: 'var(--chip-info-bg)',   color: 'var(--chip-info-text)' },
  PROXIMA:       { bg: 'var(--chip-neutro-bg)', color: 'var(--chip-neutro-text)' },
  COMPLETADA:    { bg: 'var(--chip-neutro-bg)', color: 'var(--chip-neutro-text)' },
  CANCELADA:     { bg: 'var(--chip-mal-bg)',    color: 'var(--chip-mal-text)' },
  REEMBOLSADA:   { bg: 'var(--chip-morado-bg)', color: 'var(--chip-morado-text)' },
  NO_SHOW:       { bg: 'var(--chip-rosa-bg)',   color: 'var(--chip-rosa-text)' },
  SALIO:         { bg: 'var(--chip-neutro-bg)', color: 'var(--chip-neutro-text)' },
};

// ── Days to arrival ──────────────────────────────────────────────────────────

function daysToArrival(checkin: string, today: string): number {
  return Math.round(
    (new Date(checkin + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000
  );
}

function DaysChip({ days }: { days: number }) {
  if (days < 0)  return <span className={styles.daysChip} style={{ background: 'var(--chip-neutro-bg)', color: 'var(--chip-neutro-text)' }}>Pasada</span>;
  if (days === 0) return <span className={styles.daysChip} style={{ background: 'var(--chip-ok-bg)', color: 'var(--chip-ok-text)', fontWeight: 700 }}>Hoy</span>;
  if (days === 1) return <span className={styles.daysChip} style={{ background: 'var(--chip-aviso-bg)', color: 'var(--chip-aviso-text)', fontWeight: 700 }}>Mañana</span>;
  if (days <= 3)  return <span className={styles.daysChip} style={{ background: 'var(--chip-aviso-bg)', color: 'var(--chip-aviso-text)' }}>{days}d</span>;
  if (days <= 7)  return <span className={styles.daysChip} style={{ background: 'var(--chip-aviso-bg)', color: 'var(--chip-aviso-text)' }}>{days}d</span>;
  if (days <= 14) return <span className={styles.daysChip} style={{ background: 'var(--chip-ok-bg)', color: '#3d6e40' }}>{days}d</span>;
  return <span className={styles.daysChip} style={{ background: 'var(--chip-neutro-bg)', color: 'var(--chip-neutro-text)' }}>{days}d</span>;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialBookings: AdminBooking[];
  rooms: BookingRoom[];
  slug: string;
  /**
   * ¿Ve el importe de cada reserva? Lo decide el SERVIDOR (`reservas:dinero`).
   * Con `false` desaparece la columna Total, el total de la tarjeta en móvil y
   * el modal —que es un desglose de dinero de arriba a abajo—, y la fila deja
   * de abrirse al pulsarla.
   */
  verDinero?: boolean;
  /** ¿Ve la SUMA del periodo del encabezado? Es `ingresos:ver`, de mando. */
  verTotalPeriodo?: boolean;
  /**
   * ¿Puede operar la reserva (check-out, mandar la confirmación, abrir el
   * documento)? Es `reservas:escribir`. Sin esto, la camarista veía tres
   * botones que su API contesta con un 403 — y un botón que lleva a una puerta
   * cerrada se lee como que el panel se descompuso.
   */
  verAcciones?: boolean;
}

export default function ReservasClient({
  initialBookings,
  rooms,
  slug,
  verDinero = true,
  verTotalPeriodo = true,
  verAcciones = true,
}: Props) {
  // slug se usa para resolver el catálogo de tours/paquetes por hotel en el modal.
  const SUITES = useMemo(() => rooms.map(r => r.name), [rooms]);

  const [bookings, setBookings] = useState(initialBookings);
  const [search, setSearch] = useState('');
  const [suiteFilter, setSuiteFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [vistaHoy, setVistaHoy] = useState(false);
  const [sortBy, setSortBy] = useState<'checkin' | 'reciente'>('checkin');
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; booking?: AdminBooking; cuarto?: string; walkin?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [imprimiendoId, setImprimiendoId] = useState<string | null>(null);
  // Ventana del registro de llegada: el QR para el huésped, o su ficha si ya lo
  // llenó. Se abre desde el icono de la fila.
  const [registroDe, setRegistroDe] = useState<AdminBooking | null>(null);
  // Qué reservas YA tienen registro, para marcarlas en la lista. Sólo son ids:
  // ni un dato personal viaja hasta que alguien abre una ficha concreta.
  const [conRegistro, setConRegistro] = useState<Set<string>>(new Set());

  // Fecha de HOY en la zona del hotel, desde la fuente única (lib/fecha-hotel.ts).
  const today = useMemo(() => hoyHotel(), []);

  useEffect(() => {
    if (!verAcciones) return;
    let vivo = true;
    fetch('/api/admin/pre-checkin')
      .then(r => r.ok ? r.json() : { conRegistro: [] })
      .then(d => { if (vivo) setConRegistro(new Set(d.conRegistro ?? [])); })
      // La lista se pinta igual sin esto: la palomita es un adorno, no una
      // pantalla que dependa de ella. Pero el fallo se DICE — un `catch` vacío
      // es exactamente cómo se pierde un error de verdad.
      .catch(e => console.error('[reservas] no se pudo saber quién ya se registró:', e));
    return () => { vivo = false; };
  }, [verAcciones]);

  // WALK-IN: se llega aquí desde la tarjeta de un cuarto libre en el mapa
  // (`?walkin=<cuarto>`). Abre el alta ya prellenada con ese cuarto, entrada hoy
  // y la casilla de "ya está aquí" marcada, para que recepción no tenga que
  // teclear nada de eso con el huésped esperando delante.
  useEffect(() => {
    const cuarto = new URLSearchParams(window.location.search).get('walkin');
    if (!cuarto || !verAcciones) return;
    setModal({ mode: 'new', cuarto, walkin: true });
    // Se limpia de la URL para que recargar o compartir el enlace no vuelva a
    // abrir el alta encima de lo que el hotelero estuviera haciendo.
    window.history.replaceState(null, '', window.location.pathname);
  }, [verAcciones]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bookings.filter(b => {
      if (vistaHoy) {
        const ops = getOpsState(b, today);
        if (!['CHECK_IN_HOY','CHECK_OUT_HOY','EN_CASA','SALIO'].includes(ops)) return false;
      }
      if (q && !b.cliente.toLowerCase().includes(q) &&
          !b.email.toLowerCase().includes(q) &&
          !b.confirmacion.toLowerCase().includes(q) &&
          !b.habitaciones.toLowerCase().includes(q)) return false;
      if (suiteFilter && !b.habitaciones.includes(suiteFilter)) return false;
      if (estadoFilter) {
        const ops = getOpsState(b, today);
        if (ops !== estadoFilter) return false;
      }
      if (fechaDesde && b.checkin < fechaDesde) return false;
      if (fechaHasta && b.checkin > fechaHasta) return false;
      return true;
    }).sort((a, b) => {
      if (vistaHoy) {
        const order = { CHECK_IN_HOY: 0, EN_CASA: 1, CHECK_OUT_HOY: 2 };
        const ao = order[getOpsState(a, today) as keyof typeof order] ?? 9;
        const bo = order[getOpsState(b, today) as keyof typeof order] ?? 9;
        return ao - bo;
      }
      // "reciente" = por fecha de creación desc (la lista ya viene así de la BD).
      if (sortBy === 'reciente') return (b.fecha || '').localeCompare(a.fecha || '');
      return b.checkin.localeCompare(a.checkin);
    });
  }, [bookings, search, suiteFilter, estadoFilter, fechaDesde, fechaHasta, vistaHoy, sortBy, today]);

  // Contadores de la vista "Hoy", desde la MISMA función que pinta cada chip.
  const todayCounts = useMemo(() => contadoresDeHoy(bookings, today), [bookings, today]);

  const hasActiveFilters = suiteFilter || estadoFilter || fechaDesde || fechaHasta;

  function clearFilters() {
    setSuiteFilter(''); setEstadoFilter(''); setFechaDesde(''); setFechaHasta('');
  }

  async function refresh() {
    setLoading(true);
    const res = await fetch('/api/admin/reservas');
    if (res.ok) setBookings(await res.json());
    setLoading(false);
  }

  /**
   * Registrar la salida del huésped. Libera el cuarto en el acto (sin esperar a
   * la fecha de salida) y lo manda a limpieza.
   *
   * Antes esto no existía: la ocupación se sacaba sólo de las fechas, así que un
   * hotelero que probaba Kora se quedaba con el cuarto en "Ocupada" y sin forma
   * de liberarlo.
   */
  async function hacerCheckout(e: React.MouseEvent, b: AdminBooking) {
    e.stopPropagation();
    if (!b.confirmacion || checkoutId) return;
    const yaSalio = Boolean(b.checkoutReal);
    setCheckoutId(b.confirmacion);
    try {
      const res = await fetch(`/api/admin/reservas/${encodeURIComponent(b.confirmacion)}/checkout`, {
        method: yaSalio ? 'DELETE' : 'POST',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || 'No se pudo registrar el check-out.');
        return;
      }
      await refresh();
    } catch {
      alert('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
    } finally {
      setCheckoutId(null);
    }
  }

  /**
   * Registrar que el huésped YA LLEGÓ. Ocupa su cuarto en el acto.
   *
   * Es el espejo del check-out y resuelve lo contrario: sin esto, la llegada se
   * deducía de las fechas y no había forma de distinguir "llega hoy" de "ya está
   * aquí" — ni de que una estancia de una noche apareciera "En casa".
   */
  async function hacerCheckin(e: React.MouseEvent, b: AdminBooking) {
    e.stopPropagation();
    if (!b.confirmacion || checkinId) return;
    const yaLlego = Boolean(b.checkinReal);
    setCheckinId(b.confirmacion);
    try {
      const res = await fetch(`/api/admin/reservas/${encodeURIComponent(b.confirmacion)}/checkin`, {
        method: yaLlego ? 'DELETE' : 'POST',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(d.error || 'No se pudo registrar la llegada.');
        return;
      }
      await refresh();
    } catch {
      alert('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
    } finally {
      setCheckinId(null);
    }
  }

  /**
   * Imprimir el ticket de una reserva: UN clic, y sale.
   *
   * Lo pidió el hotelero tal cual: "que el ticket se pudiera imprimir
   * directamente desde el sistema, sin tener que descargarlo, guardarlo, abrirlo
   * y posteriormente mandarlo a imprimir".
   *
   * Va por un <iframe> oculto y no por `window.open`: una pestaña nueva parpadea,
   * se queda abierta, y el bloqueador de emergentes la mata sin avisar. El
   * documento ya trae dentro su propio `window.print()`, así que en cuanto carga
   * se abre el diálogo del sistema con el ancho de rollo correcto.
   */
  function imprimirTicket(e: React.MouseEvent, b: AdminBooking) {
    e.stopPropagation();
    if (!b.confirmacion || imprimiendoId) return;
    setImprimiendoId(b.confirmacion);
    const marco = document.createElement('iframe');
    marco.style.position = 'fixed';
    marco.style.right = '0';
    marco.style.bottom = '0';
    marco.style.width = '0';
    marco.style.height = '0';
    marco.style.border = '0';
    marco.src = `/api/admin/reservas/${encodeURIComponent(b.confirmacion)}/render?formato=ticket`;
    // Se retira después de imprimir. El diálogo del navegador es BLOQUEANTE, así
    // que para cuando vuelve el control ya se imprimió (o se canceló); el margen
    // es para que el propio diálogo no se cierre con el iframe debajo.
    marco.onload = () => {
      setImprimiendoId(null);
      setTimeout(() => marco.remove(), 60_000);
    };
    document.body.appendChild(marco);
  }

  async function sendEmail(e: React.MouseEvent, b: AdminBooking) {
    e.stopPropagation();
    if (!b.email || b.email === 'N/A') return alert('Esta reserva no tiene email registrado');
    setSendingId(b.confirmacion);
    try {
      const res = await fetch(`/api/admin/reservas/${b.confirmacion}/send-email`, { method: 'POST' });
      if (res.ok) alert(`✅ Confirmación enviada a ${b.email}`);
      else { const d = await res.json(); alert('Error: ' + (d.error || 'No se pudo enviar')); }
    } finally { setSendingId(null); }
  }

  // El dinero de una reembolsada ya se devolvió: no puede seguir sumando.
  const totalIngresos = filtered.reduce((s, b) => (reservaCuenta(b.estado) ? s + b.total : s), 0);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reservas</h1>
          <p className={styles.pageSub}>
            {filtered.length} reservas
            {verTotalPeriodo && ` · $${totalIngresos.toLocaleString('es-MX')} MXN`}
            {hasActiveFilters && <span className={styles.filterBadge}>Filtros activos</span>}
          </p>
        </div>
        <div className={styles.headerActions}>
          {/* Vista HOY */}
          <button
            className={`${styles.todayBtn} ${vistaHoy ? styles.todayBtnActive : ''}`}
            onClick={() => { setVistaHoy(v => !v); clearFilters(); }}
            title="Ver solo actividad de hoy"
          >
            <Sun size={14} />
            Hoy
            {(todayCounts.checkIn + todayCounts.checkOut + todayCounts.enCasa) > 0 && (
              <span className={styles.todayCount}>
                {todayCounts.checkIn + todayCounts.checkOut + todayCounts.enCasa}
              </span>
            )}
          </button>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'checkin' | 'reciente')}
            className={styles.select}
            style={{ fontSize: '0.8rem', padding: '6px 10px', minWidth: 0 }}
          >
            <option value="checkin">Por check-in</option>
            <option value="reciente">Más recientes</option>
          </select>
          <button className={styles.iconBtn} onClick={refresh} disabled={loading} title="Actualizar">
            <RefreshCw size={16} className={loading ? styles.spin : ''} />
          </button>
          <button
            className={`${styles.iconBtn} ${showFilters ? styles.iconBtnActive : ''}`}
            onClick={() => setShowFilters(s => !s)}
          >
            Filtros {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {verDinero && (
            <button className={styles.primaryBtn} onClick={() => setModal({ mode: 'new' })}>
              <Plus size={16} /> Nueva reserva
            </button>
          )}
        </div>
      </div>

      {/* Vista HOY summary */}
      {vistaHoy && (
        <div className={styles.todaySummary}>
          <div className={styles.todayCard} style={{ borderColor: '#2d7a34' }}>
            <span className={styles.todayCardNum} style={{ color: '#2d7a34' }}>{todayCounts.checkIn}</span>
            <span className={styles.todayCardLabel}>Check-in hoy</span>
          </div>
          <div className={styles.todayCard} style={{ borderColor: '#0d5070' }}>
            <span className={styles.todayCardNum} style={{ color: '#0d5070' }}>{todayCounts.enCasa}</span>
            <span className={styles.todayCardLabel}>En casa</span>
          </div>
          <div className={styles.todayCard} style={{ borderColor: 'var(--chip-aviso-text)' }}>
            <span className={styles.todayCardNum} style={{ color: 'var(--chip-aviso-text)' }}>{todayCounts.checkOut}</span>
            <span className={styles.todayCardLabel}>Check-out hoy</span>
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Buscar por cliente, email, confirmación o suite…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filtros avanzados */}
      {showFilters && (
        <div className={styles.filtersPanel}>
          <div className={styles.filtersGrid}>
            <label className={styles.filterField}>
              <span>Suite</span>
              <select value={suiteFilter} onChange={e => setSuiteFilter(e.target.value)}>
                <option value="">Todas</option>
                {SUITES.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className={styles.filterField}>
              <span>Estado operativo</span>
              <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="CHECK_IN_HOY">Por llegar hoy</option>
                <option value="CHECK_OUT_HOY">Check-out Hoy</option>
                <option value="SALIO">Salió (check-out hecho)</option>
                <option value="EN_CASA">En Casa (llegada registrada)</option>
                <option value="PROXIMA">Próxima</option>
                <option value="COMPLETADA">Completada</option>
                <option value="CANCELADA">Cancelada</option>
                <option value="REEMBOLSADA">Reembolsada</option>
              </select>
            </label>
            <label className={styles.filterField}>
              <span>Check-in desde</span>
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            </label>
            <label className={styles.filterField}>
              <span>Check-in hasta</span>
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
            </label>
          </div>
          {hasActiveFilters && (
            <button className={styles.clearBtn} onClick={clearFilters}>Limpiar filtros</button>
          )}
        </div>
      )}

      {/* ── Mobile: tarjetas apiladas (visible solo en <640px via CSS) ── */}
      <div className={styles.mobileCardList}>
        {filtered.length === 0 ? (
          <p className={styles.empty} style={{ textAlign: 'center', padding: '32px 0' }}>
            {vistaHoy ? 'Sin actividad para hoy' : 'Sin reservas que mostrar'}
          </p>
        ) : filtered.map(b => {
          const ops = getOpsState(b, today);
          const opsStyle = OPS_COLOR[ops];
          return (
            <div key={b.id} className={styles.mobileCard}>
              <div className={styles.mobileCardTop}>
                <span className={styles.mobileCardRef}>{b.confirmacion || '—'}</span>
                <span className={styles.mobileCardSuite}>{b.habitaciones}</span>
                <span className={styles.opsBadge} style={{ background: opsStyle.bg, color: opsStyle.color, fontSize: '0.65rem' }}>
                  {OPS_LABEL[ops]}
                </span>
              </div>
              <div className={styles.mobileCardName}>{b.cliente}</div>
              {b.email && b.email !== 'N/A' && <div className={styles.mobileCardEmail}>{b.email}</div>}
              <div className={styles.mobileCardDates}>
                Check-in: <strong>{b.checkin}</strong> → Check-out: <strong>{b.checkout}</strong> · {b.noches}n
              </div>
              {verDinero && (
                <div className={styles.mobileCardTotal}>${b.total.toLocaleString('es-MX')} MXN</div>
              )}
              <div className={styles.mobileCardActions}>
                {verAcciones && !['CANCELADA','REEMBOLSADA'].includes(ops) && (
                  <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnSecondary}`}
                    onClick={e => { e.stopPropagation(); setRegistroDe(b); }}>
                    {conRegistro.has(b.id) ? ' Ver registro' : ' QR registro'}
                  </button>
                )}
                {/* Llegada y salida TAMBIÉN en móvil. Antes sólo existían en la
                    tabla de escritorio, y recepción trabaja con el teléfono en la
                    mano: quien atendía desde el móvil no tenía forma de registrar
                    ni una entrada ni una salida. Aquí van con texto y no con
                    icono, que en una pantalla chica dos flechitas parecidas se
                    pulsan por error. */}
                {verAcciones && ['CHECK_IN_HOY', 'EN_CASA', 'CHECK_OUT_HOY'].includes(ops) && (
                  <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnSecondary}`}
                    onClick={e => hacerCheckin(e, b)} disabled={checkinId === b.confirmacion}>
                    {checkinId === b.confirmacion ? <Loader2 size={12} className={styles.spin} /> : null}
                    {b.checkinReal ? ' Deshacer llegada' : ' Ya llegó'}
                  </button>
                )}
                {verAcciones && ['EN_CASA', 'CHECK_OUT_HOY', 'CHECK_IN_HOY', 'SALIO'].includes(ops) && (
                  <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnSecondary}`}
                    onClick={e => hacerCheckout(e, b)} disabled={checkoutId === b.confirmacion}>
                    {checkoutId === b.confirmacion ? <Loader2 size={12} className={styles.spin} /> : null}
                    {ops === 'SALIO' ? ' Deshacer salida' : ' Check-out'}
                  </button>
                )}
                {verDinero && (
                  <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnPrimary}`}
                    onClick={() => setModal({ mode: 'edit', booking: b })}>
                    Ver / Editar
                  </button>
                )}
                {verAcciones && (
                  <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnSecondary}`}
                    onClick={e => sendEmail(e, b)} disabled={sendingId === b.confirmacion}>
                    {sendingId === b.confirmacion ? <Loader2 size={12} className={styles.spin} /> : null} Email
                  </button>
                )}
                {verAcciones && (
                  <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnSecondary}`}
                    onClick={e => imprimirTicket(e, b)} disabled={imprimiendoId === b.confirmacion}>
                    {imprimiendoId === b.confirmacion ? <Loader2 size={12} className={styles.spin} /> : null} Ticket
                  </button>
                )}
                {verAcciones && (
                  <a href={`/panel/${slug}/reservas/${b.confirmacion}/documento`}
                    className={`${styles.mobileCardBtn} ${styles.mobileCardBtnPdf}`}
                    style={{ display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                    onClick={e => e.stopPropagation()}>
                    PDF
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.scrollHint}>← desliza para ver más →</p>

      {/* Desktop tabla */}
      <div className={styles.tableScrollWrap}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Confirmación</th>
              <th>Cliente</th>
              <th>Suite</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Noches</th>
              <th>Días</th>
              {verDinero && <th>Total</th>}
              <th>Estado</th>
              {verAcciones && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8 + (verDinero ? 1 : 0) + (verAcciones ? 1 : 0)} className={styles.empty}>
                  {vistaHoy ? 'Sin actividad para hoy' : 'Sin reservas que mostrar'}
                </td>
              </tr>
            ) : filtered.map(b => {
              const ops = getOpsState(b, today);
              const opsStyle = OPS_COLOR[ops];
              const days = daysToArrival(b.checkin, today);
              return (
                <tr
                  key={b.id}
                  className={`${styles.row} ${ops === 'CHECK_IN_HOY' ? styles.rowHighlight : ops === 'CHECK_OUT_HOY' ? styles.rowCheckout : ''}`}
                  onClick={verDinero ? () => setModal({ mode: 'edit', booking: b }) : undefined}
                  style={verDinero ? undefined : { cursor: 'default' }}
                >
                  <td className={styles.mono}>{b.confirmacion || '—'}</td>
                  <td>
                    <div className={styles.clienteName}>{b.cliente}</div>
                    {b.email && b.email !== 'N/A' && <div className={styles.clienteEmail}>{b.email}</div>}
                  </td>
                  <td>{b.habitaciones}</td>
                  <td>{b.checkin}</td>
                  <td>{b.checkout}</td>
                  <td>{b.noches}</td>
                  <td><DaysChip days={days} /></td>
                  {verDinero && (
                    <td className={styles.total}>${b.total.toLocaleString('es-MX')}</td>
                  )}
                  <td>
                    <span
                      className={styles.opsBadge}
                      style={{ background: opsStyle.bg, color: opsStyle.color }}
                    >
                      {OPS_LABEL[ops]}
                    </span>
                  </td>
                  {verAcciones && (
                  <td onClick={e => e.stopPropagation()}>
                    <div className={styles.rowActions}>
                      {/* REGISTRO DEL HUÉSPED. El QR que recepción le enseña
                          para que se registre desde su celular, o su ficha si ya
                          lo hizo. La palomita distingue una cosa de la otra sin
                          tener que abrir nada. */}
                      {verAcciones && !['CANCELADA','REEMBOLSADA'].includes(ops) && (
                        <button
                          className={conRegistro.has(b.id) ? styles.actionBtnCheckin : styles.actionBtn}
                          onClick={e => { e.stopPropagation(); setRegistroDe(b); }}
                          title={conRegistro.has(b.id)
                            ? 'Ver el registro que llenó el huésped'
                            : 'QR para que el huésped se registre desde su celular'}
                        >
                          {conRegistro.has(b.id) ? <UserCheck size={13} /> : <QrCode size={13} />}
                        </button>
                      )}
                      {/* LLEGADA. Va primero porque es lo primero que pasa. Se
                          ofrece a quien todavía no ha salido: al que llega hoy,
                          al que ya está en casa (para deshacer si se marcó la
                          reserva equivocada) y al que se retrasó un día. */}
                      {verAcciones && ['CHECK_IN_HOY', 'EN_CASA', 'CHECK_OUT_HOY'].includes(ops) && (
                        <button
                          className={b.checkinReal ? styles.actionBtn : styles.actionBtnCheckin}
                          onClick={e => hacerCheckin(e, b)}
                          disabled={checkinId === b.confirmacion}
                          title={b.checkinReal
                            ? `Deshacer la llegada (registrada ${new Date(b.checkinReal).toLocaleString('es-MX')})`
                            : 'El huésped ya llegó: ocupa su cuarto ahora'}
                        >
                          {checkinId === b.confirmacion
                            ? <Loader2 size={13} className={styles.spin} />
                            : b.checkinReal ? <Undo2 size={13} /> : <LogIn size={13} />}
                        </button>
                      )}
                      {/* Sólo donde tiene sentido: alguien que está (o estuvo)
                          en casa. En una reserva próxima o cancelada estorba. */}
                      {verAcciones && ['EN_CASA', 'CHECK_OUT_HOY', 'CHECK_IN_HOY', 'SALIO'].includes(ops) && (
                        <button
                          className={ops === 'SALIO' ? styles.actionBtn : styles.actionBtnCheckout}
                          onClick={e => hacerCheckout(e, b)}
                          disabled={checkoutId === b.confirmacion}
                          title={ops === 'SALIO' ? 'Deshacer check-out' : 'Hacer check-out y mandar el cuarto a limpieza'}
                        >
                          {checkoutId === b.confirmacion
                            ? <Loader2 size={13} className={styles.spin} />
                            : ops === 'SALIO' ? <Undo2 size={13} /> : <LogOut size={13} />}
                        </button>
                      )}
                      {verAcciones && (
                      <button className={styles.actionBtn} onClick={e => sendEmail(e, b)}
                        disabled={sendingId === b.confirmacion} title="Enviar confirmación">
                        {sendingId === b.confirmacion ? <Loader2 size={13} className={styles.spin} /> : <Send size={13} />}
                      </button>
                      )}
                      {verAcciones && (
                        <button
                          className={styles.actionBtn}
                          onClick={e => imprimirTicket(e, b)}
                          disabled={imprimiendoId === b.confirmacion}
                          title="Imprimir ticket en la impresora de mostrador"
                        >
                          {imprimiendoId === b.confirmacion
                            ? <Loader2 size={13} className={styles.spin} />
                            : <Printer size={13} />}
                        </button>
                      )}
                      {verAcciones && (
                      <a href={`/panel/${slug}/reservas/${b.confirmacion}/documento`}
                        className={styles.actionBtnPdf} title="Documento / descargar"
                        style={{ display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                        onClick={e => e.stopPropagation()}>
                        <Download size={13} />
                      </a>
                      )}
                    </div>
                  </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div> {/* /tableScrollWrap */}

      {registroDe && (
        <RegistroModal
          slug={slug}
          folio={registroDe.confirmacion}
          bookingId={registroDe.id}
          cliente={registroDe.cliente}
          onClose={() => setRegistroDe(null)}
        />
      )}

      {modal && (
        <ReservationModal
          booking={modal.mode === 'edit' ? modal.booking : undefined}
          rooms={rooms}
          slug={slug}
          defaultRoom={modal.cuarto}
          defaultCheckin={modal.walkin ? today : undefined}
          walkin={modal.walkin}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
