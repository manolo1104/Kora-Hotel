'use client';

import { useState } from 'react';
import { Receipt, FileText, Download, X, CheckCircle2, AlertTriangle, Loader2, FlaskConical } from 'lucide-react';
import styles from './facturacion.module.css';

interface Booking {
  id: string;
  fecha: string;
  confirmacion: string;
  cliente: string;
  email: string;
  total: number;
  checkin: string;
  checkout: string;
  noches: number;
  habitaciones: string;
}

interface Props {
  bookings: Booking[];
  facturama: { configured: boolean; sandbox: boolean };
}

// Catálogos SAT (los más usados en hotelería).
const USOS_CFDI = [
  { v: 'G03', l: 'G03 — Gastos en general' },
  { v: 'G01', l: 'G01 — Adquisición de mercancías' },
  { v: 'D01', l: 'D01 — Honorarios médicos / gastos' },
  { v: 'S01', l: 'S01 — Sin efectos fiscales' },
  { v: 'CP01', l: 'CP01 — Pagos' },
];
const REGIMENES = [
  { v: '601', l: '601 — General de Ley Personas Morales' },
  { v: '612', l: '612 — Personas Físicas con Actividades Empresariales' },
  { v: '626', l: '626 — Régimen Simplificado de Confianza (RESICO)' },
  { v: '605', l: '605 — Sueldos y Salarios' },
  { v: '621', l: '621 — Incorporación Fiscal' },
  { v: '616', l: '616 — Sin obligaciones fiscales' },
];
const FORMAS_PAGO = [
  { v: '03', l: '03 — Transferencia electrónica' },
  { v: '04', l: '04 — Tarjeta de crédito' },
  { v: '28', l: '28 — Tarjeta de débito' },
  { v: '01', l: '01 — Efectivo' },
];

interface CfdiOk { id: string; uuid: string; folio: string; serie: string; total: number; }

export default function FacturacionClient({ bookings, facturama }: Props) {
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);
  const [form, setForm] = useState({ rfc: '', name: '', regimen: '601', cp: '', uso: 'G03', formaPago: '03' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Resultados por reserva (id -> CFDI generado).
  const [results, setResults] = useState<Record<string, CfdiOk>>({});

  function openModal(b: Booking) {
    setOpenBooking(b);
    setError(null);
    setForm({ rfc: '', name: b.cliente?.toUpperCase() || '', regimen: '601', cp: '', uso: 'G03', formaPago: '03' });
  }

  function closeModal() {
    if (loading) return;
    setOpenBooking(null);
    setError(null);
  }

  async function generar() {
    if (!openBooking) return;
    setError(null);

    if (!form.rfc.trim()) { setError('Escribe el RFC del huésped (o empresa) a facturar.'); return; }
    if (!form.name.trim()) { setError('Escribe la razón social / nombre fiscal.'); return; }
    if (!form.cp.trim()) { setError('Escribe el código postal fiscal del receptor.'); return; }

    setLoading(true);
    try {
      const descripcion = `Servicio de hospedaje — ${openBooking.habitaciones || 'habitación'} — ${openBooking.noches} noche(s) (${openBooking.checkin} a ${openBooking.checkout})`;
      const res = await fetch('/api/admin/facturacion/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: openBooking.total,
          descripcion,
          confirmacion: openBooking.confirmacion,
          paymentForm: form.formaPago,
          receiver: {
            Rfc: form.rfc.trim().toUpperCase(),
            Name: form.name.trim().toUpperCase(),
            FiscalRegime: form.regimen,
            TaxZipCode: form.cp.trim(),
            CfdiUse: form.uso,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = typeof data?.detail === 'string' ? data.detail : (data?.error || 'No se pudo generar la factura.');
        throw new Error(detail);
      }
      setResults((prev) => ({ ...prev, [openBooking.id]: data }));
      setOpenBooking(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerIcon}><Receipt size={28} /></div>
        <div>
          <h1 className={styles.title}>Facturación / CFDI</h1>
          <p className={styles.subtitle}>Genera la factura (CFDI 4.0) de cada reserva</p>
        </div>
        {facturama.sandbox && (
          <span className={styles.statusChip}><FlaskConical size={12} /> Modo prueba (sandbox)</span>
        )}
      </div>

      {/* Estado de configuración */}
      {!facturama.configured && (
        <div className={styles.alert}>
          <AlertTriangle size={16} />
          <div>
            <strong>Aún no está conectado el timbrado.</strong> Faltan las credenciales del PAC.
            Una vez configuradas, podrás generar facturas desde aquí.
          </div>
        </div>
      )}
      {facturama.configured && facturama.sandbox && (
        <div className={styles.infoBanner}>
          <FlaskConical size={15} />
          <span>Estás en <strong>modo prueba</strong>. Las facturas generadas son de práctica (no tienen validez fiscal) hasta cambiar a producción con tu CSD real.</span>
        </div>
      )}

      {/* Tabla de reservas facturables */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reservas facturables</h2>
        {bookings.length === 0 ? (
          <p className={styles.subtitle}>No hay reservas con monto para facturar.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.hideMobile}>Confirmación</th>
                  <th>Cliente</th>
                  <th className={styles.hideMobile}>Habitación</th>
                  <th className={styles.hideMobile}>Estancia</th>
                  <th className={styles.right}>Total</th>
                  <th className={styles.right}>Factura</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const cfdi = results[b.id];
                  return (
                    <tr key={b.id}>
                      <td className={`${styles.mono} ${styles.hideMobile}`}>{b.confirmacion || '—'}</td>
                      <td>
                        {b.cliente || '—'}
                        <span className={styles.cellMeta}>{b.habitaciones} · {b.checkin}→{b.checkout}</span>
                      </td>
                      <td className={styles.hideMobile}>{b.habitaciones || '—'}</td>
                      <td className={`${styles.dim} ${styles.hideMobile}`}>{b.checkin} → {b.checkout}</td>
                      <td className={styles.right}>${b.total.toLocaleString('es-MX')}</td>
                      <td className={styles.right}>
                        {cfdi ? (
                          <div className={styles.cfdiDone}>
                            <span className={styles.cfdiUuid} title={cfdi.uuid}>
                              <CheckCircle2 size={13} /> {cfdi.serie}{cfdi.folio || ''} timbrada
                            </span>
                            <span className={styles.cfdiLinks}>
                              <a href={`/api/admin/facturacion/descargar?id=${cfdi.id}&formato=pdf`}><Download size={12} /> PDF</a>
                              <a href={`/api/admin/facturacion/descargar?id=${cfdi.id}&formato=xml`}><Download size={12} /> XML</a>
                            </span>
                          </div>
                        ) : (
                          <button
                            className={styles.generarBtn}
                            onClick={() => openModal(b)}
                            disabled={!facturama.configured}
                            title={facturama.configured ? 'Generar CFDI' : 'Configura el PAC primero'}
                          >
                            <FileText size={14} /> Generar CFDI
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal de datos fiscales */}
      {openBooking && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Datos fiscales para la factura</h3>
              <button className={styles.modalClose} onClick={closeModal} aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className={styles.modalSummary}>
              <span>{openBooking.cliente}</span>
              <span className={styles.dim}>{openBooking.habitaciones}</span>
              <strong>${openBooking.total.toLocaleString('es-MX')} <small>(IVA incluido)</small></strong>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>RFC del receptor</span>
                <input value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })} placeholder="XAXX010101000" maxLength={13} />
              </label>
              <label className={styles.field}>
                <span>Código postal fiscal</span>
                <input value={form.cp} onChange={(e) => setForm({ ...form, cp: e.target.value.replace(/\D/g, '') })} placeholder="78000" maxLength={5} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Razón social / Nombre fiscal</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="Como está registrado en el SAT" />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>Régimen fiscal</span>
                <select value={form.regimen} onChange={(e) => setForm({ ...form, regimen: e.target.value })}>
                  {REGIMENES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Uso del CFDI</span>
                <select value={form.uso} onChange={(e) => setForm({ ...form, uso: e.target.value })}>
                  {USOS_CFDI.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>Forma de pago</span>
                <select value={form.formaPago} onChange={(e) => setForm({ ...form, formaPago: e.target.value })}>
                  {FORMAS_PAGO.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </label>
            </div>

            {error && <div className={styles.formError}><AlertTriangle size={14} /> {error}</div>}

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={closeModal} disabled={loading}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={generar} disabled={loading}>
                {loading ? <><Loader2 size={15} className={styles.spin} /> Timbrando…</> : <>Generar CFDI</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
