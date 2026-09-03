'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, AlertTriangle, Sparkles, BedDouble, CheckCircle, LogOut, LogIn, UserPlus, Loader2 } from 'lucide-react';
import { postJson, mensajeDeError } from '@/lib/ui/api';
import { ZONA_HOTEL } from '@/lib/fecha-hotel';
import { notaAlCambiarEstado } from '@/lib/booking/nota-cuarto';
import styles from './RoomMap.module.css';

export type RoomStatusType = 'DISPONIBLE' | 'OCUPADA' | 'MANTENIMIENTO' | 'LIMPIEZA';

interface RoomData {
  suite: string;
  estado: RoomStatusType;
  notas: string;
  actualizacion: string;
  ocupadaPor: {
    cliente: string; checkout: string; huespedes: number; confirmacion: string;
    /** ¿Recepción ya registró su llegada? `false` = el calendario dice que entra hoy, pero no está. */
    llegoYa: boolean;
  } | null;
}

// Cada estado apunta a un PAR de variables de tema, no a dos hex sueltos.
//
// POR QUÉ: estos colores eran `#4ade80`, `#facc15`, `#f87171` y `#60a5fa` —los
// tonos 400 de Tailwind, pensados para una superficie OSCURA, herencia del panel
// de Paraíso—. En el panel claro de Kora quedaban lavados, y el texto de las
// tarjetas (blanco crema) desaparecía sobre ellos. Es el mismo fallo que ya
// había reportado un hotelero: "las letras son blancas y uno no sabe qué está
// haciendo". Los pares de chips ya existen y ya voltean solos en tema oscuro
// (ver admin.module.css), así que el mapa los reutiliza en vez de inventarse
// su propia paleta.
const STATUS_CONFIG: Record<RoomStatusType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DISPONIBLE:   { label: 'Disponible',         color: 'var(--chip-ok-text)',     bg: 'var(--chip-ok-bg)',     icon: <CheckCircle size={14} /> },
  OCUPADA:      { label: 'Ocupada',            color: 'var(--chip-aviso-text)',  bg: 'var(--chip-aviso-bg)',  icon: <BedDouble size={14} /> },
  MANTENIMIENTO:{ label: 'Mantenimiento',      color: 'var(--chip-mal-text)',    bg: 'var(--chip-mal-bg)',    icon: <AlertTriangle size={14} /> },
  LIMPIEZA:     { label: 'Limpieza pendiente', color: 'var(--chip-info-text)',   bg: 'var(--chip-info-bg)',   icon: <Sparkles size={14} /> },
};

/**
 * La marca de tiempo de Postgres, en cristiano y en hora del hotel.
 *
 * Se pintaba cruda: «Actualizado: 2026-09-01T16:12:08.71+00:00». Además de
 * ilegible, es UTC — la camarista leía una hora que no es la suya. Si llegara
 * algo que no se puede interpretar se devuelve tal cual: es un dato informativo
 * y no vale la pena romper la tarjeta por él.
 */
function fechaLegible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    timeZone: ZONA_HOTEL,
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface EditModal {
  room: RoomData;
  estado: RoomStatusType;
  notas: string;
}

interface Props {
  slug: string;
  /** ¿Puede dar de alta una reserva? Sin esto, el botón de walk-in no se pinta. */
  puedeReservar: boolean;
}

export default function RoomMap({ slug, puedeReservar }: Props) {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saliendo, setSaliendo] = useState<string | null>(null);
  const [llegando, setLlegando] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/room-status');
      if (res.ok) setRooms(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  /**
   * Check-out desde el mapa: es donde el hotelero VE el cuarto ocupado, así que
   * es donde lo busca. Antes no había ninguno — y cambiar el estado a mano no
   * servía porque la ocupación derivada de las fechas lo volvía a pisar en la
   * siguiente carga (el mapa se recarga solo cada 30 s).
   */
  async function checkout(folio: string) {
    if (!folio || saliendo) return;
    setSaliendo(folio);
    setError('');
    try {
      const res = await fetch(`/api/admin/reservas/${encodeURIComponent(folio)}/checkout`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'No se pudo registrar el check-out.'); return; }
      await load();
    } catch {
      setError('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
    } finally {
      setSaliendo(null);
    }
  }

  /**
   * Check-in desde el mapa. Mismo motivo que el check-out: es donde el hotelero
   * VE el cuarto, así que es donde busca la acción. Y aquí importa el doble,
   * porque el mapa marca "Ocupada" desde la medianoche del día de llegada: sin
   * este botón no había forma de distinguir el cuarto que espera a alguien del
   * que ya lo tiene dentro.
   */
  async function checkin(folio: string) {
    if (!folio || llegando) return;
    setLlegando(folio);
    setError('');
    try {
      const res = await fetch(`/api/admin/reservas/${encodeURIComponent(folio)}/checkin`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'No se pudo registrar la llegada.'); return; }
      await load();
    } catch {
      setError('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
    } finally {
      setLlegando(null);
    }
  }

  async function saveStatus() {
    if (!editModal || saving) return;
    setSaving(true);
    setError('');
    try {
      // Antes el modal se cerraba pasara lo que pasara: recepción cambiaba el
      // estado de un cuarto, la ventana se cerraba, y el mapa seguía igual.
      await postJson('/api/admin/room-status', {
        suite: editModal.room.suite,
        estado: editModal.estado,
        notas: editModal.notas,
      }, 'PATCH');
      setEditModal(null);
      await load();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setSaving(false);
    }
  }

  const counts = rooms.reduce((acc, r) => {
    acc[r.estado] = (acc[r.estado] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <span>Cargando estado de habitaciones…</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Summary bar */}
      <div className={styles.summaryBar}>
        {(Object.entries(STATUS_CONFIG) as [RoomStatusType, typeof STATUS_CONFIG[RoomStatusType]][]).map(([key, cfg]) => (
          <div key={key} className={styles.summaryItem} style={{ borderColor: cfg.color }}>
            <span className={styles.summaryDot} style={{ background: cfg.color }} />
            <span className={styles.summaryLabel}>{cfg.label}</span>
            <span className={styles.summaryCount} style={{ color: cfg.color }}>{counts[key] || 0}</span>
          </div>
        ))}
      </div>

      {/* Room grid */}
      <div className={styles.grid}>
        {rooms.map(room => {
          const cfg = STATUS_CONFIG[room.estado];
          return (
            <div
              key={room.suite}
              className={styles.card}
              style={{ background: cfg.bg, borderColor: cfg.color }}
              onClick={() => setEditModal({ room, estado: room.estado, notas: room.notas })}
            >
              <div className={styles.cardHeader}>
                <span className={styles.statusIcon} style={{ color: cfg.color }}>{cfg.icon}</span>
                <span className={styles.statusBadge} style={{ color: cfg.color, background: 'var(--cream)' }}>
                  {cfg.label}
                </span>
              </div>
              <p className={styles.suiteName}>{room.suite}</p>
              {room.estado === 'OCUPADA' && room.ocupadaPor && (
                <div className={styles.occupiedInfo}>
                  <span className={styles.guestName}>{room.ocupadaPor.cliente.split(' ')[0]} {room.ocupadaPor.cliente.split(' ')[1] || ''}</span>
                  {/* "Ocupada" solo no basta: el cuarto se pinta ocupado desde la
                      medianoche del día de llegada. Esta línea dice cuál de las
                      dos cosas es. */}
                  <span className={styles.checkoutDate}>
                    {room.ocupadaPor.llegoYa ? 'En casa' : 'Aún no llega'} · Sale: {room.ocupadaPor.checkout}
                  </span>
                  <span className={styles.guestCount}>{room.ocupadaPor.huespedes} huéspedes</span>
                  {room.ocupadaPor.confirmacion && !room.ocupadaPor.llegoYa && (
                    <button
                      type="button"
                      className={styles.checkinBtn}
                      onClick={e => { e.stopPropagation(); checkin(room.ocupadaPor!.confirmacion); }}
                      disabled={llegando === room.ocupadaPor.confirmacion}
                      title="El huésped ya llegó: registrar su entrada"
                    >
                      {llegando === room.ocupadaPor.confirmacion
                        ? <><Loader2 size={12} className={styles.spin} /> Registrando…</>
                        : <><LogIn size={12} /> Ya llegó</>}
                    </button>
                  )}
                  {room.ocupadaPor.confirmacion && (
                    <button
                      type="button"
                      className={styles.checkoutBtn}
                      // La tarjeta entera abre el modal de estado: sin esto, el
                      // clic del check-out lo abriría también.
                      onClick={e => { e.stopPropagation(); checkout(room.ocupadaPor!.confirmacion); }}
                      disabled={saliendo === room.ocupadaPor.confirmacion}
                      title="Registrar la salida del huésped y mandar el cuarto a limpieza"
                    >
                      {saliendo === room.ocupadaPor.confirmacion
                        ? <><Loader2 size={12} className={styles.spin} /> Registrando…</>
                        : <><LogOut size={12} /> Hacer check-out</>}
                    </button>
                  )}
                </div>
              )}
              {/* WALK-IN. El hotelero echaba de menos de AZHotel "hacer un
                  registro sin reserva y que la habitación aparezca ocupada", y
                  éste es el sitio donde lo va a buscar: la tarjeta del cuarto
                  libre que tiene delante.
                  Lleva a la pantalla de Reservas en vez de abrir el alta aquí a
                  propósito: ese formulario enseña PRECIOS, y a Operaciones entra
                  la camarista, a quien el panel se los esconde. */}
              {puedeReservar && room.estado === 'DISPONIBLE' && (
                <a
                  href={`/panel/${slug}/reservas?walkin=${encodeURIComponent(room.suite)}`}
                  className={styles.walkinBtn}
                  onClick={e => e.stopPropagation()}
                  title="Registrar a un huésped que llegó sin reserva"
                >
                  <UserPlus size={12} /> Registrar huésped
                </a>
              )}
              {room.notas && room.estado !== 'OCUPADA' && (
                <p className={styles.cardNota}>{room.notas}</p>
              )}
              {room.actualizacion && (
                <p className={styles.cardTs}>Actualizado: {fechaLegible(room.actualizacion)}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editModal.room.suite}</h3>
              <button className={styles.closeBtn} onClick={() => setEditModal(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <label className={styles.fieldLabel}>Estado</label>
              <div className={styles.statusGrid}>
                {(Object.entries(STATUS_CONFIG) as [RoomStatusType, typeof STATUS_CONFIG[RoomStatusType]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`${styles.statusOpt} ${editModal.estado === key ? styles.statusOptActive : ''}`}
                    style={editModal.estado === key ? { borderColor: cfg.color, background: cfg.bg } : {}}
                    // La nota se escribe sola al elegir el estado, PERO sólo si
                    // la que hay la puso el sistema. Lo que escribió una persona
                    // ("el aire no enfría") no se pisa por mover un desplegable.
                    onClick={() =>
                      setEditModal(m =>
                        m ? { ...m, estado: key, notas: notaAlCambiarEstado(key, m.notas) } : m,
                      )
                    }
                  >
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span style={{ color: editModal.estado === key ? cfg.color : 'inherit' }}>{cfg.label}</span>
                  </button>
                ))}
              </div>

              {/* 🔴 EL HUECO QUE ESTO TAPA. `room_statuses` es un estado
                  PUNTUAL —un cuarto, un estado, SIN FECHAS— y `setRoomStatus`
                  no escribe una sola fila en `blocks`. O sea: marcar aquí
                  «Mantenimiento» pinta el cuarto de rojo para la camarista y
                  el motor lo SIGUE VENDIENDO, igual que Camila y que el feed de
                  las OTAs. El hotelero no tiene forma de saberlo.
                  Lo correcto es cerrarlo en el calendario, que sí escribe en
                  `blocks` con fechas. Mientras las dos cosas no se junten, esto
                  al menos lo dice en voz alta. */}
              {editModal.estado === 'MANTENIMIENTO' && (
                <p
                  style={{
                    background: 'var(--chip-aviso-bg)',
                    borderLeft: '3px solid var(--chip-aviso-text)',
                    padding: '9px 12px',
                    margin: '0 0 12px',
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: 'var(--clay)',
                  }}
                >
                  Esto lo marca para tu equipo, pero{' '}
                  <strong>el cuarto sigue a la venta</strong>. Para que deje de
                  venderse, ciérralo en el Calendario con las fechas que estará
                  fuera de servicio.
                </p>
              )}

              <label className={styles.fieldLabel}>Nota interna</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={editModal.notas}
                onChange={e => setEditModal(m => m ? { ...m, notas: e.target.value } : m)}
                placeholder="Ej: En reparación el aire acondicionado, listo el viernes"
              />
            </div>

            {error && (
              <p role="alert" style={{ color: 'var(--chip-mal-text)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>
            )}
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setEditModal(null)}>Cancelar</button>
              <button className={styles.saveBtn} onClick={saveStatus} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
