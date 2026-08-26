'use client';

// Cliente de Canales OTA. Portado de mi-hotel/app/admin/(dashboard)/canales/
// CanalesClient.tsx. Cambios mínimos para multi-tenant:
//  - los cuartos llegan por prop `rooms` (antes lista fija ROOM_SLUG_MAP).
//  - el estado inicial se siembra con `initial` (SSR), pero igual se recarga.
//  - la URL de exportación es /api/h/<slug>/ical/<roomName-encoded>.
// Los fetch a /api/admin/canales y /api/cron/ical-sync quedan TAL CUAL.

import { useState, useEffect, useCallback } from 'react';
import styles from './canales.module.css';
import { postJson, getJson, mensajeDeError } from '@/lib/ui/api';

type Platform = 'booking_com' | 'expedia';
const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'expedia',     label: 'Expedia' },
];

interface OTACalendar {
  id: string;
  roomName: string;
  platform: Platform;
  icalUrl: string;
  active: boolean;
  lastSync: string;
  status: 'ok' | 'error' | 'pending';
  blocksFound: number;
}

interface ModalState {
  roomName: string;
  platform: Platform;
  icalUrl: string;
  id?: string;
}

interface Props {
  initial: OTACalendar[];
  rooms: string[];
  slug: string;
}

export default function CanalesClient({ initial, rooms, slug }: Props) {
  const ALL_ROOMS = rooms;
  const [calendars, setCalendars] = useState<OTACalendar[]>(initial);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // Antes no se miraba `res.ok`: un 500 devolvía un cuerpo sin forma de
      // arreglo y la lista se vaciaba, así que el hotelero veía "no tienes
      // ningún canal conectado" cuando sí los tenía.
      const data = await getJson<OTACalendar[]>('/api/admin/canales');
      setCalendars(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // No recargamos en el primer render (ya tenemos `initial` por SSR).
  useEffect(() => { /* initial viene del server */ }, []);

  async function handleSave() {
    if (!modal) return;
    setSaving(true);
    setError('');
    try {
      await postJson('/api/admin/canales', modal);
      setModal(null);
      await reload();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta conexión?')) return;
    setError('');
    try {
      await postJson(`/api/admin/canales/${id}`, undefined, 'DELETE');
      await reload();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function handleToggle(cal: OTACalendar) {
    setError('');
    try {
      // Este es el peor de los tres: apagar o encender un canal decide si las
      // OTAs reciben la disponibilidad del hotel. Un fallo silencioso aquí deja
      // el interruptor visualmente en la posición contraria a la real.
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
      const res = await fetch('/api/admin/canales/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(`Sincronizados: ${data.synced} de ${data.total} calendarios`);
        await reload();
      } else {
        setSyncResult('Error al sincronizar. Intenta de nuevo.');
      }
    } catch {
      setSyncResult('Error de red al sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  function openEdit(cal: OTACalendar) {
    setModal({ id: cal.id, roomName: cal.roomName, platform: cal.platform, icalUrl: cal.icalUrl });
  }

  function calForRoom(roomName: string, platform: Platform) {
    return calendars.find(c => c.roomName === roomName && c.platform === platform);
  }

  function statusBadge(cal: OTACalendar | undefined) {
    if (!cal) return null;
    const colors: Record<string, string> = {
      ok: '#16a34a', error: '#dc2626', pending: '#9ca3af',
    };
    const labels: Record<string, string> = {
      ok: 'OK', error: 'Error', pending: 'Pendiente',
    };
    return (
      <span style={{
        display: 'inline-block',
        background: colors[cal.status] + '22',
        color: colors[cal.status],
        borderRadius: 4,
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 600,
      }}>
        {labels[cal.status]}
        {cal.status === 'ok' && cal.blocksFound > 0 && ` · ${cal.blocksFound} bloques`}
      </span>
    );
  }

  function exportUrl(roomName: string) {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/api/h/${slug}/ical/${encodeURIComponent(roomName)}`;
  }

  function exportPath(roomName: string) {
    return `/api/h/${slug}/ical/${encodeURIComponent(roomName)}`;
  }

  return (
    <div className={styles.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Canales OTA</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Sincronización iCal con Booking.com y Expedia cada 15 minutos
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {syncResult && <span style={{ color: '#6b7280', fontSize: 13 }}>{syncResult}</span>}
          {error && <span role="alert" style={{ color: '#b42318', fontSize: 13 }}>{error}</span>}
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            style={{
              background: '#1d4ed8', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
              opacity: syncing ? 0.6 : 1,
            }}
          >
            {syncing ? 'Sincronizando…' : 'Sync ahora'}
          </button>
        </div>
      </div>

      {ALL_ROOMS.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>
          Este hotel todavía no tiene habitaciones configuradas. Agrégalas en tu sitio para poder
          conectar Booking.com y Expedia.
        </p>
      ) : loading ? (
        <p style={{ color: '#9ca3af' }}>Cargando…</p>
      ) : (
        <div className={styles.tableScroll}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#374151', fontWeight: 600 }}>Habitación</th>
              {PLATFORMS.map(p => (
                <th key={p.value} style={{ textAlign: 'left', padding: '8px 12px', color: '#374151', fontWeight: 600 }}>
                  {p.label}
                </th>
              ))}
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#374151', fontWeight: 600 }}>URL Exportación</th>
            </tr>
          </thead>
          <tbody>
            {ALL_ROOMS.map((roomName, i) => (
              <tr key={roomName} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{roomName}</td>

                {PLATFORMS.map(p => {
                  const cal = calForRoom(roomName, p.value);
                  return (
                    <td key={p.value} style={{ padding: '10px 12px' }}>
                      {cal ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {statusBadge(cal)}
                            <button
                              onClick={() => handleToggle(cal)}
                              style={{
                                background: 'none', border: '1px solid #d1d5db',
                                borderRadius: 4, padding: '1px 8px', cursor: 'pointer',
                                fontSize: 11, color: cal.active ? '#374151' : '#9ca3af',
                              }}
                            >
                              {cal.active ? 'Activo' : 'Pausado'}
                            </button>
                            <button
                              onClick={() => openEdit(cal)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(cal.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}
                            >
                              ✕
                            </button>
                          </div>
                          {cal.lastSync && (
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>
                              Última sync: {new Date(cal.lastSync).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setModal({ roomName, platform: p.value, icalUrl: '' })}
                          style={{
                            background: 'none', border: '1px dashed #d1d5db',
                            borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
                            fontSize: 12, color: '#9ca3af',
                          }}
                        >
                          + Agregar URL
                        </button>
                      )}
                    </td>
                  );
                })}

                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', cursor: 'pointer' }}
                    onClick={() => navigator.clipboard.writeText(exportUrl(roomName))}
                    title="Clic para copiar"
                  >
                    {exportPath(roomName)} 📋
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28,
            width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>
              {modal.id ? 'Editar' : 'Agregar'} conexión iCal
            </h2>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>Habitación</label>
              <select
                value={modal.roomName}
                onChange={e => setModal(m => m ? { ...m, roomName: e.target.value } : null)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              >
                {ALL_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>Plataforma</label>
              <select
                value={modal.platform}
                onChange={e => setModal(m => m ? { ...m, platform: e.target.value as Platform } : null)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
              >
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
                URL iCal de la OTA
              </label>
              <input
                type="url"
                placeholder="https://ical.booking.com/v1/export?t=..."
                value={modal.icalUrl}
                onChange={e => setModal(m => m ? { ...m, icalUrl: e.target.value } : null)}
                style={{
                  width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
                  borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                Esta URL la encuentras en el Extranet/Portal de la OTA → Calendario → Exportar iCal
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModal(null)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !modal.icalUrl}
                style={{
                  background: '#1d4ed8', color: '#fff', border: 'none',
                  borderRadius: 6, padding: '8px 20px', cursor: 'pointer',
                  opacity: saving || !modal.icalUrl ? 0.6 : 1,
                }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
