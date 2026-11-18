'use client';

// Canales del panel: enlace por iCal con Airbnb, Booking.com, Expedia (Vrbo) y
// cualquier otro calendario.
//
// Una tarjeta por UNIDAD física ("Cabaña 2"), no por tipo: cada anuncio de una
// OTA es un cuarto concreto, y el feed de salida de Kora también lo es (K-22).
// En cada tarjeta, los dos sentidos del enlace:
//   · «Enlace de Kora» → se pega en la OTA para que cierre lo vendido en Kora.
//   · Calendarios enlazados → Kora los lee cada 15 min y bloquea esas noches.
// Los textos de «dónde está cada enlace» viven en lib/canales/plataformas.ts.

import { useState, useCallback, type CSSProperties } from 'react';
import styles from './canales.module.css';
import { postJson, getJson, mensajeDeError } from '@/lib/ui/api';
import {
  NOMBRE_PLATAFORMA,
  GUIA_PLATAFORMA,
  PLATAFORMAS_NUEVAS,
  type PlataformaIcal,
} from '@/lib/canales/plataformas';

interface OTACalendar {
  id: string;
  roomName: string;
  platform: PlataformaIcal;
  etiqueta?: string;
  icalUrl: string;
  active: boolean;
  lastSync: string;
  status: 'ok' | 'error' | 'pending';
  blocksFound: number;
}

interface ModalState {
  roomName: string;
  platform: PlataformaIcal;
  icalUrl: string;
  etiqueta?: string;
  id?: string;
}

interface Props {
  initial: OTACalendar[];
  rooms: string[];
  slug: string;
}

const COLOR_PLATAFORMA: Record<PlataformaIcal, string> = {
  airbnb: '#FF5A5F',
  booking_com: '#003580',
  vrbo: '#1E4DB7',
  expedia: '#1E4DB7',
  otro: '#6b7280',
};

const btn = {
  base: {
    border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
  } as CSSProperties,
};

export default function CanalesClient({ initial, rooms, slug }: Props) {
  const [calendars, setCalendars] = useState<OTACalendar[]>(initial);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Se mira `res.ok` (getJson lanza): un 500 no puede vaciar la lista y
      // hacerle creer al hotelero que no tiene ningún canal enlazado.
      const data = await getJson<OTACalendar[]>('/api/admin/canales');
      setCalendars(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSave() {
    if (!modal) return;
    setSaving(true);
    setError('');
    try {
      await postJson('/api/admin/canales', modal);
      setModal(null);
      await reload();
      // Primera lectura al momento: el hotelero ve enseguida si el enlace sirve.
      await handleSyncNow();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cal: OTACalendar) {
    if (!confirm(`¿Quitar el enlace con ${nombreDe(cal)} de ${cal.roomName}? Las noches que había bloqueado se liberan en Kora.`)) return;
    setError('');
    try {
      await postJson(`/api/admin/canales/${cal.id}`, undefined, 'DELETE');
      await reload();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function handleToggle(cal: OTACalendar) {
    setError('');
    try {
      // Pausar decide si Kora sigue leyendo esa OTA. Un fallo silencioso dejaría
      // el interruptor en la posición contraria a la real.
      await postJson('/api/admin/canales', { ...cal, active: !cal.active });
      await reload();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncResult('');
    try {
      const data = await postJson<{ synced: number; total: number; choques: number }>(
        '/api/admin/canales/sync',
        {},
      );
      const partes = [`Leídos ${data.synced} de ${data.total} calendarios`];
      if (data.choques > 0) partes.push(`⚠️ ${data.choques} posible(s) sobreventa(s): te mandamos un correo`);
      setSyncResult(partes.join(' · '));
      await reload();
    } catch (e) {
      setSyncResult(`No se pudo sincronizar: ${mensajeDeError(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  function nombreDe(cal: OTACalendar) {
    return cal.platform === 'otro' && cal.etiqueta ? cal.etiqueta : NOMBRE_PLATAFORMA[cal.platform];
  }

  function exportUrl(roomName: string) {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/api/h/${slug}/ical/${encodeURIComponent(roomName)}`;
  }

  async function copiar(roomName: string) {
    try {
      await navigator.clipboard.writeText(exportUrl(roomName));
      setCopiado(roomName);
      setTimeout(() => setCopiado(''), 2000);
    } catch {
      setError('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  }

  function estado(cal: OTACalendar) {
    const colores = { ok: '#16a34a', error: '#dc2626', pending: '#9ca3af' } as const;
    const textos = { ok: 'Enlazado', error: 'No se pudo leer', pending: 'Pendiente' } as const;
    return (
      <span style={{
        background: colores[cal.status] + '22', color: colores[cal.status],
        borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
      }}>
        {textos[cal.status]}
        {cal.status === 'ok' && ` · ${cal.blocksFound} reserva${cal.blocksFound === 1 ? '' : 's'}`}
      </span>
    );
  }

  const guia = modal ? GUIA_PLATAFORMA[modal.platform] : null;

  return (
    <div className={styles.wrap}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Canales</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--clay)', fontSize: 14 }}>
            Enlaza Airbnb, Booking.com y Expedia (Vrbo) por iCal. Kora lee sus calendarios cada 15 minutos.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {syncResult && <span style={{ color: 'var(--clay)', fontSize: 13 }}>{syncResult}</span>}
          {error && <span role="alert" style={{ color: 'var(--chip-mal-text)', fontSize: 13 }}>{error}</span>}
          <button
            onClick={handleSyncNow}
            disabled={syncing || calendars.length === 0}
            style={{ ...btn.base, background: '#1d4ed8', color: 'var(--cream)', opacity: syncing || calendars.length === 0 ? 0.6 : 1 }}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>
      </div>

      <div style={{
        background: 'var(--parch)', borderRadius: 10, padding: '12px 16px', fontSize: 13,
        color: 'var(--bark)', marginBottom: 20, lineHeight: 1.6,
      }}>
        <strong>Cómo funciona:</strong> cada habitación tiene su enlace de Kora (pégalo en la OTA para que
        cierre lo que vendes aquí) y puedes enlazarle el calendario de cada OTA (Kora bloquea lo que vendes allá).
        iCal mueve sólo <strong>fechas ocupadas</strong>: las tarifas se siguen poniendo en cada OTA, y cada OTA lee
        el enlace de Kora a su ritmo (de 30 min a 3 h). Si dos reservas chocan, te avisamos por correo.
      </div>

      {rooms.length === 0 ? (
        <p style={{ color: 'var(--clay)' }}>
          Este hotel todavía no tiene habitaciones configuradas. Agrégalas en tu sitio para poder enlazar tus OTAs.
        </p>
      ) : loading ? (
        <p style={{ color: 'var(--clay)' }}>Cargando…</p>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
          {rooms.map((roomName) => {
            const mios = calendars.filter((c) => c.roomName === roomName);
            return (
              <section key={roomName} style={{
                background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 16,
              }}>
                <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>{roomName}</h2>

                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--clay)', fontWeight: 600 }}>
                  Enlace de Kora (pégalo en tu OTA)
                </p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
                  <code style={{
                    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontSize: 11, background: 'var(--parch)', padding: '6px 8px', borderRadius: 6,
                  }}>
                    {`/api/h/${slug}/ical/${encodeURIComponent(roomName)}`}
                  </code>
                  <button
                    onClick={() => copiar(roomName)}
                    style={{ ...btn.base, padding: '5px 10px', fontSize: 12, background: 'var(--parch)', color: 'var(--bark)' }}
                  >
                    {copiado === roomName ? '¡Copiado!' : 'Copiar'}
                  </button>
                </div>

                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--clay)', fontWeight: 600 }}>
                  Calendarios enlazados
                </p>
                {mios.length === 0 && (
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--clay)' }}>Ninguno todavía.</p>
                )}
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                  {mios.map((cal) => (
                    <li key={cal.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: 99, background: COLOR_PLATAFORMA[cal.platform], flexShrink: 0,
                      }} aria-hidden="true" />
                      <strong style={{ fontWeight: 600 }}>{nombreDe(cal)}</strong>
                      {estado(cal)}
                      {!cal.active && <span style={{ fontSize: 11, color: '#9ca3af' }}>Pausado</span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                        <button onClick={() => handleToggle(cal)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--clay)' }}>
                          {cal.active ? 'Pausar' : 'Reanudar'}
                        </button>
                        <button
                          onClick={() => setModal({ id: cal.id, roomName: cal.roomName, platform: cal.platform, icalUrl: cal.icalUrl, etiqueta: cal.etiqueta })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--clay)' }}
                        >
                          Editar
                        </button>
                        <button onClick={() => handleDelete(cal)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--chip-mal-text)' }}>
                          Quitar
                        </button>
                      </span>
                      {cal.lastSync && (
                        <span style={{ width: '100%', paddingLeft: 14, fontSize: 11, color: 'var(--clay)' }}>
                          Última lectura: {new Date(cal.lastSync).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setModal({ roomName, platform: 'airbnb', icalUrl: '' })}
                  style={{
                    marginTop: 12, background: 'none', border: '1px dashed #d1d5db', borderRadius: 6,
                    padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--bark)', width: '100%',
                  }}
                >
                  + Enlazar Airbnb, Booking o Expedia
                </button>
              </section>
            );
          })}
        </div>
      )}

      {modal && guia && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enlazar calendario"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', padding: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div style={{
            background: 'var(--cream)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>
              {modal.id ? 'Editar enlace' : 'Enlazar calendario'} · {modal.roomName}
            </h2>

            <label style={{ fontSize: 13, color: 'var(--bark)', display: 'block', marginBottom: 4 }}>Habitación</label>
            <select
              value={modal.roomName}
              onChange={(e) => setModal((m) => (m ? { ...m, roomName: e.target.value } : null))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, marginBottom: 12 }}
            >
              {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            <label style={{ fontSize: 13, color: 'var(--bark)', display: 'block', marginBottom: 4 }}>Plataforma</label>
            <select
              value={modal.platform}
              onChange={(e) => setModal((m) => (m ? { ...m, platform: e.target.value as PlataformaIcal } : null))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, marginBottom: 12 }}
            >
              {(PLATAFORMAS_NUEVAS.includes(modal.platform) ? PLATAFORMAS_NUEVAS : [...PLATAFORMAS_NUEVAS, modal.platform]).map((p) => (
                <option key={p} value={p}>{NOMBRE_PLATAFORMA[p]}</option>
              ))}
            </select>

            {modal.platform === 'otro' && (
              <>
                <label style={{ fontSize: 13, color: 'var(--bark)', display: 'block', marginBottom: 4 }}>Nombre (opcional)</label>
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Google Calendar, Hostaway…"
                  value={modal.etiqueta ?? ''}
                  onChange={(e) => setModal((m) => (m ? { ...m, etiqueta: e.target.value } : null))}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
                />
              </>
            )}

            <ol style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13, color: 'var(--bark)', lineHeight: 1.6 }}>
              <li style={{ marginBottom: 6 }}>{guia.importar}</li>
              <li>
                {guia.exportar}{' '}
                <button
                  type="button"
                  onClick={() => copiar(modal.roomName)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1d4ed8', fontSize: 13, textDecoration: 'underline' }}
                >
                  {copiado === modal.roomName ? '¡Copiado!' : 'Copiar enlace de Kora'}
                </button>
              </li>
            </ol>
            {guia.ojo && (
              <p style={{
                margin: '0 0 12px', fontSize: 12, color: 'var(--bark)', background: '#fef3c7',
                borderRadius: 6, padding: '8px 10px', lineHeight: 1.5,
              }}>
                {guia.ojo}
              </p>
            )}

            <label style={{ fontSize: 13, color: 'var(--bark)', display: 'block', marginBottom: 4 }}>
              Enlace iCal de {NOMBRE_PLATAFORMA[modal.platform]}
            </label>
            <input
              type="url"
              inputMode="url"
              placeholder="https://…/calendar.ics"
              value={modal.icalUrl}
              onChange={(e) => setModal((m) => (m ? { ...m, icalUrl: e.target.value } : null))}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginBottom: 20 }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ ...btn.base, background: 'var(--parch)' }}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !modal.icalUrl.trim()}
                style={{ ...btn.base, background: '#1d4ed8', color: 'var(--cream)', opacity: saving || !modal.icalUrl.trim() ? 0.6 : 1 }}
              >
                {saving ? 'Guardando…' : 'Guardar y leer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
