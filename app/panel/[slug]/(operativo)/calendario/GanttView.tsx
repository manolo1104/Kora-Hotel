'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AdminBooking } from '@/lib/admin/sheets-admin';
import type { BookingRoom } from '@/lib/booking';
import ReservationModal from '@/components/admin/ReservationModal';

// Paleta base; si el hotel tiene más cuartos que colores, se generan tonos extra
// por HSL para que cada fila tenga un color distinto.
const BASE_COLORS = [
  '#2d7a34','#52b788','#4a6e2e','#8b4a9a','#2e6b8a',
  '#8a4a2e','#6b4a8a','#2e8a7a','#8a6b2e','#4a8a6b',
  '#8a2e4a','#6b8a2e','#2e4a8a',
];

function colorFor(index: number): string {
  if (index < BASE_COLORS.length) return BASE_COLORS[index];
  // Tonos adicionales repartidos por la rueda de color.
  const hue = (index * 47) % 360;
  return `hsl(${hue} 45% 38%)`;
}

const CELL_W = 40; // wider cells so names fit better on mobile
const ROW_H  = 46;
const LABEL_W = 148;
const HEADER_H = 54;

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAYS_VISIBLE = 49;

interface Props { slug: string; bookings: AdminBooking[]; rooms: string[]; bookingRooms: BookingRoom[]; onRefresh: () => void }

function toDate(s: string) { return new Date(s + 'T00:00:00'); }
function isoToday() { return new Date().toISOString().split('T')[0]; }
// Web bookings store "Suite Jungla (2 personas)" — strip the parenthetical
function extractRoom(s: string): string { return s.replace(/\s*\([^)]*\)/g, '').trim(); }

export default function GanttView({ slug, bookings, rooms, bookingRooms, onRefresh }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetDays, setOffsetDays] = useState(-3); // start 3 days before today
  const [modal, setModal] = useState<{ booking?: AdminBooking; defaultCheckin?: string } | null>(null);
  const [tooltip, setTooltip] = useState<{ booking: AdminBooking; x: number; y: number } | null>(null);
  const todayStr = isoToday();

  // Scroll to "today" on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = Math.max(0, (3 - offsetDays) * CELL_W - 60);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rangeStart = useMemo(() => {
    const d = toDate(todayStr);
    d.setDate(d.getDate() + offsetDays);
    return d;
  }, [offsetDays, todayStr]);

  const dates = useMemo(() =>
    Array.from({ length: DAYS_VISIBLE }, (_, i) => {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
  [rangeStart]);

  const rangeStartStr = rangeStart.toISOString().split('T')[0];
  const rangeEndDate = new Date(rangeStart); rangeEndDate.setDate(rangeEndDate.getDate() + DAYS_VISIBLE);
  const rangeEndStr = rangeEndDate.toISOString().split('T')[0];

  const activeBookings = useMemo(() =>
    bookings.filter(b => b.estado !== 'CANCELADA' && b.checkin < rangeEndStr && b.checkout > rangeStartStr),
  [bookings, rangeStartStr, rangeEndStr]);

  function dayOffset(dateStr: string) {
    return Math.round((toDate(dateStr).getTime() - rangeStart.getTime()) / 86400000);
  }

  const todayOff = dayOffset(todayStr);

  // Month label spans
  const monthSpans: { label: string; start: number; span: number }[] = [];
  let i = 0;
  while (i < DAYS_VISIBLE) {
    const d = dates[i];
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    let span = 1;
    while (i + span < DAYS_VISIBLE) {
      const nd = dates[i + span];
      if (nd.getMonth() !== d.getMonth() || nd.getFullYear() !== d.getFullYear()) break;
      span++;
    }
    monthSpans.push({ label, start: i, span });
    i += span;
  }

  const totalW = LABEL_W + DAYS_VISIBLE * CELL_W;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setOffsetDays(d => d - 14)}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => setOffsetDays(-3)}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-jost, sans-serif)' }}
        >
          Hoy
        </button>
        <button
          onClick={() => setOffsetDays(d => d + 14)}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <ChevronRight size={16} />
        </button>
        <span style={{ fontSize: '0.78rem', color: '#888', marginLeft: 4 }}>
          {MONTHS[rangeStart.getMonth()]} {rangeStart.getFullYear()}
          {' — '}
          {MONTHS[rangeEndDate.getMonth()]} {rangeEndDate.getFullYear()}
        </span>
      </div>

      {/* Scrollable gantt */}
      <div
        ref={containerRef}
        style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}
      >
        <div style={{ position: 'relative', width: totalW, minWidth: totalW }}>

          {/* Month row */}
          <div style={{ display: 'flex', height: 24, background: '#1a1a1a' }}>
            <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '2px solid rgba(255,255,255,0.1)' }} />
            {monthSpans.map(({ label, span }, mi) => (
              <div key={mi} style={{
                width: span * CELL_W, flexShrink: 0,
                fontSize: 9, letterSpacing: '2.5px', textTransform: 'uppercase',
                color: '#52b788', padding: '0 8px', lineHeight: '24px',
                borderRight: '1px solid rgba(255,255,255,0.08)',
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Day numbers row */}
          <div style={{ display: 'flex', height: 30, background: '#f9fafb', borderBottom: '2px solid #1a1a1a' }}>
            <div style={{
              width: LABEL_W, flexShrink: 0,
              fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase',
              color: '#9ca3af', padding: '0 14px', lineHeight: '30px',
              borderRight: '2px solid #e5e7eb', background: '#f9fafb',
            }}>
              Habitación
            </div>
            {dates.map((d, idx) => {
              const isToday = idx === todayOff;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={idx} style={{
                  width: CELL_W, flexShrink: 0,
                  fontSize: 11, textAlign: 'center', lineHeight: '30px',
                  fontWeight: isToday ? 700 : 400,
                  background: isToday ? '#2d7a34' : isWeekend ? '#f3f4f6' : 'transparent',
                  color: isToday ? '#fff' : isWeekend ? '#6b7280' : '#6b7280',
                  borderRight: '1px solid #e5e7eb',
                  fontFamily: 'var(--font-jost, sans-serif)',
                }}>
                  {d.getDate()}
                </div>
              );
            })}
          </div>

          {/* Room rows */}
          {rooms.map((room, ri) => {
            const color = colorFor(ri);
            const roomBookings = activeBookings.filter(b =>
              b.habitaciones.split(', ').some(h => extractRoom(h) === room)
            );

            return (
              <div key={room} style={{
                display: 'flex', height: ROW_H,
                borderBottom: '1px solid #f4f4f2',
                position: 'relative',
              }}>
                {/* Label */}
                <div style={{
                  width: LABEL_W, flexShrink: 0,
                  padding: '0 12px',
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 11.5, color: '#1a1a1a',
                  background: '#f9fafb',
                  borderRight: '2px solid #e5e7eb',
                  position: 'sticky', left: 0, zIndex: 2,
                  fontFamily: 'var(--font-jost, sans-serif)',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {room}
                </div>

                {/* Day cells */}
                <div style={{ position: 'relative', flex: 1 }}>
                  {/* Background stripes */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                    {dates.map((d, idx) => {
                      const isToday = idx === todayOff;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div key={idx} style={{
                          width: CELL_W, flexShrink: 0, height: '100%',
                          background: isToday ? 'rgba(45,122,52,0.07)' : isWeekend ? '#f9fafb' : 'transparent',
                          borderRight: '1px solid #f9fafb',
                        }} />
                      );
                    })}
                  </div>

                  {/* Booking bars */}
                  {roomBookings.map(b => {
                    const start = Math.max(0, dayOffset(b.checkin));
                    const end   = Math.min(DAYS_VISIBLE, dayOffset(b.checkout));
                    const width = end - start;
                    if (width <= 0) return null;
                    return (
                      <div
                        key={b.confirmacion + room}
                        onClick={(e) => {
                          // On touch devices show tooltip; on desktop open modal
                          const isTouchEvent = e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType === 'touch';
                          if (isTouchEvent) {
                            e.stopPropagation();
                            setTooltip(t => t?.booking.confirmacion === b.confirmacion ? null : { booking: b, x: e.clientX, y: e.clientY });
                          } else {
                            setModal({ booking: b });
                          }
                        }}
                        title={`${b.cliente} · ${b.noches}n · $${b.total.toLocaleString('es-MX')} MXN`}
                        style={{
                          position: 'absolute',
                          left: start * CELL_W + 2,
                          width: width * CELL_W - 4,
                          top: 6, height: ROW_H - 12,
                          background: color,
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center',
                          padding: '0 8px',
                          overflow: 'hidden',
                          zIndex: 1,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.1)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = ''; }}
                      >
                        <span style={{
                          fontSize: 11, color: '#fff', fontWeight: 500,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          fontFamily: 'var(--font-jost, sans-serif)',
                        }}>
                          {b.cliente.split(' ')[0]}
                          {width > 2 && ` · ${b.noches}n`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Today vertical line */}
          {todayOff >= 0 && todayOff < DAYS_VISIBLE && (
            <div style={{
              position: 'absolute',
              top: HEADER_H,
              bottom: 0,
              left: LABEL_W + todayOff * CELL_W + CELL_W / 2 - 1,
              width: 2,
              background: 'rgba(45,122,52,0.5)',
              zIndex: 3,
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12 }}>
        {rooms.map((r, ri) => (
          <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#6b7280', fontFamily: 'var(--font-jost, sans-serif)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorFor(ri), display: 'inline-block' }} />
            {r}
          </span>
        ))}
      </div>

      {/* Touch tooltip */}
      {tooltip && (
        <div
          onClick={() => setTooltip(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: Math.min(tooltip.y + 8, window.innerHeight - 180),
              left: Math.min(tooltip.x + 8, window.innerWidth - 220),
              background: '#1a1a1a', color: '#f9fafb',
              borderRadius: 8, padding: '12px 16px',
              fontSize: 12, fontFamily: 'var(--font-jost, sans-serif)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 1000, minWidth: 200, maxWidth: 240,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{tooltip.booking.cliente}</div>
            <div style={{ color: '#52b788', marginBottom: 4 }}>{tooltip.booking.habitaciones}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>
              {tooltip.booking.checkin} → {tooltip.booking.checkout}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
              {tooltip.booking.noches} noche{tooltip.booking.noches !== 1 ? 's' : ''} · ${tooltip.booking.total.toLocaleString('es-MX')} MXN
            </div>
            <button
              onClick={() => { setModal({ booking: tooltip.booking }); setTooltip(null); }}
              style={{ width: '100%', background: '#52b788', color: '#1a1a1a', border: 'none', borderRadius: 4, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Ver / editar reserva
            </button>
          </div>
        </div>
      )}

      {modal && (
        <ReservationModal
          booking={modal.booking}
          defaultCheckin={modal.defaultCheckin}
          rooms={bookingRooms}
          slug={slug}
          onClose={() => setModal(null)}
          onSaved={() => { onRefresh(); setModal(null); }}
        />
      )}
    </div>
  );
}
