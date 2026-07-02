'use client';

import { useState, useMemo } from 'react';
import { Plus, Send, MessageSquare, RefreshCw, Loader2, X, Download, Pencil, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { buildBookingHtml } from '@/lib/booking-html';
import type { TourItem } from '@/lib/booking-html';
import type { AdminQuote } from '@/lib/admin/sheets-admin';
import type { BookingRoom } from '@/lib/booking';
import styles from './cotizaciones.module.css';

// NOTA multi-tenant: ya NO existe BOOKING_ROOMS global. La lista de cuartos llega
// por prop (rooms: BookingRoom[]) desde la página (hotelRooms(ctx.hotel)). Todas
// las funciones de precio reciben esa lista.

function getPrecioNoche(rooms: BookingRoom[], suite: string, personas: number): number {
  const room = rooms.find(r => r.name === suite);
  const tiers = room?.priceTiers ?? { 2: 1900 };
  const keys = Object.keys(tiers).map(Number).sort((a, b) => a - b);
  let precio = tiers[keys[0]] ?? 1900;
  for (const k of keys) {
    if (personas >= k) precio = tiers[k];
  }
  return precio;
}

// ── Paquetes Todo Incluido ────────────────────────────────────────────────────
export interface PaqueteItem {
  nombre: string;
  habitacion: string; // suite seleccionada para este paquete
  noches: number;
  personas: number;
  precio: number;     // precio total del paquete (editable)
}

export const PAQUETES_CATALOG: { nombre: string; habitacionDefault: string; noches: number; personas: number; precio: number; descripcion: string }[] = [
  { nombre: 'Noche de Selva',      habitacionDefault: 'Suite Flor de Liz 1', noches: 2, personas: 2, precio: 5200,  descripcion: '2 noches · spa privado · 2 desayunos · Las Pozas' },
  { nombre: 'Ruta de las Pozas',   habitacionDefault: 'Jungla',              noches: 3, personas: 2, precio: 8900,  descripcion: '3 noches · desayunos · tour Las Pozas · tour Tamul' },
  { nombre: 'Familia Huasteca',    habitacionDefault: 'Helechos 1',          noches: 3, personas: 4, precio: 13500, descripcion: '3 noches · suite familiar · desayunos · tour Las Pozas' },
  { nombre: 'Selva en Silencio',   habitacionDefault: 'Suite LindaVista',    noches: 3, personas: 2, precio: 6900,  descripcion: '3 noches · tour Las Pozas (grupo reducido) · late check-out' },
  { nombre: 'Paquete personalizado', habitacionDefault: 'Jungla',            noches: 2, personas: 2, precio: 0,     descripcion: '' },
];

const PAQUETES_SEP = '||PAQUETES||';
function parsePaquetes(notas: string): PaqueteItem[] {
  const idx = notas.indexOf(PAQUETES_SEP);
  if (idx === -1) return [];
  try { return JSON.parse(notas.slice(idx + PAQUETES_SEP.length).split('||HABS||')[0]); } catch { return []; }
}

const HABS_SEP = '||HABS||';
function parseHabs(notas: string): HabItem[] | null {
  const idx = notas.indexOf(HABS_SEP);
  if (idx === -1) return null;
  try { return JSON.parse(notas.slice(idx + HABS_SEP.length)); } catch { return null; }
}
function inferGuests(rooms: BookingRoom[], suite: string, ratePerNight: number): number {
  const room = rooms.find(r => r.name === suite);
  if (!room) return 2;
  const keys = Object.keys(room.priceTiers).map(Number).sort((a, b) => a - b);
  let guests = keys[0] ?? 2;
  for (const k of keys) {
    if (room.priceTiers[k] <= ratePerNight + 50) guests = k;
  }
  return guests;
}
function getPaquetesTotal(paquetes: PaqueteItem[]): number {
  return paquetes.reduce((s, p) => s + p.precio, 0);
}

// ── Tours / Experiencias ──────────────────────────────────────────────────────
export const TOURS_CATALOG: { nombre: string; precio: number }[] = [
  { nombre: 'Expedición Tamul (Sótano + Cascada + Cenote)', precio: 1450 },
  { nombre: 'Ruta Surrealista (Las Pozas + Huichihuayán)', precio: 1300 },
  { nombre: 'Cascadas del Meco (El Meco + El Salto)', precio: 1600 },
  { nombre: 'Paraíso Escalonado (Minas Viejas + Micos)', precio: 1500 },
  { nombre: 'Ruta Acuática (Puente de Dios + Siete Cascadas)', precio: 1500 },
  { nombre: 'Sótano de las Golondrinas', precio: 800 },
  { nombre: 'Tour personalizado', precio: 0 },
];

const TOURS_SEP = '||TOURS||';
function parseTours(notas: string): TourItem[] {
  const idx = notas.indexOf(TOURS_SEP);
  if (idx === -1) return [];
  try { return JSON.parse(notas.slice(idx + TOURS_SEP.length)); } catch { return []; }
}
function getToursTotalQ(tours: TourItem[]): number {
  return tours.reduce((s, t) => s + t.precio * t.personas, 0);
}

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: '#888', ENVIADA: '#2e6b8a', ACEPTADA: '#2d7a34', EXPIRADA: '#c9484a',
};

interface HabItem { suite: string; huespedes: number; precioOverride?: number }

function getHabPrecioQ(rooms: BookingRoom[], hab: HabItem): number {
  return hab.precioOverride ?? getPrecioNoche(rooms, hab.suite, hab.huespedes);
}

function calcNights(ci: string, co: string) {
  if (!ci || !co) return 0;
  return Math.max(0, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000));
}

function fmtDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtDateFull(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${parseInt(day)} de ${months[parseInt(m)-1]} ${y}`;
}

function calcCancelDate(checkin: string): string {
  const d = new Date(checkin + 'T00:00:00');
  d.setDate(d.getDate() - 3);
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()} a las 11:59 PM`;
}

const INTERNO_SEP = '||INTERNO||';
function parseNotasCliente(notas: string): string {
  const idx = notas.indexOf(INTERNO_SEP);
  return idx === -1 ? notas.trim() : notas.slice(0, idx).trim();
}
function joinNotas(cliente: string, interno: string, tours: TourItem[] = [], paquetes: PaqueteItem[] = [], habs: HabItem[] = []): string {
  let base = interno.trim() ? `${cliente}${INTERNO_SEP}${interno}` : cliente;
  if (tours.length > 0) base += `${TOURS_SEP}${JSON.stringify(tours)}`;
  if (paquetes.length > 0) base += `${PAQUETES_SEP}${JSON.stringify(paquetes)}`;
  if (habs.length > 0) base += `${HABS_SEP}${JSON.stringify(habs)}`;
  return base;
}

// ── PDF Confirmación de reserva ─────────────────────────────────────────────
// En multi-tenant las imágenes por suite del hotel no están mapeadas aquí; el
// template buildBookingHtml degrada con gradientes cuando no recibe imágenes.
export function printBookingPDF(b: {
  confirmacion: string; cliente: string; email: string; telefono: string;
  habitaciones: string; checkin: string; checkout: string; noches: number;
  huespedes: number; total: number; notas: string; fecha: string;
  anticipo?: number; restante?: number; fechaLimitePago?: string;
  tourItems?: TourItem[];
  compact?: boolean;
}) {
  const suites = b.habitaciones.split(', ').filter(Boolean).map(s => s.trim());

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(buildBookingHtml({
    confirmacion: b.confirmacion,
    cliente: b.cliente,
    suites,
    checkin: b.checkin,
    checkout: b.checkout,
    noches: b.noches,
    huespedes: b.huespedes,
    total: b.total,
    anticipo: b.anticipo,
    restante: b.restante,
    cancelDateStr: calcCancelDate(b.checkin),
    fechaLimiteStr: fmtDateFull(b.fechaLimitePago || b.checkin),
    notasClienteText: parseNotasCliente(b.notas || ''),
    forPrint: true,
    tourItems: b.tourItems ?? parseTours(b.notas || ''),
    compact: b.compact ?? false,
  }));
  win.document.close();
}

interface Props { initialQuotes: AdminQuote[]; rooms: BookingRoom[]; slug: string }

function QuoteModal({ rooms, onClose, onSaved }: { rooms: BookingRoom[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const SUITES = rooms.map(r => r.name);
  const defaultSuite = SUITES[3] ?? SUITES[0] ?? '';
  const [form, setForm] = useState({ cliente: '', telefono: '', email: '', checkin: '', checkout: '' });
  const [habitaciones, setHabitaciones] = useState<HabItem[]>([{ suite: defaultSuite, huespedes: 2 }]);
  const [tourItems, setTourItems] = useState<TourItem[]>([]);
  const [paqueteItems, setPaqueteItems] = useState<PaqueteItem[]>([]);
  const [precioManual, setPrecioManual] = useState<number | null>(null);
  const [promoActiva, setPromoActiva] = useState(false);
  const [notasCliente, setNotasCliente] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function addTour() { setTourItems(t => [...t, { nombre: TOURS_CATALOG[0].nombre, personas: 2, precio: TOURS_CATALOG[0].precio }]); setPrecioManual(null); }
  function removeTour(i: number) { setTourItems(t => t.filter((_, idx) => idx !== i)); setPrecioManual(null); }
  function updateTour(i: number, key: keyof TourItem, val: string | number) {
    setTourItems(t => t.map((item, idx) => {
      if (idx !== i) return item;
      if (key === 'nombre') {
        const cat = TOURS_CATALOG.find(c => c.nombre === val);
        return { ...item, nombre: String(val), precio: cat ? cat.precio : item.precio };
      }
      return { ...item, [key]: typeof val === 'string' ? parseInt(val) || 0 : val };
    }));
    setPrecioManual(null);
  }
  function removePaquete(i: number) { setPaqueteItems(p => p.filter((_, idx) => idx !== i)); setPrecioManual(null); }
  function updatePaquete(i: number, key: keyof PaqueteItem, val: string | number) {
    setPaqueteItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      if (key === 'nombre') {
        const cat = PAQUETES_CATALOG.find(c => c.nombre === val);
        return cat ? { ...item, nombre: cat.nombre, habitacion: cat.habitacionDefault, noches: cat.noches, personas: cat.personas, precio: cat.precio } : { ...item, nombre: String(val) };
      }
      return { ...item, [key]: typeof val === 'string' ? (isNaN(Number(val)) ? val : Number(val)) : val };
    }));
    if (key !== 'nombre') setPrecioManual(null);
  }

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function addHab() { setHabitaciones(h => [...h, { suite: defaultSuite, huespedes: 2 }]); }
  function removeHab(i: number) { setHabitaciones(h => h.filter((_, idx) => idx !== i)); setPrecioManual(null); setPromoActiva(false); }
  function updateHab(i: number, key: 'suite' | 'huespedes', val: string | number) {
    setHabitaciones(h => h.map((item, idx) => idx === i ? { ...item, [key]: val, precioOverride: undefined } : item));
    setPrecioManual(null); setPromoActiva(false);
  }
  function updateHabPrecio(i: number, precio: number) {
    setHabitaciones(h => h.map((item, idx) => idx === i ? { ...item, precioOverride: precio } : item));
    setPrecioManual(null); setPromoActiva(false);
  }

  const noches = calcNights(form.checkin, form.checkout);
  const habsAuto = habitaciones.reduce((sum, h) => sum + getHabPrecioQ(rooms, h) * Math.max(noches, 1), 0);
  const toursAuto = getToursTotalQ(tourItems);
  const paquetesAuto = getPaquetesTotal(paqueteItems);
  const precioAuto = habsAuto + toursAuto + paquetesAuto;
  const precio2Noches = habitaciones.reduce((sum, h) => sum + getHabPrecioQ(rooms, h) * 2, 0) + toursAuto + paquetesAuto;
  const precioTotal = precioManual ?? precioAuto;

  function aplicarPromo3x2() { setPrecioManual(precio2Noches); setPromoActiva(true); }
  function resetPrecio() { setPrecioManual(null); setPromoActiva(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const suite = habitaciones.map(h => h.suite).join(', ');
      const huespedes = habitaciones.reduce((sum, h) => sum + h.huespedes, 0);
      const res = await fetch('/api/admin/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, suite, huespedes, noches, precioTotal, notas: joinNotas(notasCliente, notasInternas, tourItems, paqueteItems, habitaciones) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear');
      await onSaved();
      onClose();
    } catch (e: any) {
      const msg = e.message || 'Error al guardar';
      setError(msg);
      alert(`❌ Error al crear cotización:\n${msg}`);
    }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Nueva Cotización</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.grid2}>
            <label className={styles.field}><span>Cliente *</span><input value={form.cliente} onChange={e => set('cliente', e.target.value)} required /></label>
            <label className={styles.field}><span>Teléfono</span><input value={form.telefono} onChange={e => set('telefono', e.target.value)} /></label>
            <label className={styles.field}><span>Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
            <label className={styles.field}><span>Check-in</span><input type="date" value={form.checkin} onChange={e => set('checkin', e.target.value)} /></label>
            <label className={styles.field}><span>Check-out</span><input type="date" value={form.checkout} onChange={e => set('checkout', e.target.value)} /></label>
          </div>

          {/* Habitaciones */}
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>Habitaciones *</span>
              <button type="button" className={styles.addRoomBtn} onClick={addHab}>
                <Plus size={13} /> Agregar habitación
              </button>
            </div>
            {habitaciones.map((hab, i) => (
              <div key={i} className={styles.roomRow}>
                <select className={styles.roomRowSelect} value={hab.suite} onChange={e => updateHab(i, 'suite', e.target.value)}>
                  {SUITES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={hab.huespedes} onChange={e => updateHab(i, 'huespedes', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input
                  type="number" min={0}
                  className={styles.roomPriceInput}
                  value={getHabPrecioQ(rooms, hab)}
                  onChange={e => updateHabPrecio(i, parseInt(e.target.value) || 0)}
                  title="Precio por noche"
                />
                {habitaciones.length > 1 && (
                  <button type="button" className={styles.removeRoomBtn} onClick={() => removeHab(i)}><X size={13} /></button>
                )}
              </div>
            ))}
          </div>

          {/* Tours */}
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>Tours / Experiencias</span>
              <button type="button" className={styles.addRoomBtn} onClick={addTour}>
                <Plus size={13} /> Agregar tour
              </button>
            </div>
            {tourItems.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: '#aaa', padding: '6px 0' }}>Sin tours agregados</p>
            )}
            {tourItems.map((t, i) => (
              <div key={i} className={styles.roomRow}>
                <select className={styles.roomRowSelect} style={{ flex: 2 }} value={t.nombre}
                  onChange={e => updateTour(i, 'nombre', e.target.value)}>
                  {TOURS_CATALOG.map(c => <option key={c.nombre}>{c.nombre}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={t.personas}
                  onChange={e => updateTour(i, 'personas', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input type="number" min={0} className={styles.roomPriceInput}
                  value={t.precio} title="Precio por persona"
                  onChange={e => updateTour(i, 'precio', parseInt(e.target.value) || 0)} />
                <button type="button" className={styles.removeRoomBtn} onClick={() => removeTour(i)}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Paquetes */}
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>🎁 Paquetes Todo Incluido</span>
            </div>
            {/* Catálogo de paquetes — clic para agregar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {PAQUETES_CATALOG.filter(c => c.precio > 0).map(cat => {
                const yaAgregado = paqueteItems.some(p => p.nombre === cat.nombre);
                return (
                  <button
                    key={cat.nombre}
                    type="button"
                    onClick={() => {
                      if (!yaAgregado) {
                        setPaqueteItems(p => [...p, { nombre: cat.nombre, habitacion: cat.habitacionDefault, noches: cat.noches, personas: cat.personas, precio: cat.precio }]);
                        setPrecioManual(null);
                      }
                    }}
                    title={cat.descripcion}
                    style={{
                      padding: '5px 10px', fontSize: '0.75rem', borderRadius: 6, cursor: yaAgregado ? 'default' : 'pointer',
                      border: '1px solid', borderColor: yaAgregado ? '#4a7a2e' : '#a7d4bb',
                      background: yaAgregado ? '#e8f4e8' : '#f9fafb',
                      color: yaAgregado ? '#2d5016' : '#6b7280',
                      fontFamily: 'inherit',
                    }}
                  >
                    {yaAgregado ? '✓ ' : '+ '}{cat.nombre} · {cat.noches}n · ${cat.precio.toLocaleString('es-MX')}
                  </button>
                );
              })}
            </div>
            {paqueteItems.length === 0 && <p style={{ fontSize: '0.75rem', color: '#aaa', padding: '4px 0' }}>Sin paquetes agregados</p>}
            {paqueteItems.map((p, i) => (
              <div key={i} className={styles.roomRow} style={{ flexWrap: 'wrap', gap: 6 }}>
                <select className={styles.roomRowSelect} style={{ flex: '2 1 140px' }} value={p.nombre}
                  onChange={e => updatePaquete(i, 'nombre', e.target.value)}>
                  {PAQUETES_CATALOG.map(c => <option key={c.nombre}>{c.nombre}</option>)}
                </select>
                <select className={styles.roomRowSelect} style={{ flex: '2 1 120px' }} value={p.habitacion}
                  onChange={e => updatePaquete(i, 'habitacion', e.target.value)}>
                  {SUITES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={p.noches}
                  onChange={e => updatePaquete(i, 'noches', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}n</option>)}
                </select>
                <select className={styles.roomRowSelect} value={p.personas}
                  onChange={e => updatePaquete(i, 'personas', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input type="number" min={0} className={styles.roomPriceInput}
                  value={p.precio} title="Precio total del paquete"
                  onChange={e => updatePaquete(i, 'precio', parseInt(e.target.value) || 0)} />
                <button type="button" className={styles.removeRoomBtn} onClick={() => removePaquete(i)}><X size={13} /></button>
              </div>
            ))}
          </div>

          {/* Precio */}
          <div className={styles.priceBreakdown}>
            {habitaciones.map((hab, i) => {
              const pn = getHabPrecioQ(rooms, hab);
              return (
                <div key={i} className={styles.priceBreakdownRow}>
                  <span>{hab.suite} ({hab.huespedes}p)</span>
                  <span>${pn.toLocaleString('es-MX')}/noche × {Math.max(noches,1)} = ${(pn * Math.max(noches,1)).toLocaleString('es-MX')}</span>
                </div>
              );
            })}
            {tourItems.map((t, i) => (
              <div key={`t${i}`} className={styles.priceBreakdownRow} style={{ color: '#6b7280' }}>
                <span>🗺 {t.nombre.length > 30 ? t.nombre.slice(0,30)+'…' : t.nombre} ({t.personas}p)</span>
                <span>${t.precio.toLocaleString('es-MX')}/p × {t.personas} = ${(t.precio*t.personas).toLocaleString('es-MX')}</span>
              </div>
            ))}
            {paqueteItems.map((p, i) => (
              <div key={`pq${i}`} className={styles.priceBreakdownRow} style={{ color: '#1B4332', fontWeight: 500 }}>
                <span>🎁 {p.nombre} ({p.habitacion}, {p.personas}p, {p.noches}n)</span>
                <span>${p.precio.toLocaleString('es-MX')} MXN</span>
              </div>
            ))}

            {/* Botón promo 3x2 */}
            <div className={styles.promoRow}>
              <button
                type="button"
                className={`${styles.promoBtn} ${promoActiva ? styles.promoBtnActive : ''}`}
                onClick={promoActiva ? resetPrecio : aplicarPromo3x2}
                disabled={noches !== 3}
                title={noches !== 3 ? 'Solo aplica para estadías de exactamente 3 noches' : ''}
              >
                🎁 {promoActiva ? '✓ Promo 3×2 activa' : 'Aplicar 3×2 (3ª noche gratis)'}
              </button>
              {promoActiva && (
                <span className={styles.promoSaving}>
                  Ahorro: ${(precioAuto - precio2Noches).toLocaleString('es-MX')} MXN
                </span>
              )}
            </div>

            <div className={styles.priceTotalRow}>
              <span className={styles.priceTotalLabel}>Precio final (MXN)</span>
              <div className={styles.priceEditRow}>
                <input
                  type="number" min={0}
                  className={styles.priceInput}
                  value={precioTotal}
                  onChange={e => { setPrecioManual(parseInt(e.target.value) || 0); setPromoActiva(false); }}
                />
                {(precioManual !== null) && (
                  <button type="button" className={styles.resetPriceBtn} onClick={resetPrecio}>↩ Calcular</button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>Notas para el cliente (aparece en PDF)</span>
              <textarea rows={2} value={notasCliente} onChange={e => setNotasCliente(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Notas internas (solo tú las ves)</span>
              <textarea rows={2} value={notasInternas} onChange={e => setNotasInternas(e.target.value)} />
            </label>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : null} Crear cotización
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditQuoteModal({ quote, rooms, onClose, onSaved }: {
  quote: AdminQuote;
  rooms: BookingRoom[];
  onClose: () => void;
  onSaved: (q: AdminQuote, changes: Partial<AdminQuote>) => void;
}) {
  const SUITES = rooms.map(r => r.name);
  const defaultSuite = SUITES[3] ?? SUITES[0] ?? '';
  const [form, setForm] = useState({
    cliente: quote.cliente, telefono: quote.telefono, email: quote.email,
    checkin: quote.checkin, checkout: quote.checkout,
  });
  const [habitaciones, setHabitaciones] = useState<HabItem[]>(() => {
    const stored = parseHabs(quote.notas || '');
    if (stored && stored.length > 0) return stored;
    // Fallback: infer guests from precioTotal
    const rNames = quote.suite.split(', ').filter(Boolean).map(s => s.trim());
    const tTotal = getToursTotalQ(parseTours(quote.notas || ''));
    const pTotal = getPaquetesTotal(parsePaquetes(quote.notas || ''));
    const habsPerRoom = rNames.length > 0 && quote.noches > 0
      ? Math.round(((quote.precioTotal || 0) - tTotal - pTotal) / rNames.length / quote.noches)
      : 1900;
    return rNames.map(suite => ({ suite, huespedes: inferGuests(rooms, suite, habsPerRoom) }));
  });
  const [tourItems, setTourItems] = useState<TourItem[]>(() => parseTours(quote.notas || ''));
  const [paqueteItems, setPaqueteItems] = useState<PaqueteItem[]>(() => parsePaquetes(quote.notas || ''));
  const [precioManual, setPrecioManual] = useState<number | null>(quote.precioTotal || null);
  const [promoActiva, setPromoActiva] = useState(false);
  const [notasCliente, setNotasCliente] = useState(() => parseNotasCliente(quote.notas || ''));
  const [notasInternas, setNotasInternas] = useState(() => {
    const idx = (quote.notas || '').indexOf(INTERNO_SEP);
    if (idx === -1) return '';
    const after = quote.notas.slice(idx + INTERNO_SEP.length);
    const toursIdx = after.indexOf(TOURS_SEP);
    return toursIdx === -1 ? after.trim() : after.slice(0, toursIdx).trim();
  });
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  function addHab() { setHabitaciones(h => [...h, { suite: defaultSuite, huespedes: 2 }]); }
  function removeHab(i: number) { setHabitaciones(h => h.filter((_, idx) => idx !== i)); setPromoActiva(false); }
  function updateHab(i: number, key: 'suite' | 'huespedes', val: string | number) {
    setHabitaciones(h => h.map((item, idx) => idx === i ? { ...item, [key]: val, precioOverride: undefined } : item));
    setPromoActiva(false);
  }
  function updateHabPrecio(i: number, precio: number) {
    setHabitaciones(h => h.map((item, idx) => idx === i ? { ...item, precioOverride: precio } : item));
    setPrecioManual(null); setPromoActiva(false);
  }
  function addTourE() { setTourItems(t => [...t, { nombre: TOURS_CATALOG[0].nombre, personas: 2, precio: TOURS_CATALOG[0].precio }]); setPrecioManual(null); }
  function removeTourE(i: number) { setTourItems(t => t.filter((_, idx) => idx !== i)); setPrecioManual(null); }
  function updateTourE(i: number, key: keyof TourItem, val: string | number) {
    setTourItems(t => t.map((item, idx) => {
      if (idx !== i) return item;
      if (key === 'nombre') {
        const cat = TOURS_CATALOG.find(c => c.nombre === val);
        return { ...item, nombre: String(val), precio: cat ? cat.precio : item.precio };
      }
      return { ...item, [key]: typeof val === 'string' ? parseInt(val) || 0 : val };
    }));
    setPrecioManual(null);
  }
  function removePaqueteE(i: number) { setPaqueteItems(p => p.filter((_, idx) => idx !== i)); setPrecioManual(null); }
  function updatePaqueteE(i: number, key: keyof PaqueteItem, val: string | number) {
    setPaqueteItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      if (key === 'nombre') {
        const cat = PAQUETES_CATALOG.find(c => c.nombre === val);
        return cat ? { ...item, nombre: cat.nombre, habitacion: cat.habitacionDefault, noches: cat.noches, personas: cat.personas, precio: cat.precio } : { ...item, nombre: String(val) };
      }
      return { ...item, [key]: typeof val === 'string' ? (isNaN(Number(val)) ? val : Number(val)) : val };
    }));
    if (key !== 'nombre') setPrecioManual(null);
  }

  const noches = calcNights(form.checkin, form.checkout);
  const habsAuto = habitaciones.reduce((sum, h) => sum + getHabPrecioQ(rooms, h) * Math.max(noches, 1), 0);
  const toursAutoE = getToursTotalQ(tourItems);
  const paquetesAutoE = getPaquetesTotal(paqueteItems);
  const precioAuto = habsAuto + toursAutoE + paquetesAutoE;
  const precio2Noches = habitaciones.reduce((sum, h) => sum + getHabPrecioQ(rooms, h) * 2, 0) + toursAutoE + paquetesAutoE;
  const precioTotal = precioManual ?? precioAuto;

  function aplicarPromo3x2() { setPrecioManual(precio2Noches); setPromoActiva(true); }
  function resetPrecio() { setPrecioManual(null); setPromoActiva(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const suite = habitaciones.map(h => h.suite).join(', ');
    await onSaved(quote, { ...form, suite, noches, precioTotal, notas: joinNotas(notasCliente, notasInternas, tourItems, paqueteItems, habitaciones) });
    setLoading(false);
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Editar Cotización <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'monospace' }}>{quote.id}</span></h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.grid2}>
            <label className={styles.field}><span>Cliente</span><input value={form.cliente} onChange={e => set('cliente', e.target.value)} /></label>
            <label className={styles.field}><span>Teléfono</span><input value={form.telefono} onChange={e => set('telefono', e.target.value)} /></label>
            <label className={styles.field}><span>Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
            <label className={styles.field}><span>Check-in</span><input type="date" value={form.checkin} onChange={e => set('checkin', e.target.value)} /></label>
            <label className={styles.field}><span>Check-out</span><input type="date" value={form.checkout} onChange={e => set('checkout', e.target.value)} /></label>
          </div>

          {/* Habitaciones */}
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>Habitaciones</span>
              <button type="button" className={styles.addRoomBtn} onClick={addHab}>
                <Plus size={13} /> Agregar
              </button>
            </div>
            {habitaciones.map((hab, i) => (
              <div key={i} className={styles.roomRow}>
                <select className={styles.roomRowSelect} value={hab.suite} onChange={e => updateHab(i, 'suite', e.target.value)}>
                  {SUITES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={hab.huespedes} onChange={e => updateHab(i, 'huespedes', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input
                  type="number" min={0}
                  className={styles.roomPriceInput}
                  value={getHabPrecioQ(rooms, hab)}
                  onChange={e => updateHabPrecio(i, parseInt(e.target.value) || 0)}
                  title="Precio por noche"
                />
                {habitaciones.length > 1 && (
                  <button type="button" className={styles.removeRoomBtn} onClick={() => removeHab(i)}><X size={13} /></button>
                )}
              </div>
            ))}
          </div>

          {/* Tours */}
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>Tours / Experiencias</span>
              <button type="button" className={styles.addRoomBtn} onClick={addTourE}>
                <Plus size={13} /> Agregar tour
              </button>
            </div>
            {tourItems.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: '#aaa', padding: '6px 0' }}>Sin tours agregados</p>
            )}
            {tourItems.map((t, i) => (
              <div key={i} className={styles.roomRow}>
                <select className={styles.roomRowSelect} style={{ flex: 2 }} value={t.nombre}
                  onChange={e => updateTourE(i, 'nombre', e.target.value)}>
                  {TOURS_CATALOG.map(c => <option key={c.nombre}>{c.nombre}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={t.personas}
                  onChange={e => updateTourE(i, 'personas', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input type="number" min={0} className={styles.roomPriceInput}
                  value={t.precio} title="Precio por persona"
                  onChange={e => updateTourE(i, 'precio', parseInt(e.target.value) || 0)} />
                <button type="button" className={styles.removeRoomBtn} onClick={() => removeTourE(i)}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Paquetes — EditQuoteModal */}
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>🎁 Paquetes Todo Incluido</span>
            </div>
            {/* Catálogo de paquetes — clic para agregar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {PAQUETES_CATALOG.filter(c => c.precio > 0).map(cat => {
                const yaAgregado = paqueteItems.some(p => p.nombre === cat.nombre);
                return (
                  <button
                    key={cat.nombre}
                    type="button"
                    onClick={() => {
                      if (!yaAgregado) {
                        setPaqueteItems(p => [...p, { nombre: cat.nombre, habitacion: cat.habitacionDefault, noches: cat.noches, personas: cat.personas, precio: cat.precio }]);
                        setPrecioManual(null);
                      }
                    }}
                    title={cat.descripcion}
                    style={{
                      padding: '5px 10px', fontSize: '0.75rem', borderRadius: 6, cursor: yaAgregado ? 'default' : 'pointer',
                      border: '1px solid', borderColor: yaAgregado ? '#4a7a2e' : '#a7d4bb',
                      background: yaAgregado ? '#e8f4e8' : '#f9fafb',
                      color: yaAgregado ? '#2d5016' : '#6b7280',
                      fontFamily: 'inherit',
                    }}
                  >
                    {yaAgregado ? '✓ ' : '+ '}{cat.nombre} · {cat.noches}n · ${cat.precio.toLocaleString('es-MX')}
                  </button>
                );
              })}
            </div>
            {paqueteItems.length === 0 && <p style={{ fontSize: '0.75rem', color: '#aaa', padding: '4px 0' }}>Sin paquetes agregados</p>}
            {paqueteItems.map((p, i) => (
              <div key={i} className={styles.roomRow} style={{ flexWrap: 'wrap', gap: 6 }}>
                <select className={styles.roomRowSelect} style={{ flex: '2 1 140px' }} value={p.nombre}
                  onChange={e => updatePaqueteE(i, 'nombre', e.target.value)}>
                  {PAQUETES_CATALOG.map(c => <option key={c.nombre}>{c.nombre}</option>)}
                </select>
                <select className={styles.roomRowSelect} style={{ flex: '2 1 120px' }} value={p.habitacion}
                  onChange={e => updatePaqueteE(i, 'habitacion', e.target.value)}>
                  {SUITES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={p.noches}
                  onChange={e => updatePaqueteE(i, 'noches', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}n</option>)}
                </select>
                <select className={styles.roomRowSelect} value={p.personas}
                  onChange={e => updatePaqueteE(i, 'personas', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input type="number" min={0} className={styles.roomPriceInput}
                  value={p.precio} title="Precio total del paquete"
                  onChange={e => updatePaqueteE(i, 'precio', parseInt(e.target.value) || 0)} />
                <button type="button" className={styles.removeRoomBtn} onClick={() => removePaqueteE(i)}><X size={13} /></button>
              </div>
            ))}
          </div>

          {/* Precio */}
          <div className={styles.priceBreakdown}>
            {habitaciones.map((hab, i) => {
              const pn = getHabPrecioQ(rooms, hab);
              return (
                <div key={i} className={styles.priceBreakdownRow}>
                  <span>{hab.suite} ({hab.huespedes}p)</span>
                  <span>${pn.toLocaleString('es-MX')}/noche × {Math.max(noches,1)} = ${(pn * Math.max(noches,1)).toLocaleString('es-MX')}</span>
                </div>
              );
            })}
            {tourItems.map((t, i) => (
              <div key={`t${i}`} className={styles.priceBreakdownRow} style={{ color: '#6b7280' }}>
                <span>🗺 {t.nombre.length > 30 ? t.nombre.slice(0,30)+'…' : t.nombre} ({t.personas}p)</span>
                <span>${(t.precio*t.personas).toLocaleString('es-MX')}</span>
              </div>
            ))}
            {paqueteItems.map((p, i) => (
              <div key={`pqe${i}`} className={styles.priceBreakdownRow} style={{ color: '#1B4332', fontWeight: 500 }}>
                <span>🎁 {p.nombre} ({p.habitacion}, {p.personas}p, {p.noches}n)</span>
                <span>${p.precio.toLocaleString('es-MX')} MXN</span>
              </div>
            ))}

            <div className={styles.promoRow}>
              <button
                type="button"
                className={`${styles.promoBtn} ${promoActiva ? styles.promoBtnActive : ''}`}
                onClick={promoActiva ? resetPrecio : aplicarPromo3x2}
                disabled={noches !== 3}
                title={noches !== 3 ? 'Solo aplica para estadías de exactamente 3 noches' : ''}
              >
                🎁 {promoActiva ? '✓ Promo 3×2 activa' : 'Aplicar 3×2 (3ª noche gratis)'}
              </button>
              {promoActiva && (
                <span className={styles.promoSaving}>
                  Ahorro: ${(precioAuto - precio2Noches).toLocaleString('es-MX')} MXN
                </span>
              )}
            </div>

            <div className={styles.priceTotalRow}>
              <span className={styles.priceTotalLabel}>Precio final (MXN)</span>
              <div className={styles.priceEditRow}>
                <input
                  type="number" min={0}
                  className={styles.priceInput}
                  value={precioTotal}
                  onChange={e => { setPrecioManual(parseInt(e.target.value) || 0); setPromoActiva(false); }}
                />
                {precioManual !== null && (
                  <button type="button" className={styles.resetPriceBtn} onClick={resetPrecio}>↩ Calcular</button>
                )}
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>Notas para el cliente (aparece en PDF)</span>
              <textarea rows={2} value={notasCliente} onChange={e => setNotasCliente(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>Notas internas (solo tú las ves)</span>
              <textarea rows={2} value={notasInternas} onChange={e => setNotasInternas(e.target.value)} />
            </label>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : null} Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CotizacionesClient({ initialQuotes, rooms, slug }: Props) {
  void slug; // el tenant se resuelve server-side por cookie; el slug queda disponible por consistencia
  const SUITES = useMemo(() => rooms.map(r => r.name), [rooms]);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [showModal, setShowModal] = useState(false);
  const [editQuote, setEditQuote] = useState<AdminQuote | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [suiteFilter, setSuiteFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return quotes.filter(x => {
      if (q && !x.cliente.toLowerCase().includes(q) &&
          !x.email.toLowerCase().includes(q) &&
          !x.id.toLowerCase().includes(q)) return false;
      if (estadoFilter && x.estado !== estadoFilter) return false;
      if (suiteFilter && !x.suite.includes(suiteFilter)) return false;
      if (fechaDesde && x.checkin < fechaDesde) return false;
      if (fechaHasta && x.checkin > fechaHasta) return false;
      return true;
    });
  }, [quotes, search, estadoFilter, suiteFilter, fechaDesde, fechaHasta]);

  const hasActiveFilters = estadoFilter || suiteFilter || fechaDesde || fechaHasta;
  function clearFilters() { setEstadoFilter(''); setSuiteFilter(''); setFechaDesde(''); setFechaHasta(''); }

  async function refresh() {
    const res = await fetch('/api/admin/cotizaciones');
    if (res.ok) setQuotes(await res.json());
  }

  async function sendEmail(q: AdminQuote) {
    if (!q.email) return alert('Esta cotización no tiene email');
    setSendingId(q.id);
    try {
      const res = await fetch(`/api/admin/cotizaciones/${q.id}/send-email`, { method: 'POST' });
      if (res.ok) { alert(`✅ Email enviado a ${q.email}`); refresh(); }
      else { const d = await res.json().catch(() => ({})); alert('Error al enviar email' + (d.error ? `: ${d.error}` : '')); }
    } finally { setSendingId(null); }
  }

  async function deleteQuote(q: AdminQuote) {
    if (!confirm(`¿Eliminar cotización ${q.id}?`)) return;
    await fetch(`/api/admin/cotizaciones/${q.id}`, { method: 'DELETE' });
    refresh();
  }

  async function saveEdit(q: AdminQuote, changes: Partial<AdminQuote>) {
    await fetch(`/api/admin/cotizaciones/${q.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    setEditQuote(null);
    await refresh();
  }

  function openWhatsApp(q: AdminQuote) {
    const text = encodeURIComponent(
      `Hola ${q.cliente}, te comparto tu cotización:\n\n` +
      `🏡 Suite: ${q.suite}\n` +
      `📅 Check-in: ${fmtDate(q.checkin)}\n📅 Check-out: ${fmtDate(q.checkout)}\n` +
      `🌙 ${q.noches} noche${q.noches !== 1 ? 's' : ''}\n` +
      `💰 Total: $${q.precioTotal.toLocaleString('es-MX')} MXN\n\n` +
      `Válida por 48 horas ✅`
    );
    const tel = (q.telefono || '').replace(/\D/g,'');
    window.open(`https://wa.me/${tel}?text=${text}`, '_blank');
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cotizaciones</h1>
          <p className={styles.pageSub}>
            {filtered.length} cotizaciones · {filtered.filter(q => q.estado === 'ENVIADA').length} enviadas
            {(() => {
              const borradorConEmail = quotes.filter(q => q.estado === 'BORRADOR' && q.email);
              const totalBorrador = borradorConEmail.reduce((s, q) => s + q.precioTotal, 0);
              return borradorConEmail.length > 0 ? (
                <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#fde8e8', color: '#8a1a1a', padding: '2px 7px', borderRadius: 3, fontWeight: 600 }}>
                  ${totalBorrador.toLocaleString('es-MX')} MXN sin enviar
                </span>
              ) : null;
            })()}
            {hasActiveFilters && <span className={styles.filterBadge}>Filtros activos</span>}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={refresh} title="Actualizar"><RefreshCw size={16} /></button>
          <button className={`${styles.iconBtn} ${showFilters ? styles.iconBtnActive : ''}`}
            onClick={() => setShowFilters(s => !s)}>
            Filtros {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button className={styles.primaryBtn} onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nueva cotización
          </button>
        </div>
      </div>

      {/* Búsqueda */}
      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} />
        <input className={styles.searchInput} placeholder="Buscar por cliente, email o ID…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filtros avanzados */}
      {showFilters && (
        <div className={styles.filtersPanel}>
          <div className={styles.filtersGrid}>
            <label className={styles.filterField}>
              <span>Estado</span>
              <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADA">Enviada</option>
                <option value="ACEPTADA">Aceptada</option>
                <option value="EXPIRADA">Expirada</option>
              </select>
            </label>
            <label className={styles.filterField}>
              <span>Suite</span>
              <select value={suiteFilter} onChange={e => setSuiteFilter(e.target.value)}>
                <option value="">Todas</option>
                {SUITES.map(s => <option key={s}>{s}</option>)}
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
          {hasActiveFilters && <button className={styles.clearBtn} onClick={clearFilters}>Limpiar filtros</button>}
        </div>
      )}

      {/* ── Mobile tarjetas (visible solo en <640px via CSS) ── */}
      <div className={styles.mobileCardList}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '32px 0', color: 'var(--sage)' }}>Sin cotizaciones que mostrar</p>
        ) : filtered.map(q => (
          <div key={q.id} className={styles.mobileCard}>
            <div className={styles.mobileCardTop}>
              <span className={styles.mobileCardRef}>{q.id}</span>
              <span className={styles.badge} style={{ color: ESTADO_COLOR[q.estado], fontSize: '0.65rem' }}>{q.estado}</span>
            </div>
            <div className={styles.mobileCardName}>{q.cliente}</div>
            {q.email && <div className={styles.mobileCardEmail}>{q.email}</div>}
            <div className={styles.mobileCardSuite}>{q.suite}</div>
            <div className={styles.mobileCardDates}>{fmtDate(q.checkin)} → {fmtDate(q.checkout)} · {q.noches}n</div>
            <div className={styles.mobileCardTotal}>${q.precioTotal.toLocaleString('es-MX')} MXN</div>
            <div className={styles.mobileCardActions}>
              <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnSend}`} onClick={() => sendEmail(q)} disabled={sendingId === q.id}>
                {sendingId === q.id ? <Loader2 size={12} /> : <Send size={12} />}
              </button>
              <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnWa}`} onClick={() => openWhatsApp(q)}>
                <MessageSquare size={12} />
              </button>
              <a href={`/api/admin/cotizaciones/${q.id}/render`} target="_blank" rel="noopener"
                className={`${styles.mobileCardBtn} ${styles.mobileCardBtnPdf}`}
                style={{ display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                title="Descargar cotización">
                <Download size={12} />
              </a>
              <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnEdit}`} onClick={() => setEditQuote(q)}>
                <Pencil size={12} />
              </button>
              <button className={`${styles.mobileCardBtn} ${styles.mobileCardBtnDel}`} onClick={() => deleteQuote(q)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className={styles.scrollHint}>← desliza para ver más →</p>

      {/* Desktop tabla */}
      <div className={styles.tableScrollWrap}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th><th>Cliente</th><th>Suite</th><th>Check-in</th>
              <th>Check-out</th><th>Total</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className={styles.empty}>Sin cotizaciones que mostrar</td></tr>
            ) : filtered.map(q => (
              <tr key={q.id} className={styles.row}>
                <td className={styles.mono}>{q.id}</td>
                <td>
                  <div className={styles.clienteName}>{q.cliente}</div>
                  {q.email && <div className={styles.clienteEmail}>{q.email}</div>}
                </td>
                <td>{q.suite}</td>
                <td>{fmtDate(q.checkin)}</td>
                <td>{fmtDate(q.checkout)}</td>
                <td className={styles.total}>${q.precioTotal.toLocaleString('es-MX')}</td>
                <td>
                  <span className={styles.badge} style={{ color: ESTADO_COLOR[q.estado] }}>{q.estado}</span>
                  {q.estado === 'BORRADOR' && q.email && (
                    <span title="Sin enviar — tiene email" style={{ marginLeft: 5, fontSize: '0.65rem', background: '#fde8e8', color: '#8a1a1a', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>Sin enviar</span>
                  )}
                </td>
                <td>
                  <div className={styles.sendActions}>
                    <button className={styles.sendBtn} onClick={() => sendEmail(q)} disabled={sendingId === q.id} title="Enviar por email">
                      {sendingId === q.id ? <Loader2 size={14} className={styles.spin} /> : <Send size={14} />}
                    </button>
                    <button className={styles.waBtn} onClick={() => openWhatsApp(q)} title={q.estado === 'ENVIADA' ? 'Seguimiento WhatsApp' : 'WhatsApp'}>
                      <MessageSquare size={14} />
                    </button>
                    <a href={`/api/admin/cotizaciones/${q.id}/render`} target="_blank" rel="noopener"
                      className={styles.pdfBtn} title="Descargar cotización"
                      style={{ display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                      <Download size={14} />
                    </a>
                    <button className={styles.editBtn} onClick={() => setEditQuote(q)} title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button className={styles.deleteBtn} onClick={() => deleteQuote(q)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div> {/* /tableScrollWrap */}

      {showModal && <QuoteModal rooms={rooms} onClose={() => setShowModal(false)} onSaved={refresh} />}
      {editQuote && <EditQuoteModal quote={editQuote} rooms={rooms} onClose={() => setEditQuote(null)} onSaved={saveEdit} />}
    </div>
  );
}
