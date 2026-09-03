'use client';

import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Lock, Unlock, RefreshCw, Loader2, X, CalendarCheck, Plus } from 'lucide-react';
import type { AdminBooking } from '@/lib/admin/sheets-admin';
import type { BookingRoom } from '@/lib/booking';
import ReservationModal from '@/components/admin/ReservationModal';
import panelStyles from '../admin.module.css';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DOW = ['D','L','M','M','J','V','S'];

function pad2(n: number) { return String(n).padStart(2, '0'); }
function dateStr(y: number, m: number, d: number) { return `${y}-${pad2(m+1)}-${pad2(d)}`; }

function addDaysStr(ds: string, n: number) {
  const d = new Date(`${ds}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fmtDay(ds: string) {
  const [, m, d] = ds.split('-');
  return `${parseInt(d)} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(m)-1]}`;
}

// `blocked` se partió en dos el 2 sep 2026. Antes el calendario colapsaba
// BLOQUEADO y MANTENIMIENTO en el mismo estado, y el modal decía «bloqueada
// manualmente» — que era mentira en cuanto el cuarto estaba fuera de servicio.
interface DayState {
  status: 'available' | 'booking' | 'blocked' | 'mantenimiento';
  booking?: AdminBooking;
}

// El color de cada estado, en UN solo sitio. Antes eran tres cadenas de
// ternarios repetidas (celda, etiqueta y cabecera del modal): añadir
// `mantenimiento` obligaba a acertar en las tres, y la que se olvidara lo
// habría pintado de rojo — indistinguible de una reserva.
const PALETA: Record<DayState['status'], { bg: string; color: string; etiqueta: string; titulo: string }> = {
  available:     { bg: '#EAF3DE', color: '#27500A', etiqueta: '● Disponible',    titulo: 'Fecha disponible' },
  blocked:       { bg: '#FAEEDA', color: '#633806', etiqueta: '● Cerrada',       titulo: 'Fecha cerrada' },
  mantenimiento: { bg: '#F6E7CE', color: '#8A5A00', etiqueta: '● Mantenimiento', titulo: 'Fuera de servicio' },
  booking:       { bg: '#FCEBEB', color: '#791F1F', etiqueta: '● Ocupada',       titulo: 'Fecha ocupada' },
};

interface ClickedDay {
  room: string;
  date: string;
  state: DayState;
}

interface Props {
  slug: string;
  bookings: AdminBooking[];
  rooms: string[];
  roomPrices: Record<string, number>;
  bookingRooms: BookingRoom[];
  onRefresh: () => void;
  /** ¿Ve importes? (`reservas:dinero`, decidido en el servidor). */
  verDinero?: boolean;
}

export default function AvailabilityCalendar({ slug, bookings, rooms, roomPrices, bookingRooms, onRefresh, verDinero = true }: Props) {
  const now = new Date();
  // Hoy en HORA DE MÉXICO. Con toISOString() se usaba UTC, así que a partir de
  // las 18:00 locales el panel ya creía que era mañana: pintaba el día de hoy en
  // gris (pasado) y no respondía al clic — el hotelero no podía bloquear hoy.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  // Record<room, Record<dateISO, 'RESERVADO'|'BLOQUEADO'|...>>
  const [sheetData, setSheetData] = useState<Record<string, Record<string, string>>>({});
  const [loadingSheet, setLoadingSheet] = useState(true);
  const [clicked, setClicked] = useState<ClickedDay | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editBooking, setEditBooking] = useState<AdminBooking | null>(null);
  const [newBookingParams, setNewBookingParams] = useState<{ room: string; date: string } | null>(null);
  // Formulario de cierre: hasta hoy era un clic = una noche, y cerrar una cabaña
  // diez días eran diez clics. Por eso nadie lo usaba: cerraban inventando una
  // reserva falsa, que ensucia la ocupación y el CRM para siempre.
  const [hasta, setHasta] = useState('');
  const [tipoBloqueo, setTipoBloqueo] = useState<'manual' | 'mantenimiento'>('manual');
  const [motivo, setMotivo] = useState('');

  const loadSheet = useCallback(async () => {
    setLoadingSheet(true);
    try {
      const res = await fetch('/api/admin/disponibilidad');
      if (res.ok) setSheetData(await res.json());
    } catch {}
    setLoadingSheet(false);
  }, []);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  // Compute day state for a specific room+date
  function getDayState(room: string, ds: string): DayState {
    const booking = bookings.find(b =>
      reservaCuenta(b.estado) &&
      b.habitaciones.split(', ').some(h => h.replace(/\s*\([^)]*\)/g,'').trim() === room) &&
      ds >= b.checkin && ds < b.checkout
    );
    if (booking) return { status: 'booking', booking };

    const roomSheet = sheetData[room] || {};
    const val = roomSheet[ds]?.toUpperCase();
    if (val === 'MANTENIMIENTO') return { status: 'mantenimiento' };
    if (val === 'BLOQUEADO') return { status: 'blocked' };
    if (val === 'RESERVADO' || val === 'OTA') {
      // Reservado/OTA en blocks pero sin booking en admin — puede ser reserva
      // pública o un bloqueo de OTA (Booking/Expedia).
      return { status: 'booking', booking: undefined };
    }
    return { status: 'available' };
  }

  function countFree(room: string) {
    const dim = new Date(year, month + 1, 0).getDate();
    let n = 0;
    for (let d = 1; d <= dim; d++) {
      const ds = dateStr(year, month, d);
      if (getDayState(room, ds).status === 'available') n++;
    }
    return n;
  }

  async function handleBlock() {
    if (!clicked) return;
    setSaving(true); setSaveError('');
    // `hasta` es la fecha de LIBERACIÓN, igual que el checkout de una reserva:
    // la noche de `hasta` vuelve a estar a la venta. Vacío = una sola noche.
    const finExclusivo = hasta || addDaysStr(clicked.date, 1);
    const res = await fetch('/api/admin/disponibilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: clicked.room,
        desde: clicked.date,
        hasta: finExclusivo,
        tipo: tipoBloqueo,
        motivo: motivo.trim() || undefined,
      }),
    });
    if (res.ok) {
      await loadSheet();
      cerrarModal();
    } else {
      const d = await res.json();
      setSaveError(d.error || 'Error al bloquear');
    }
    setSaving(false);
  }

  function cerrarModal() {
    setClicked(null);
    setSaveError('');
    setHasta('');
    setTipoBloqueo('manual');
    setMotivo('');
  }

  async function handleUnblock() {
    if (!clicked) return;
    setSaving(true); setSaveError('');
    const res = await fetch('/api/admin/disponibilidad', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: clicked.room, date: clicked.date }),
    });
    if (res.ok) {
      await loadSheet();
      cerrarModal();
    } else {
      const d = await res.json();
      setSaveError(d.error || 'Error al desbloquear');
    }
    setSaving(false);
  }

  const dim = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={16} /></button>
          <span style={{ fontFamily: 'var(--font-cormorant,Georgia,serif)', fontSize: '1.3rem', fontWeight: 400, color: 'var(--forest)', minWidth: 180, textAlign: 'center' }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={nextMonth} style={navBtnStyle}><ChevronRight size={16} /></button>
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            style={{ ...navBtnStyle, padding: '5px 12px', fontSize: '0.78rem', fontFamily: 'var(--font-jost,sans-serif)' }}
          >
            Hoy
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={legendItem}><span style={{ ...dot, background: '#3B6D11' }} />Libre</span>
            <span style={legendItem}><span style={{ ...dot, background: '#A32D2D' }} />Ocupada</span>
            <span style={legendItem}><span style={{ ...dot, background: 'var(--chip-aviso-text)' }} />Bloqueada</span>
            <span style={legendItem}><span style={{ ...dot, background: '#8A5A00' }} />Mantenimiento</span>
          </div>
          <button
            onClick={() => { loadSheet(); onRefresh(); }}
            disabled={loadingSheet}
            style={{ ...navBtnStyle, color: loadingSheet ? '#aaa' : undefined }}
            title="Actualizar"
          >
            <RefreshCw size={14} style={loadingSheet ? { animation: 'spin 0.7s linear infinite' } : undefined} />
          </button>
        </div>
      </div>

      {/* Grid of mini-calendars: en móvil un mes ocupa todo el ancho para que
          cada día sea táctil (~44px) */}
      <div className={panelStyles.calGrid} style={{
        background: 'var(--line)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {rooms.map(room => {
          const free = countFree(room);
          return (
            <div key={room} style={{ background: 'var(--parch)', padding: '14px 14px 10px' }}>
              {/* Suite name */}
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, letterSpacing: '0.3px', fontFamily: 'var(--font-jost,sans-serif)' }}>
                {room}
              </div>

              {/* Day-of-week header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 3 }}>
                {DOW.map((d, di) => (
                  <div key={di} style={{ textAlign: 'center', fontSize: 9, color: 'var(--clay)', fontWeight: 500, fontFamily: 'var(--font-jost,sans-serif)', padding: '1px 0' }}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`e${i}`} style={{ aspectRatio: '1' }} />
                ))}
                {Array.from({ length: dim }).map((_, i) => {
                  const d = i + 1;
                  const ds = dateStr(year, month, d);
                  const isPast = ds < todayStr;
                  const isToday = ds === todayStr;
                  const state = getDayState(room, ds);

                  const bg = isPast ? 'transparent' : PALETA[state.status].bg;
                  const color = isPast ? '#ccc' : PALETA[state.status].color;

                  return (
                    <div
                      key={d}
                      onClick={() => {
                        if (isPast) return;
                        setSaveError('');
                        setClicked({ room, date: ds, state });
                      }}
                      style={{
                        aspectRatio: '1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, borderRadius: 4,
                        cursor: isPast ? 'default' : 'pointer',
                        background: bg, color,
                        outline: isToday ? '2px solid #2d7a34' : undefined,
                        outlineOffset: isToday ? -1 : undefined,
                        opacity: isPast ? 0.3 : 1,
                        fontFamily: 'var(--font-jost,sans-serif)',
                        fontWeight: isToday ? 700 : 400,
                        transition: 'opacity 0.1s',
                      }}
                      onMouseEnter={e => { if (!isPast) (e.currentTarget as HTMLDivElement).style.opacity = '0.75'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = isPast ? '0.3' : '1'; }}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <span style={{ fontSize: 11, color: 'var(--clay)', fontFamily: 'var(--font-jost,sans-serif)' }}>
                  <span style={{ color: '#3B6D11', fontWeight: 600 }}>{free}</span> libres
                </span>
                {verDinero && roomPrices[room] ? (
                  <span style={{ fontSize: 11, color: 'var(--clay)', fontFamily: 'var(--font-jost,sans-serif)' }}>
                    ${roomPrices[room].toLocaleString('es-MX')}/n
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day click modal */}
      {clicked && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setClicked(null); setSaveError(''); } }}
        >
          <div style={{ background: 'var(--parch)', borderRadius: 8, width: 'min(92vw, 340px)', maxHeight: '85dvh', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden auto' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-jost,sans-serif)' }}>
                {PALETA[clicked.state.status].titulo}
              </span>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clay)', padding: '2px 6px', fontSize: 18 }}>
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '16px' }}>
              {/* Status tag */}
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, marginBottom: 10,
                background: PALETA[clicked.state.status].bg,
                color: PALETA[clicked.state.status].color,
                fontFamily: 'var(--font-jost,sans-serif)',
              }}>
                {PALETA[clicked.state.status].etiqueta}
              </span>

              {/* Suite + date */}
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 2, fontFamily: 'var(--font-cormorant,Georgia,serif)' }}>{clicked.room}</div>
              <div style={{ fontSize: 13, color: 'var(--clay)', marginBottom: 14, fontFamily: 'var(--font-jost,sans-serif)' }}>{fmtDay(clicked.date)}, {year}</div>

              {/* Booking info */}
              {clicked.state.status === 'booking' && clicked.state.booking && (
                <div style={{ background: 'var(--parch)', borderRadius: 6, padding: '10px 12px', marginBottom: 14 }}>
                  {[
                    ['Huésped', clicked.state.booking.cliente],
                    ['Check-in', clicked.state.booking.checkin],
                    ['Check-out', clicked.state.booking.checkout],
                    ['Noches', String(clicked.state.booking.noches)],
                    // El importe sólo para quien lo puede ver: mostrador.
                    ...(verDinero
                      ? [['Total', `$${clicked.state.booking.total.toLocaleString('es-MX')} MXN`]]
                      : []),
                    ['Folio', clicked.state.booking.confirmacion],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', fontFamily: 'var(--font-jost,sans-serif)' }}>
                      <span style={{ color: 'var(--clay)' }}>{label}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Booking without admin record */}
              {clicked.state.status === 'booking' && !clicked.state.booking && (
                <div style={{ background: 'var(--chip-mal-bg)', borderRadius: 6, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#791F1F', fontFamily: 'var(--font-jost,sans-serif)' }}>
                  Esta fecha está ocupada (reservada o bloqueada por una OTA como Booking/Expedia) pero no se encontró una reserva en el panel. Puede ser una reserva pública o un bloqueo de canal.
                </div>
              )}

              {/* Blocked info. Decía «bloqueada manualmente» para los dos casos,
                  y eso era falso en cuanto el cuarto estaba fuera de servicio. */}
              {(clicked.state.status === 'blocked' || clicked.state.status === 'mantenimiento') && (
                <div style={{ background: 'var(--chip-aviso-bg)', borderLeft: '3px solid var(--sage-text)', padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--clay)', lineHeight: 1.6, fontFamily: 'var(--font-jost,sans-serif)' }}>
                  {clicked.state.status === 'mantenimiento'
                    ? 'Fuera de servicio por mantenimiento. Desbloquéala cuando el cuarto vuelva a estar listo.'
                    : 'Fecha cerrada por ti. Puedes desbloquearla para que vuelva a estar disponible.'}
                </div>
              )}

              {saveError && (
                <div style={{ background: 'var(--chip-mal-bg)', borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--chip-mal-text)', fontFamily: 'var(--font-jost,sans-serif)' }}>
                  {saveError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clicked.state.status === 'available' && (
                  <>
                    {/* El modal de reserva es un desglose de importes: no se
                        abre para quien no puede ver dinero. Bloquear/desbloquear
                        la fecha sí se queda — eso es operación, no dinero. */}
                    {verDinero && (
                    <button
                      onClick={() => { setNewBookingParams({ room: clicked.room, date: clicked.date }); setClicked(null); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: '#2d7a34', color: 'var(--cream)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-jost,sans-serif)', fontWeight: 600 }}
                    >
                      <Plus size={14} /> Nueva Reserva
                    </button>
                    )}
                    {/* Cerrar la unidad: rango + por qué. La fecha de fin es la
                        de LIBERACIÓN, igual que el checkout de una reserva. */}
                    <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '10px 12px', marginBottom: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['manual', 'mantenimiento'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTipoBloqueo(t)}
                            style={{
                              flex: 1, padding: '7px 8px', borderRadius: 5, cursor: 'pointer',
                              fontSize: 12, fontFamily: 'var(--font-jost,sans-serif)',
                              border: tipoBloqueo === t ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                              background: tipoBloqueo === t ? 'var(--chip-aviso-bg)' : 'transparent',
                              color: 'var(--clay)', fontWeight: tipoBloqueo === t ? 600 : 400,
                            }}
                          >
                            {t === 'manual' ? 'Cerrar sin más' : 'Mantenimiento'}
                          </button>
                        ))}
                      </div>
                      <label style={{ fontSize: 11, color: 'var(--clay)', fontFamily: 'var(--font-jost,sans-serif)' }}>
                        Hasta que vuelva a estar libre (opcional)
                        <input
                          type="date"
                          value={hasta}
                          min={addDaysStr(clicked.date, 1)}
                          onChange={(e) => setHasta(e.target.value)}
                          style={{ width: '100%', marginTop: 4, padding: '7px 8px', border: '1px solid var(--line)', borderRadius: 5, fontSize: 12, fontFamily: 'var(--font-jost,sans-serif)' }}
                        />
                        <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: 'var(--clay)', opacity: 0.75 }}>
                          {hasta
                            ? `Se cierran ${Math.max(1, Math.round((new Date(`${hasta}T00:00:00`).getTime() - new Date(`${clicked.date}T00:00:00`).getTime()) / 86400000))} noche(s): de la del ${fmtDay(clicked.date)} a la del ${fmtDay(addDaysStr(hasta, -1))}. La noche del ${fmtDay(hasta)} sigue a la venta.`
                            : 'Vacío = sólo esta noche.'}
                        </span>
                      </label>
                      <label style={{ fontSize: 11, color: 'var(--clay)', fontFamily: 'var(--font-jost,sans-serif)' }}>
                        ¿Por qué? (opcional)
                        <input
                          type="text"
                          value={motivo}
                          maxLength={300}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder={tipoBloqueo === 'mantenimiento' ? 'Ej. gotera en el techo' : 'Ej. uso de la familia'}
                          style={{ width: '100%', marginTop: 4, padding: '7px 8px', border: '1px solid var(--line)', borderRadius: 5, fontSize: 12, fontFamily: 'var(--font-jost,sans-serif)' }}
                        />
                      </label>
                    </div>
                    <button
                      onClick={handleBlock}
                      disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: 'var(--ink)', color: 'var(--cream)', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'var(--font-jost,sans-serif)', opacity: saving ? 0.6 : 1 }}
                    >
                      {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Lock size={14} />}
                      {tipoBloqueo === 'mantenimiento' ? 'Poner fuera de servicio' : 'Cerrar esta fecha'}
                    </button>
                  </>
                )}

                {(clicked.state.status === 'blocked' || clicked.state.status === 'mantenimiento') && (
                  <button
                    onClick={handleUnblock}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: '#3d6e40', color: 'var(--cream)', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'var(--font-jost,sans-serif)', opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Unlock size={14} />}
                    Desbloquear esta fecha
                  </button>
                )}

                {verDinero && clicked.state.status === 'booking' && clicked.state.booking && (
                  <button
                    onClick={() => { setEditBooking(clicked.state.booking!); setClicked(null); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', background: '#2e6b8a', color: 'var(--cream)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-jost,sans-serif)' }}
                  >
                    <CalendarCheck size={14} />
                    Ver / editar reserva
                  </button>
                )}

                <button
                  onClick={cerrarModal}
                  style={{ padding: '9px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--clay)', fontFamily: 'var(--font-jost,sans-serif)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit booking modal */}
      {editBooking && (
        <ReservationModal
          booking={editBooking}
          rooms={bookingRooms}
          slug={slug}
          onClose={() => setEditBooking(null)}
          onSaved={() => { onRefresh(); setEditBooking(null); loadSheet(); }}
        />
      )}

      {/* Nueva reserva desde fecha del calendario — pre-carga habitación y fecha */}
      {newBookingParams && (
        <ReservationModal
          defaultCheckin={newBookingParams.date}
          defaultRoom={newBookingParams.room}
          rooms={bookingRooms}
          slug={slug}
          onClose={() => setNewBookingParams(null)}
          onSaved={() => { onRefresh(); setNewBookingParams(null); loadSheet(); }}
        />
      )}
    </div>
  );
}

// ── Shared micro-styles ───────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 4,
  padding: '5px 8px', cursor: 'pointer', color: 'var(--clay)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'border-color 0.15s',
};

const legendItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 11, color: 'var(--clay)',
  fontFamily: 'var(--font-jost,sans-serif)',
};

const dot: React.CSSProperties = {
  width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
};
