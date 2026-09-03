'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertTriangle, CheckCircle, Plus, MessageSquare, Mail, Download, Pencil } from 'lucide-react';
import type { AdminBooking } from '@/lib/admin/sheets-admin';
import { getRoomBasePrice, calcRoomStayTotal, type BookingRoom, type NightPriceOpts } from '@/lib/booking';
import { type TourCat, type PaqueteCat } from '@/lib/admin/cotizaciones-catalogo';
import { parseNotas, construirNotas, type TourItem, type PaqueteItem } from '@/lib/notas';
import { hoyHotel, sumarDias } from '@/lib/fecha-hotel';
import { importarDelHuesped, type Diferencia } from '@/lib/booking/importar-pre-checkin';
import type { PreCheckinGuardado } from '@/lib/db/pre-checkin';
import FichaReserva from './FichaReserva';
import styles from './Modal.module.css';
import { postJson } from '@/lib/ui/api';

interface HabItem { suite: string; huespedes: number; precioOverride?: number }

/** `suite` puede ser el nombre de una UNIDAD ("Deluxe 2"); se mapea a su TIPO. */
function buscarCuarto(rooms: BookingRoom[], suite: string): BookingRoom | undefined {
  return rooms.find(r => r.unidades.includes(suite)) ?? rooms.find(r => r.name === suite);
}

/**
 * Lo que cuesta esa habitación TODA la estancia.
 *
 * 🔴 EL DEFECTO QUE ESTO CIERRA (2 sep 2026). Antes era `precioBase × noches`:
 * la reserva manual del panel ignoraba las temporadas, el recargo de fin de
 * semana y el descuento entre semana. Dar de alta a mano una reserva de Semana
 * Santa cobraba tarifa de temporada baja — y el total viajaba al servidor, que
 * lo aceptaba tal cual. Es la otra cara del hallazgo de las temporadas: uno
 * regala noches por una temporada mal puesta, este por no aplicarla.
 *
 * `precioOverride` sigue mandando: si el hotelero teclea un precio, es su
 * decisión y no se le discute.
 */
function getHabTotal(
  rooms: BookingRoom[],
  hab: HabItem,
  checkin: string,
  checkout: string,
  noches: number,
  opts: NightPriceOpts,
): number {
  const n = Math.max(noches, 1);
  if (hab.precioOverride != null) return hab.precioOverride * n; // TARIFA-A-MANO: precio tecleado por el hotelero; su decisión gana sobre el motor
  const room = buscarCuarto(rooms, hab.suite);
  if (!room) return 1900 * n;
  // Sin fechas todavía (el modal se abre vacío) no hay estancia que calcular.
  if (!checkin || !checkout || checkout <= checkin) {
    return getRoomBasePrice(room, hab.huespedes) * n; // TARIFA-A-MANO: aún no hay fechas, no hay estancia que cotizar
  }
  return calcRoomStayTotal(room, hab.huespedes, checkin, checkout, opts);
}

/**
 * El precio por noche que se ENSEÑA. Con temporadas, las noches de una misma
 * estancia pueden costar distinto, así que es el promedio: es el número que
 * multiplicado por las noches da el total que se va a cobrar.
 */
function getHabPrecio(
  rooms: BookingRoom[],
  hab: HabItem,
  checkin: string,
  checkout: string,
  noches: number,
  opts: NightPriceOpts,
): number {
  const n = Math.max(noches, 1);
  return Math.round(getHabTotal(rooms, hab, checkin, checkout, n, opts) / n);
}

function fmtDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

interface CRMClient { nombre: string; email: string; telefono: string; totalReservas: number }

// ── Success panel after creating a booking ───────────────────────────────────
interface SuccessData {
  confirmacion: string; cliente: string; email: string; telefono: string;
  habitaciones: string; checkin: string; checkout: string;
  noches: number; huespedes: number; total: number;
  anticipo: number; notas: string; fecha: string;
}

function SuccessPanel({ data, onEdit, onClose }: {
  data: SuccessData;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [sendingEmail, setSendingEmail] = useState(false);

  function openWA() {
    const msg = encodeURIComponent(
      `Hola ${data.cliente}, confirmamos tu reserva:\n\n` +
      `✅ Folio: ${data.confirmacion}\n` +
      `🏡 Suite: ${data.habitaciones}\n` +
      `📅 Check-in: ${fmtDate(data.checkin)}\n` +
      `📅 Check-out: ${fmtDate(data.checkout)}\n` +
      `🌙 ${data.noches} noche${data.noches !== 1 ? 's' : ''}\n` +
      `💰 Total: $${data.total.toLocaleString('es-MX')} MXN\n\n` +
      `¡Te esperamos!`
    );
    const tel = (data.telefono || '').replace(/\D/g, '');
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  }

  async function sendEmail() {
    if (!data.email || data.email === 'N/A') return alert('Sin email registrado');
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/admin/reservas/${data.confirmacion}/send-email`, { method: 'POST' });
      if (res.ok) alert(`✅ Confirmación enviada a ${data.email}`);
      else { const d = await res.json(); alert('Error: ' + (d.error || 'No se pudo enviar')); }
    } finally { setSendingEmail(false); }
  }

  function downloadPDF() {
    window.open(`/api/admin/reservas/${data.confirmacion}/render`, '_blank');
  }

  return (
    <div className={styles.successPanel}>
      <div className={styles.successHeader}>
        <CheckCircle size={20} style={{ color: '#2d7a34' }} />
        <span className={styles.successTitle}>Reserva creada</span>
        <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
      </div>

      <div className={styles.successBody}>
        <div className={styles.successConfNum}>{data.confirmacion}</div>

        <div className={styles.successGrid}>
          <div><span className={styles.successLabel}>Cliente</span><span className={styles.successVal}>{data.cliente}</span></div>
          <div><span className={styles.successLabel}>Suite</span><span className={styles.successVal}>{data.habitaciones}</span></div>
          <div><span className={styles.successLabel}>Check-in</span><span className={styles.successVal}>{fmtDate(data.checkin)}</span></div>
          <div><span className={styles.successLabel}>Check-out</span><span className={styles.successVal}>{fmtDate(data.checkout)}</span></div>
          <div><span className={styles.successLabel}>Noches</span><span className={styles.successVal}>{data.noches}</span></div>
          <div><span className={styles.successLabel}>Total</span><span className={styles.successVal} style={{ color: 'var(--forest)', fontWeight: 700 }}>${data.total.toLocaleString('es-MX')} MXN</span></div>
          {data.anticipo > 0 && <>
            <div><span className={styles.successLabel}>Anticipo</span><span className={styles.successVal}>${data.anticipo.toLocaleString('es-MX')} MXN</span></div>
            <div><span className={styles.successLabel}>Restante</span><span className={styles.successVal}>${(data.total - data.anticipo).toLocaleString('es-MX')} MXN</span></div>
          </>}
        </div>

        <div className={styles.successActions}>
          <button className={styles.successActionBtn} style={{ background: '#25D366' }} onClick={openWA}>
            <MessageSquare size={14} /> WhatsApp
          </button>
          <button className={styles.successActionBtn} style={{ background: 'var(--forest)' }} onClick={sendEmail} disabled={sendingEmail}>
            {sendingEmail ? <Loader2 size={14} className={styles.spin} /> : <Mail size={14} />} Email
          </button>
          <button className={styles.successActionBtn} style={{ background: '#624820' }} onClick={downloadPDF}>
            <Download size={14} /> PDF
          </button>
          <button className={styles.successActionBtn} style={{ background: '#4B5563' }} onClick={onEdit}>
            <Pencil size={14} /> Editar
          </button>
        </div>

        <button className={styles.secondaryBtn} onClick={onClose} style={{ width: '100%', marginTop: 4 }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  booking?: AdminBooking;
  rooms: BookingRoom[];
  /**
   * Temporadas, recargo de fin de semana y descuento entre semana del hotel, tal
   * como los usa el motor público. Sin esto, la reserva manual cobraba tarifa de
   * temporada baja en Semana Santa. Opcional para no romper a quien no lo pase,
   * pero TODAS las pantallas del panel lo pasan.
   */
  nightOpts?: NightPriceOpts;
  slug: string;
  defaultCheckin?: string;
  defaultRoom?: string;
  /**
   * Walk-in: el huésped está delante del mostrador. Arranca la casilla "ya está
   * aquí" marcada, para que registrar y ocupar el cuarto sea un solo gesto.
   */
  walkin?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function ReservationModal({ booking, rooms, nightOpts = {}, slug, defaultCheckin, defaultRoom, walkin = false, onClose, onSaved }: Props) {
  const isEdit = !!booking;
  // Lista las UNIDADES físicas (no los tipos): un tipo con cantidad N aporta sus
  // N unidades. Así el hotelero elige la unidad exacta y no sobrevende un tipo.
  const SUITES = rooms.flatMap(r => r.unidades);
  // Catálogo de tours/paquetes POR HOTEL desde /api/admin/catalogo (extras.cotizaciones).
  // Vacío para hoteles que no lo configuran → las secciones se ocultan.
  const [tours, setTours] = useState<TourCat[]>([]);
  const [paquetes, setPaquetes] = useState<PaqueteCat[]>([]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/catalogo');
        if (!res.ok) return;
        const d = await res.json();
        if (cancel) return;
        setTours(Array.isArray(d.tours) ? d.tours : []);
        setPaquetes(Array.isArray(d.paquetes) ? d.paquetes : []);
      } catch { /* sin catálogo */ }
    })();
    return () => { cancel = true; };
  }, [slug]);
  const defaultSuite = (defaultRoom && SUITES.includes(defaultRoom)) ? defaultRoom : (SUITES[3] ?? SUITES[0] ?? '');

  const [form, setForm] = useState({
    cliente: booking?.cliente || '',
    telefono: booking?.telefono || '',
    email: booking?.email || '',
    checkin: booking?.checkin || defaultCheckin || '',
    // En un walk-in la salida se prellena a mañana: es la estancia por defecto
    // de quien llega sin reserva, y el formulario la exige. Sin esto recepción
    // tenía que abrir el calendario con el huésped delante para poder guardar.
    checkout: booking?.checkout || (walkin && defaultCheckin ? sumarDias(defaultCheckin, 1) : ''),
    noches: booking?.noches || 1,
    total: booking?.total || 0,
  });

  // Los cuatro parsers locales que había aquí se fueron a `lib/notas.ts` (paso
  // 7.3). Dos estaban mal: los paquetes no se cortaban por ||HABS||, así que
  // desaparecían al reabrir una reserva para editarla — y al guardar se
  // reescribían las notas SIN ellos, o sea, se perdían de verdad.
  const notasLeidas = parseNotas(booking?.notas || '');
  const [notasCliente, setNotasCliente] = useState(notasLeidas.cliente);
  const [notasInternas, setNotasInternas] = useState(notasLeidas.interno);
  const [tourItems, setTourItems] = useState<TourItem[]>(notasLeidas.tours);
  const [paqueteItems, setPaqueteItems] = useState<PaqueteItem[]>(notasLeidas.paquetes);

  function addTourM() { const first = tours[0]; if (!first) return; setTourItems(t => [...t, { nombre: first.nombre, personas: 2, precio: first.precio }]); }
  function removeTourM(i: number) { setTourItems(t => t.filter((_, idx) => idx !== i)); }
  function updateTourM(i: number, key: keyof TourItem, val: string | number) {
    setTourItems(t => t.map((item, idx) => {
      if (idx !== i) return item;
      if (key === 'nombre') {
        const cat = tours.find(c => c.nombre === val);
        return { ...item, nombre: String(val), precio: cat ? cat.precio : item.precio };
      }
      return { ...item, [key]: typeof val === 'string' ? parseInt(val) || 0 : val };
    }));
  }
  function addPaqueteM() {
    const cat = paquetes[0];
    if (!cat) return;
    setPaqueteItems(p => [...p, { nombre: cat.nombre, habitacion: cat.habitacionDefault, noches: cat.noches, personas: cat.personas, precio: cat.precio }]);
  }
  function removePaqueteM(i: number) { setPaqueteItems(p => p.filter((_, idx) => idx !== i)); }
  function updatePaqueteM(i: number, key: keyof PaqueteItem, val: string | number) {
    setPaqueteItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      if (key === 'nombre') {
        const cat = paquetes.find(c => c.nombre === val);
        return cat ? { ...item, nombre: cat.nombre, habitacion: cat.habitacionDefault, noches: cat.noches, personas: cat.personas, precio: cat.precio } : { ...item, nombre: String(val) };
      }
      return { ...item, [key]: typeof val === 'string' ? (isNaN(Number(val)) ? val : Number(val)) : val };
    }));
  }

  const [habitaciones, setHabitaciones] = useState<HabItem[]>(() => {
    if (booking?.habitaciones) {
      const suiteList = booking.habitaciones.split(', ').filter(Boolean).map(s => s.trim());
      // Distribuye el total real de huéspedes entre las habitaciones (las reservas no
      // guardan el reparto por cuarto). Así el total no cambia al editar.
      const total = booking.huespedes || suiteList.length * 2;
      const base = Math.floor(total / suiteList.length);
      const remainder = total % suiteList.length;
      return suiteList.map((s, i) => ({ suite: s, huespedes: Math.max(1, base + (i < remainder ? 1 : 0)) }));
    }
    return [{ suite: defaultSuite, huespedes: 2 }];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availStatus, setAvailStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'error'>('idle');
  // Walk-in: registrar la llegada en el mismo paso que se crea la reserva.
  const [llegoYa, setLlegoYa] = useState(walkin);
  // "Meter la reserva encima de otra, a sabiendas." Existe porque a veces el
  // hotel SÍ quiere hacerlo (un huésped que comparte cuarto, un cambio de última
  // hora), pero antes se podía hacer sin querer y sin dejar rastro: la reserva a
  // mano no pasaba por el candado. Ahora hay que pedirlo, y queda escrito en las
  // notas de la reserva quién y cuándo.
  const [forzar, setForzar] = useState(false);
  // Bug fix: start with totalOverride=true when editing to preserve stored total
  const [totalOverride, setTotalOverride] = useState(isEdit);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // CRM autocomplete
  const [crmClients, setCrmClients] = useState<CRMClient[]>([]);
  const [activeSuggestField, setActiveSuggestField] = useState<'cliente' | 'email' | 'telefono' | null>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Anticipo / Restante
  const [anticipo, setAnticipo] = useState(booking?.anticipo || 0);
  const [restanteOverride, setRestanteOverride] = useState<number | null>(null);

  // ── Modo: ficha o formulario ───────────────────────────────────────────────
  // Un alta arranca escribiendo; abrir una reserva arranca LEYENDO. Antes abrir
  // era editar, y con el huésped delante un roce en una fecha dispara el PATCH,
  // que revalida disponibilidad y le manda un correo de "tu reserva cambió" a
  // quien no cambió nada.
  const [editando, setEditando] = useState(!booking);

  // El registro que llenó el huésped en su pre check-in. Vivía sólo detrás del
  // icono del QR, en otra ventana; aquí entra donde recepción ya está mirando.
  const [registro, setRegistro] = useState<PreCheckinGuardado | null>(null);
  // Campos donde el huésped escribió algo DISTINTO. No se pisan: se avisan.
  const [difs, setDifs] = useState<Diferencia[]>([]);
  // Campos que estaban vacíos y rellenó el registro (para poner el ✓).
  const [rellenados, setRellenados] = useState<Set<string>>(new Set());

  // Load CRM clients once for autocomplete (new reservations only)
  useEffect(() => {
    if (isEdit) return;
    fetch('/api/admin/clientes')
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setCrmClients(data.map((c: any) => ({
        nombre: c.nombre || '',
        email: c.email || '',
        telefono: c.telefono || '',
        totalReservas: c.totalReservas || 0,
      }))))
      .catch((e) => console.error("[components/admin/ReservationModal] ignorado:", e));
  }, [isEdit]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setActiveSuggestField(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function getSuggestions(field: 'cliente' | 'email' | 'telefono') {
    const val = form[field].trim().toLowerCase();
    if (val.length < 2) return [];
    return crmClients.filter(c => {
      if (field === 'cliente') return c.nombre.toLowerCase().includes(val);
      if (field === 'email') return c.email.toLowerCase().includes(val);
      if (field === 'telefono') return c.telefono.includes(val);
      return false;
    }).slice(0, 5);
  }

  function applySuggestion(c: CRMClient) {
    setForm(f => ({ ...f, cliente: c.nombre, email: c.email, telefono: c.telefono }));
    setActiveSuggestField(null);
  }

  function set(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }));
    setAvailStatus('idle');
  }

  function addHab() { setHabitaciones(h => [...h, { suite: defaultSuite, huespedes: 2 }]); }
  function removeHab(i: number) { setHabitaciones(h => h.filter((_, idx) => idx !== i)); setTotalOverride(false); }

  function updateHab(i: number, key: 'suite' | 'huespedes', val: string | number) {
    setHabitaciones(h => h.map((item, idx) =>
      idx === i ? { ...item, [key]: val, precioOverride: undefined } : item
    ));
    setTotalOverride(false);
    setAvailStatus('idle');
  }

  function updateHabPrecio(i: number, precio: number) {
    setHabitaciones(h => h.map((item, idx) =>
      idx === i ? { ...item, precioOverride: precio } : item
    ));
    setTotalOverride(false);
  }

  const totalHuespedes = habitaciones.reduce((sum, h) => sum + h.huespedes, 0);
  const habsCalculado = habitaciones.reduce(
    (sum, h) => sum + getHabTotal(rooms, h, form.checkin, form.checkout, form.noches, nightOpts),
    0,
  );
  const toursCalculado = tourItems.reduce((s, t) => s + t.precio * t.personas, 0);
  const paquetesCalculado = paqueteItems.reduce((s, p) => s + p.precio, 0);
  const precioCalculado = habsCalculado + toursCalculado + paquetesCalculado;
  const restante = restanteOverride ?? (form.total - anticipo);

  // Auto-calcular noches y precio (only when NOT editing)
  useEffect(() => {
    const { checkin, checkout } = form;
    if (checkin && checkout) {
      const n = Math.max(0, Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000));
      const precioAuto = habitaciones.reduce(
        (sum, h) => sum + getHabTotal(rooms, h, checkin, checkout, n, nightOpts),
        0,
      );
      setForm(f => ({
        ...f,
        noches: n,
        total: totalOverride ? f.total : precioAuto,
      }));
    }
  }, [form.checkin, form.checkout, habitaciones, totalOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!totalOverride) setRestanteOverride(null);
  }, [form.total, totalOverride]);

  useEffect(() => {
    const { checkin, checkout } = form;
    if (!checkin || !checkout || isEdit) return;
    const n = Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000);
    if (n <= 0) return;
    setAvailStatus('checking');
    const timer = setTimeout(async () => {
      try {
        // Este indicador era fail-OPEN y de la peor manera: un 500 llegaba al
        // `data.unavailableRooms || []`, salía vacío, y la ventana pintaba
        // "Disponible en esas fechas" en verde. Recepción confirmaba encima de
        // una noche vendida. Ahora un error se ve como error y NUNCA como verde.
        const data = await postJson<{ unavailableRooms?: string[] }>(
          '/api/admin/check-availability',
          { checkin, checkout, rooms: habitaciones.map(h => h.suite) },
        );
        setAvailStatus((data.unavailableRooms || []).length > 0 ? 'unavailable' : 'available');
      } catch { setAvailStatus('error'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.checkin, form.checkout, habitaciones, isEdit]);

  // TODO loyalty: en Paraíso había un módulo de lealtad (/api/admin/loyalty +
  // badge de descuento). Kora aún no lo tiene → omitido.

  function handleCheckin(v: string) {
    set('checkin', v);
    if (form.checkout && v >= form.checkout) {
      const next = new Date(new Date(v).getTime() + 86400000).toISOString().split('T')[0];
      setForm(f => ({ ...f, checkin: v, checkout: next }));
    } else {
      setForm(f => ({ ...f, checkin: v }));
    }
  }

  // Trae el registro del huésped y decide qué se rellena y de qué se avisa.
  // La regla vive en lib/booking/importar-pre-checkin.ts, que es puro y probado:
  // hueco vacío → se rellena; distinto → se avisa y NO se pisa; igual → nada.
  useEffect(() => {
    // Se limpia SIEMPRE lo del huésped anterior, antes de nada. Al pasar de una
    // reserva a otra sin cerrar el modal, React reutiliza esta misma instancia:
    // sin este reset, la reserva nueva se pintaba con el registro de la vieja
    // —el teléfono y el correo de OTRO huésped—. Se vio en el navegador.
    setRegistro(null);
    setDifs([]);
    setRellenados(new Set());
    if (!booking?.confirmacion) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pre-checkin?folio=${encodeURIComponent(booking.confirmacion)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (!vivo || !d.registro) return;
        const reg = d.registro as PreCheckinGuardado;
        setRegistro(reg);
        setForm(f => {
          const { rellenos, diferencias } = importarDelHuesped(
            { cliente: f.cliente, telefono: f.telefono, email: f.email },
            { nombreCompleto: reg.nombreCompleto, telefono: reg.telefono, email: reg.email },
          );
          setDifs(diferencias);
          setRellenados(new Set(Object.keys(rellenos)));
          return { ...f, ...rellenos };
        });
      } catch (e) {
        // No se traga: sin el registro el formulario funciona igual, pero un
        // catch mudo es exactamente cómo se pierde un error de verdad.
        console.error('[ReservationModal] no se pudo leer el registro del huésped:', e);
      }
    })();
    return () => { vivo = false; };
  }, [booking?.confirmacion]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && availStatus === 'unavailable' && !forzar) {
      setError('Una o más habitaciones no están disponibles en esas fechas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const habitacion = habitaciones.map(h => h.suite).join(', ');
      // Se CONSERVAN las habitaciones que ya venían en las notas: este modal no
      // las edita, y escribirlas fuera las borraría en cada guardado.
      const notas = construirNotas({
        cliente: notasCliente,
        interno: notasInternas,
        tours: tourItems,
        paquetes: paqueteItems,
        habitaciones: notasLeidas.habitaciones,
      });
      const url = isEdit ? `/api/admin/reservas/${booking!.confirmacion}` : '/api/admin/reservas';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, habitacion, huespedes: totalHuespedes, anticipo, notas,
          ...(!isEdit && forzar ? { forzar: true } : {}),
          ...(!isEdit && llegoYa ? { llegoYa: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      onSaved(); // refresh parent

      if (!isEdit && data.confirmacion) {
        // Show success panel instead of closing
        setSuccessData({
          confirmacion: data.confirmacion,
          cliente: form.cliente,
          email: form.email,
          telefono: form.telefono,
          habitaciones: habitacion,
          checkin: form.checkin,
          checkout: form.checkout,
          noches: form.noches,
          huespedes: totalHuespedes,
          total: form.total,
          anticipo,
          notas,
          fecha: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        });
      } else {
        onClose();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!booking || !confirm(`¿Cancelar la reserva ${booking.confirmacion}? Se liberarán las fechas.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reservas/${booking.confirmacion}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al cancelar');
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Show success panel
  if (successData) {
    return (
      <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={styles.modal}>
          <SuccessPanel
            data={successData}
            onEdit={() => setSuccessData(null)} // go back to form (will show as new, just informational)
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  /** Acepta el valor del huésped para un campo y quita su aviso. */
  function usarDelHuesped(d: Diferencia) {
    set(d.campo, d.delHuesped);
    setDifs(prev => prev.filter(x => x.campo !== d.campo));
    setRellenados(prev => new Set(prev).add(d.campo));
  }

  /**
   * Descartar la edición: vuelve a la ficha y deja los campos como estaban.
   *
   * Restaurar importa: sin esto, «Cancelar» volvería a la ficha pero el
   * formulario conservaría lo tecleado, y al volver a pulsar «Editar»
   * reaparecerían unos cambios que el hotelero creía descartados.
   */
  function descartarEdicion() {
    if (!booking) return;
    setForm({
      cliente: booking.cliente || '',
      telefono: booking.telefono || '',
      email: booking.email || '',
      checkin: booking.checkin || '',
      checkout: booking.checkout || '',
      noches: booking.noches || 1,
      total: booking.total || 0,
    });
    const n = parseNotas(booking.notas || '');
    setNotasCliente(n.cliente);
    setNotasInternas(n.interno);
    setTourItems(n.tours);
    setPaqueteItems(n.paquetes);
    setAnticipo(booking.anticipo || 0);
    setRestanteOverride(null);
    setError('');
    setEditando(false);
  }

  /** Una línea del registro del huésped. No pinta la fila si no hay valor. */
  function DatoRegistro({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
    if (!valor || !valor.trim()) return null;
    return (
      <span className={styles.fichaFila}>
        <span className={styles.fichaEtiqueta}>{etiqueta}</span>
        <span className={styles.fichaValor}>{valor}</span>
      </span>
    );
  }

  /** El aviso/marca que va debajo de un campo del huésped. */
  function MarcaRegistro({ campo }: { campo: 'cliente' | 'telefono' | 'email' }) {
    const d = difs.find(x => x.campo === campo);
    if (d) {
      return (
        <span className={styles.difAviso}>
          El huésped puso «{d.delHuesped}»
          <button type="button" className={styles.difUsar} onClick={() => usarDelHuesped(d)}>
            usar este
          </button>
        </span>
      );
    }
    if (rellenados.has(campo)) return <span className={styles.delRegistro}>✓ del registro</span>;
    return null;
  }

  // ── Autocomplete helper ──────────────────────────────────────────────────────
  function AutoSuggest({ field }: { field: 'cliente' | 'email' | 'telefono' }) {
    const suggestions = getSuggestions(field);
    if (activeSuggestField !== field || suggestions.length === 0) return null;
    return (
      <div ref={suggestRef} className={styles.suggestDropdown}>
        {suggestions.map(c => (
          <div key={c.email} className={styles.suggestItem} onMouseDown={() => applySuggestion(c)}>
            <span className={styles.suggestName}>{c.nombre}</span>
            <span className={styles.suggestMeta}>{c.email} · {c.telefono} · {c.totalReservas} estancia{c.totalReservas !== 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>
    );
  }

  // FICHA. El `<form>` no se monta siquiera: el modal manda `{...form}` entero
  // en cada envío, y un PATCH con fechas dispara la revalidación de
  // disponibilidad y un correo al huésped. Esconder el botón no bastaría.
  if (booking && !editando) {
    return (
      <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
        <div className={styles.modal}>
          <FichaReserva
            booking={booking}
            registro={registro}
            verDinero
            puedeEditar
            onEditar={() => setEditando(true)}
            onCancelarReserva={handleCancel}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? 'Editar reserva' : 'Nueva reserva'}</h2>
          {isEdit && <span className={styles.confirmNum}>{booking.confirmacion}</span>}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formCuerpo}>
          {/* ── Huésped ── */}
          <section className={styles.seccion}>
          <h3 className={styles.seccionTitulo}>Huésped</h3>
          <div className={styles.grid2}>
            {/* Cliente con autocomplete */}
            <div className={styles.campoConAviso}>
            <label className={styles.field} style={{ position: 'relative' }}>
              <span>Cliente *</span>
              <input
                value={form.cliente}
                onChange={e => { set('cliente', e.target.value); setActiveSuggestField('cliente'); }}
                onFocus={() => setActiveSuggestField('cliente')}
                required
                autoComplete="off"
              />
              <AutoSuggest field="cliente" />
            </label>
            <MarcaRegistro campo="cliente" />
            </div>

            {/* Teléfono con autocomplete */}
            <div className={styles.campoConAviso}>
            <label className={styles.field} style={{ position: 'relative' }}>
              <span>Teléfono / WhatsApp</span>
              <input
                value={form.telefono}
                onChange={e => { set('telefono', e.target.value); setActiveSuggestField('telefono'); }}
                onFocus={() => setActiveSuggestField('telefono')}
                autoComplete="off"
              />
              <AutoSuggest field="telefono" />
            </label>
            <MarcaRegistro campo="telefono" />
            </div>

            {/* Email con autocomplete */}
            <div className={styles.campoConAviso}>
            <label className={styles.field} style={{ position: 'relative' }}>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={e => { set('email', e.target.value); setActiveSuggestField('email'); }}
                onFocus={() => setActiveSuggestField('email')}
                autoComplete="off"
              />
              <AutoSuggest field="email" />
            </label>
            <MarcaRegistro campo="email" />
            </div>

          </div>
          {/* Lo que el huésped puso y no tiene campo en la reserva. Sólo lectura:
              domicilio, identificación, placas y acompañantes no son campos de
              `bookings`, y copiarlos a las notas los dejaría desincronizados en
              cuanto el huésped rehaga su registro. */}
          {registro && (
            <div className={styles.registroBloque}>
              <DatoRegistro etiqueta="Domicilio" valor={registro.domicilio} />
              <DatoRegistro etiqueta="Procedencia" valor={[registro.ciudadOrigen, registro.pais].filter(Boolean).join(', ')} />
              <DatoRegistro etiqueta="Identificación" valor={[registro.documentoTipo, registro.documentoRef && `····${registro.documentoRef}`].filter(Boolean).join(' ')} />
              <DatoRegistro etiqueta="Llega a las" valor={registro.horaEstimada} />
              <DatoRegistro etiqueta="Placas" valor={registro.placas} />
              <DatoRegistro etiqueta="Acompañantes" valor={(registro.acompanantes ?? []).map(a => a.nombre).filter(Boolean).join(', ')} />
            </div>
          )}
          </section>

          {/* ── Estancia ── */}
          <section className={styles.seccion}>
          <h3 className={styles.seccionTitulo}>Estancia</h3>
          <div className={styles.grid2}>
            <label className={styles.field}>
              <span>Entrada *</span>
              <input type="date" value={form.checkin} onChange={e => handleCheckin(e.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>Salida *</span>
              <input type="date" value={form.checkout}
                min={form.checkin || undefined}
                onChange={e => set('checkout', e.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>Noches</span>
              <input type="number" min={1} value={form.noches} readOnly className={styles.campoCalculado} />
            </label>
          </div>
          {/* Disponibilidad */}
          {!isEdit && form.checkin && form.checkout && (
            <div className={`${styles.availBadge} ${
              availStatus === 'available' ? styles.availOk :
              availStatus === 'unavailable' || availStatus === 'error' ? styles.availNo :
              availStatus === 'checking' ? styles.availChecking : ''
            }`}>
              {availStatus === 'checking' && <><Loader2 size={13} className={styles.spin} /> Verificando disponibilidad…</>}
              {availStatus === 'available' && <><CheckCircle size={13} /> Disponible en esas fechas</>}
              {availStatus === 'unavailable' && <><AlertTriangle size={13} /> No disponible en esas fechas</>}
              {availStatus === 'error' && <><AlertTriangle size={13} /> No se pudo verificar la disponibilidad</>}
            </div>
          )}

          {/* WALK-IN. Sólo tiene sentido si la reserva empieza HOY: marcar "ya
              está aquí" en una reserva de la semana que viene ocuparía el cuarto
              desde ahora. Por eso la casilla aparece únicamente ese día. */}
          {!isEdit && form.checkin === hoyHotel() && (
            <label className={styles.llegoYa}>
              <input type="checkbox" checked={llegoYa} onChange={e => setLlegoYa(e.target.checked)} />
              <span>
                <strong>El huésped ya está aquí.</strong> Registra su llegada al guardar,
                así el cuarto aparece ocupado de inmediato y no hay que buscarlo en la lista.
              </span>
            </label>
          )}

          {/* La salida de emergencia. Sólo aparece cuando de verdad hay choque:
              ofrecerla siempre invita a usarla por costumbre. */}
          {!isEdit && availStatus === 'unavailable' && (
            <label className={styles.forzar}>
              <input type="checkbox" checked={forzar} onChange={e => setForzar(e.target.checked)} />
              <span>
                <strong>Guardar de todos modos</strong>, encima de la reserva que ya existe.
                Quedará anotado en la reserva que se forzó, con la fecha y quién lo hizo.
              </span>
            </label>
          )}
          </section>

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
                <select className={styles.roomRowSelect} value={hab.suite}
                  onChange={e => updateHab(i, 'suite', e.target.value)}>
                  {SUITES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={hab.huespedes}
                  onChange={e => updateHab(i, 'huespedes', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input
                  type="number" min={0}
                  className={styles.roomPriceInput}
                  value={getHabPrecio(rooms, hab, form.checkin, form.checkout, form.noches, nightOpts)}
                  onChange={e => updateHabPrecio(i, parseInt(e.target.value) || 0)}
                  title="Precio por noche"
                />
                {habitaciones.length > 1 && (
                  <button type="button" className={styles.removeRoomBtn} onClick={() => removeHab(i)}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            <p className={styles.roomsTotal}>{totalHuespedes} huésped{totalHuespedes !== 1 ? 'es' : ''} en total</p>
          </div>

          {/* ── Extras ──
              Tours y paquetes bajo una sola cabecera: son lo mismo desde el
              mostrador —cosas que se añaden a la estancia— y tenerlos como dos
              bloques hermanos del mismo peso que «Habitaciones» hacía parecer
              que el formulario tenía seis secciones cuando tiene cuatro. */}
          {(tours.length > 0 || tourItems.length > 0 || paquetes.length > 0 || paqueteItems.length > 0) && (
          <section className={styles.seccion}>
          <h3 className={styles.seccionTitulo}>Extras</h3>
          {(tours.length > 0 || tourItems.length > 0) && (
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>Tours / Experiencias</span>
              <button type="button" className={styles.addRoomBtn} onClick={addTourM}>
                <Plus size={13} /> Agregar tour
              </button>
            </div>
            {tourItems.map((t, i) => (
              <div key={i} className={styles.roomRow}>
                <select className={styles.roomRowSelect} style={{ flex: 2 }} value={t.nombre}
                  onChange={e => updateTourM(i, 'nombre', e.target.value)}>
                  {tours.map(c => <option key={c.nombre}>{c.nombre}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={t.personas}
                  onChange={e => updateTourM(i, 'personas', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input type="number" min={0} className={styles.roomPriceInput}
                  value={t.precio} title="Precio por persona"
                  onChange={e => updateTourM(i, 'precio', parseInt(e.target.value) || 0)} />
                <button type="button" className={styles.removeRoomBtn} onClick={() => removeTourM(i)}>
                  <X size={13} />
                </button>
              </div>
            ))}
            {tourItems.length > 0 && (
              <p className={styles.roomsTotal}>Tours: ${toursCalculado.toLocaleString('es-MX')} MXN</p>
            )}
          </div>
          )}

          {/* Paquetes (oculto si el hotel no tiene catálogo y la reserva no trae paquetes) */}
          {(paquetes.length > 0 || paqueteItems.length > 0) && (
          <div className={styles.roomsSection}>
            <div className={styles.roomsSectionHeader}>
              <span className={styles.roomsSectionLabel}>Paquetes todo incluido</span>
              <button type="button" className={styles.addRoomBtn} onClick={addPaqueteM}>
                <Plus size={13} /> Agregar paquete
              </button>
            </div>
            {paqueteItems.map((p, i) => (
              <div key={i} className={styles.roomRow} style={{ flexWrap: 'wrap', gap: 6 }}>
                <select className={styles.roomRowSelect} style={{ flex: '2 1 140px' }} value={p.nombre}
                  onChange={e => updatePaqueteM(i, 'nombre', e.target.value)}>
                  {paquetes.map(c => <option key={c.nombre}>{c.nombre}</option>)}
                </select>
                <select className={styles.roomRowSelect} style={{ flex: '2 1 120px' }} value={p.habitacion}
                  onChange={e => updatePaqueteM(i, 'habitacion', e.target.value)}>
                  {SUITES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className={styles.roomRowSelect} value={p.noches}
                  onChange={e => updatePaqueteM(i, 'noches', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}n</option>)}
                </select>
                <select className={styles.roomRowSelect} value={p.personas}
                  onChange={e => updatePaqueteM(i, 'personas', parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}p</option>)}
                </select>
                <input type="number" min={0} className={styles.roomPriceInput}
                  value={p.precio} title="Precio total del paquete"
                  onChange={e => updatePaqueteM(i, 'precio', parseInt(e.target.value) || 0)} />
                <button type="button" className={styles.removeRoomBtn} onClick={() => removePaqueteM(i)}><X size={13} /></button>
              </div>
            ))}
            {paqueteItems.length > 0 && (
              <p className={styles.roomsTotal}>Paquetes: ${paquetesCalculado.toLocaleString('es-MX')} MXN</p>
            )}
          </div>
          )}

          </section>
          )}

          {/* ── Cobro ──
              Antes eran DOS losas grises seguidas —«precio» y «anticipo y
              saldo»— sin título ninguna, y el hotelero veía dos cajas iguales
              sin saber cuál mandaba. Ahora es un solo bloque con el desglose
              arriba, una línea que lo separa, y el total y el saldo debajo. */}
          <section className={styles.seccion}>
          <h3 className={styles.seccionTitulo}>Cobro</h3>
          <div className={styles.priceCalc}>
            {habitaciones.map((hab, i) => {
              const pn = getHabPrecio(rooms, hab, form.checkin, form.checkout, form.noches, nightOpts);
              const n = Math.max(form.noches, 1);
              return (
                <div key={`h${i}`} className={styles.priceCalcRow}>
                  <span>{hab.suite} · ${pn.toLocaleString('es-MX')} × {n} noche{n !== 1 ? 's' : ''}</span>
                  <span>${(pn * n).toLocaleString('es-MX')}</span>
                </div>
              );
            })}
            {/* Cada tour y cada paquete, su propia línea. Antes se sumaban en un
                total agregado y el hotelero no podía cuadrar de dónde salía. */}
            {tourItems.map((t, i) => (
              <div key={`t${i}`} className={styles.priceCalcRow}>
                <span>{t.nombre} · {t.personas}p</span>
                <span>${(t.precio * t.personas).toLocaleString('es-MX')}</span>
              </div>
            ))}
            {paqueteItems.map((pq, i) => (
              <div key={`p${i}`} className={styles.priceCalcRow}>
                <span>{pq.nombre}</span>
                <span>${(pq.precio || 0).toLocaleString('es-MX')}</span>
              </div>
            ))}

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total a cobrar</span>
              <span className={styles.totalEditRow}>
                {form.total !== precioCalculado && (
                  <button type="button" className={styles.resetPrice}
                    onClick={() => { setTotalOverride(false); set('total', precioCalculado); }}>
                    ↩ Usar calculado
                  </button>
                )}
                <input
                  type="number" min={0} value={form.total}
                  className={styles.totalInput}
                  aria-label="Total a cobrar en pesos"
                  onChange={e => { setTotalOverride(true); set('total', parseInt(e.target.value) || 0); }}
                  required
                />
              </span>
            </div>

            <div className={styles.anticipoGrid}>
              <label className={styles.field}>
                <span>Anticipo recibido</span>
                <input
                  type="number" min={0} value={anticipo}
                  onChange={e => { setAnticipo(parseInt(e.target.value) || 0); setRestanteOverride(null); }}
                />
              </label>
              <label className={styles.field}>
                <span>Saldo por pagar</span>
                <input
                  type="number" min={0} value={restante}
                  onChange={e => setRestanteOverride(parseInt(e.target.value) || 0)}
                />
              </label>
            </div>
            {restanteOverride !== null && (
              <button type="button" className={styles.anticipoReset}
                onClick={() => setRestanteOverride(null)}>
                ↩ Recalcular saldo
              </button>
            )}
          </div>
          </section>

          {/* Notas */}
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

          </div>

          <div className={styles.actions}>
            {isEdit && (
              <button type="button" className={styles.dangerBtn} onClick={handleCancel} disabled={loading}>
                Cancelar reserva
              </button>
            )}
            {/* Editando una reserva, «Cancelar» vuelve a la ficha SIN guardar y
                deshaciendo lo tecleado. En un alta cierra, que es lo que había. */}
            <button type="button" className={styles.secondaryBtn}
              onClick={isEdit ? descartarEdicion : onClose}>
              {isEdit ? 'Cancelar' : 'Cerrar'}
            </button>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={loading || (!isEdit && availStatus === 'unavailable')}
            >
              {loading ? <Loader2 size={16} className={styles.spin} /> : null}
              {isEdit ? 'Guardar cambios' : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
