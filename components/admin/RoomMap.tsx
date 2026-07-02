'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, AlertTriangle, Sparkles, BedDouble, CheckCircle } from 'lucide-react';
import styles from './RoomMap.module.css';

export type RoomStatusType = 'DISPONIBLE' | 'OCUPADA' | 'MANTENIMIENTO' | 'LIMPIEZA';

interface RoomData {
  suite: string;
  estado: RoomStatusType;
  notas: string;
  actualizacion: string;
  ocupadaPor: { cliente: string; checkout: string; huespedes: number } | null;
}

const STATUS_CONFIG: Record<RoomStatusType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DISPONIBLE:   { label: 'Disponible',         color: '#4ade80', bg: 'rgba(74,222,128,0.22)',  icon: <CheckCircle size={14} /> },
  OCUPADA:      { label: 'Ocupada',             color: '#facc15', bg: 'rgba(250,204,21,0.22)',  icon: <BedDouble size={14} /> },
  MANTENIMIENTO:{ label: 'Mantenimiento',       color: '#f87171', bg: 'rgba(248,113,113,0.28)', icon: <AlertTriangle size={14} /> },
  LIMPIEZA:     { label: 'Limpieza pendiente',  color: '#60a5fa', bg: 'rgba(96,165,250,0.22)',  icon: <Sparkles size={14} /> },
};

interface EditModal {
  room: RoomData;
  estado: RoomStatusType;
  notas: string;
}

export default function RoomMap() {
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function saveStatus() {
    if (!editModal || saving) return;
    setSaving(true);
    try {
      await fetch('/api/admin/room-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite: editModal.room.suite,
          estado: editModal.estado,
          notas: editModal.notas,
        }),
      });
      setEditModal(null);
      await load();
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
              style={{ background: cfg.bg, borderColor: cfg.color + 'cc' }}
              onClick={() => setEditModal({ room, estado: room.estado, notas: room.notas })}
            >
              <div className={styles.cardHeader}>
                <span className={styles.statusIcon} style={{ color: cfg.color }}>{cfg.icon}</span>
                <span className={styles.statusBadge} style={{ color: cfg.color, background: cfg.color + '22' }}>
                  {cfg.label}
                </span>
              </div>
              <p className={styles.suiteName}>{room.suite}</p>
              {room.estado === 'OCUPADA' && room.ocupadaPor && (
                <div className={styles.occupiedInfo}>
                  <span className={styles.guestName}>{room.ocupadaPor.cliente.split(' ')[0]} {room.ocupadaPor.cliente.split(' ')[1] || ''}</span>
                  <span className={styles.checkoutDate}>Sale: {room.ocupadaPor.checkout}</span>
                  <span className={styles.guestCount}>{room.ocupadaPor.huespedes} huéspedes</span>
                </div>
              )}
              {room.notas && room.estado !== 'OCUPADA' && (
                <p className={styles.cardNota}>{room.notas}</p>
              )}
              {room.actualizacion && (
                <p className={styles.cardTs}>Actualizado: {room.actualizacion}</p>
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
                    onClick={() => setEditModal(m => m ? { ...m, estado: key } : m)}
                  >
                    <span style={{ color: cfg.color }}>{cfg.icon}</span>
                    <span style={{ color: editModal.estado === key ? cfg.color : 'inherit' }}>{cfg.label}</span>
                  </button>
                ))}
              </div>

              <label className={styles.fieldLabel}>Nota interna</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={editModal.notas}
                onChange={e => setEditModal(m => m ? { ...m, notas: e.target.value } : m)}
                placeholder="Ej: En reparación el aire acondicionado, listo el viernes"
              />
            </div>

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
