'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, CheckCircle, Clock, AlertTriangle, X, Plus, Loader2, Map as MapIcon } from 'lucide-react';
import type {
  CleaningTask,
  CleaningTaskEstado,
  MaintenanceTask,
  MaintenanceEstado,
  MaintenancePrioridad,
} from '@/lib/db/admin';
import { getChecklistItems, type ChecklistItem } from '@/lib/admin/cleaning-config';
import RoomMap from '@/components/admin/RoomMap';
import styles from './operaciones.module.css';
import { postJson, mensajeDeError } from '@/lib/ui/api';

interface Props {
  initialCleaning: CleaningTask[];
  initialMaintenance: MaintenanceTask[];
  suites: string[];
  today: string;
}

// ── Limpieza ──────────────────────────────────────────────────────────────────
// El checklist es una guía operativa: al guardar, persistimos una CleaningTask
// (suite, fecha, estado PENDIENTE/HECHA, asignado, notas). Los items completados
// se resumen dentro de las notas, ya que el modelo Kora no tiene columnas por
// item (a diferencia del Sheets de Paraíso).

function ChecklistModal({ suite, today, onClose, onSaved }: {
  suite: string; today: string; onClose: () => void; onSaved: () => void;
}) {
  const items: ChecklistItem[] = getChecklistItems(suite);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [personal, setPersonal] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function checkAll() { setChecked(new Set(items.map(i => i.id))); }

  async function handleSave(estado: CleaningTaskEstado) {
    setLoading(true);
    setError('');
    try {
      const completados = items.filter(i => checked.has(i.id)).map(i => i.label);
      const pendientes = items.filter(i => !checked.has(i.id)).map(i => i.label);
      const resumen = [
        `${completados.length}/${items.length} items completados`,
        pendientes.length ? `Pendientes: ${pendientes.join(', ')}` : '',
        observaciones ? `Obs: ${observaciones}` : '',
      ].filter(Boolean).join(' · ');
      // Antes se cerraba el modal pasara lo que pasara: la camarista marcaba la
      // habitación como limpia, la pantalla se cerraba, y el registro no existía.
      await postJson('/api/admin/operaciones/limpieza', {
        suite, fecha: today, asignado: personal, notas: resumen, estado,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>{suite}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.field}><span>Personal</span>
            <input value={personal} onChange={e => setPersonal(e.target.value)} placeholder="Nombre del encargado" />
          </label>
          <div className={styles.checklistHeader}>
            <span className={styles.checklistProgress}>{checked.size}/{items.length} items</span>
            <button className={styles.checkAllBtn} onClick={checkAll}>Marcar todos ✓</button>
          </div>
          <div className={styles.checklistItems}>
            {items.map(item => (
              <label key={item.id} className={`${styles.checkItem} ${checked.has(item.id) ? styles.checkItemDone : ''}`}>
                <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          <label className={styles.field}><span>Observaciones</span>
            <textarea rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas adicionales..." />
          </label>
        </div>
        {error && (
          <p role="alert" style={{ color: '#b42318', fontSize: 13, margin: '0 16px 8px' }}>{error}</p>
        )}
        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button className={styles.warnBtn} onClick={() => handleSave('PENDIENTE')} disabled={loading}>
            {loading ? <Loader2 size={14} className={styles.spin} /> : null} Dejar pendiente
          </button>
          <button className={styles.primaryBtn} onClick={() => handleSave('HECHA')} disabled={loading}>
            {loading ? <Loader2 size={14} className={styles.spin} /> : null} Marcar limpia
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mantenimiento ─────────────────────────────────────────────────────────────

function AddTaskModal({ onClose, onSaved, suites }: { onClose: () => void; onSaved: () => void; suites: string[] }) {
  const [form, setForm] = useState({
    suite: '',
    titulo: '',
    prioridad: 'media' as MaintenancePrioridad,
    notas: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await postJson('/api/admin/operaciones/mantenimiento', form);
      onSaved(); onClose();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally { setLoading(false); }
  }
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}><h3>Nueva tarea de mantenimiento</h3><button onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={handleSubmit} className={styles.modalBody}>
          <div className={styles.grid2}>
            <label className={styles.field}><span>Suite / Área</span>
              <select value={form.suite} onChange={e => set('suite', e.target.value)}>
                <option value="">HOTEL (general)</option>
                {suites.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className={styles.field}><span>Prioridad</span>
              <select value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
          </div>
          <label className={styles.field}><span>Tarea *</span>
            <input required value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Limpieza filtro A/C" />
          </label>
          <label className={styles.field}><span>Notas</span>
            <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} />
          </label>
          {error && (
            <p role="alert" style={{ color: '#b42318', fontSize: 13, margin: '0 0 8px' }}>{error}</p>
          )}
          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : null} Agregar tarea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<MaintenanceEstado, string> = {
  ABIERTA: 'Abierta',
  EN_PROCESO: 'En proceso',
  CERRADA: 'Cerrada',
};

export default function OperacionesClient({ initialCleaning, initialMaintenance, suites, today }: Props) {
  const [tab, setTab] = useState<'limpieza' | 'mantenimiento' | 'cuartos'>('limpieza');
  const [cleaning, setCleaning] = useState(initialCleaning);
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const refreshCleaning = useCallback(async () => {
    const res = await fetch('/api/admin/operaciones/limpieza');
    if (res.ok) setCleaning(await res.json());
  }, []);

  const refreshMaintenance = useCallback(async () => {
    const res = await fetch('/api/admin/operaciones/mantenimiento');
    if (res.ok) setMaintenance(await res.json());
  }, []);

  // Última tarea de limpieza por suite (las más recientes vienen primero).
  function getSuiteTask(suite: string): CleaningTask | undefined {
    return cleaning.find(c => c.suite === suite);
  }

  async function setMaintField(id: string, changes: Partial<{ estado: MaintenanceEstado; prioridad: MaintenancePrioridad }>) {
    setLoading(true);
    setError('');
    try {
      await postJson('/api/admin/operaciones/mantenimiento', { id, ...changes }, 'PATCH');
      await refreshMaintenance();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally { setLoading(false); }
  }

  const statusIcon = (estado: CleaningTaskEstado | 'none') => {
    if (estado === 'HECHA') return <CheckCircle size={16} color="#2d7a34" />;
    if (estado === 'PENDIENTE') return <Clock size={16} color="#52b788" />;
    return null;
  };

  const completedToday = cleaning.filter(c => c.estado === 'HECHA' && c.fecha === today).length;
  const openMaintenance = maintenance.filter(t => t.estado !== 'CERRADA').length;
  const highPriority = maintenance.filter(t => t.estado !== 'CERRADA' && t.prioridad === 'alta').length;

  const todayLabel = new Date(today + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City',
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Operaciones</h1>
          <p className={styles.pageSub}>{todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}</p>
        </div>
        <div className={styles.headerActions}>
          {tab !== 'cuartos' && (
            <button className={styles.iconBtn} onClick={tab === 'limpieza' ? refreshCleaning : refreshMaintenance} title="Actualizar">
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" style={{ color: '#b42318', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
      )}

      {/* Resumen */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryCard} style={{ borderColor: '#2d7a34' }}>
          <CheckCircle size={18} color="#2d7a34" />
          <div><strong>{completedToday}</strong><span>cuartos limpios hoy</span></div>
        </div>
        <div className={styles.summaryCard} style={{ borderColor: openMaintenance > 0 ? '#c9484a' : '#e5e7eb' }}>
          <AlertTriangle size={18} color={openMaintenance > 0 ? '#c9484a' : '#aaa'} />
          <div><strong>{openMaintenance}</strong><span>mantenimientos abiertos</span></div>
        </div>
        <div className={styles.summaryCard} style={{ borderColor: highPriority > 0 ? '#c9484a' : '#e5e7eb' }}>
          <Clock size={18} color={highPriority > 0 ? '#c9484a' : '#aaa'} />
          <div><strong>{highPriority}</strong><span>prioridad alta</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'limpieza' ? styles.tabActive : ''}`} onClick={() => setTab('limpieza')}>
          Limpieza
        </button>
        <button className={`${styles.tab} ${tab === 'mantenimiento' ? styles.tabActive : ''}`} onClick={() => setTab('mantenimiento')}>
          Mantenimiento {openMaintenance > 0 && <span className={styles.badge}>{openMaintenance}</span>}
        </button>
        <button className={`${styles.tab} ${tab === 'cuartos' ? styles.tabActive : ''}`} onClick={() => setTab('cuartos')}>
          <MapIcon size={14} /> Estado de cuartos
        </button>
      </div>

      {/* Contenido: Limpieza */}
      {tab === 'limpieza' && (
        suites.length === 0 ? (
          <div className={styles.empty}>Este hotel todavía no tiene cuartos configurados.</div>
        ) : (
          <div className={styles.suiteGrid}>
            {suites.map(suite => {
              const task = getSuiteTask(suite);
              const estado: CleaningTaskEstado | 'none' = task ? task.estado : 'none';
              return (
                <div
                  key={suite}
                  className={`${styles.suiteCard} ${styles[`suite_${estado}`]}`}
                  onClick={() => setSelectedSuite(suite)}
                >
                  <div className={styles.suiteCardTop}>
                    <span className={styles.suiteName}>{suite}</span>
                    {statusIcon(estado)}
                  </div>
                  {task && (
                    <div className={styles.suiteCardMeta}>
                      {task.asignado && <span>{task.asignado}</span>}
                      {task.fecha && <span>{task.fecha}</span>}
                    </div>
                  )}
                  {estado === 'none' && <p className={styles.suiteCardCta}>Registrar limpieza →</p>}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Contenido: Mantenimiento — acordeón por suite */}
      {tab === 'mantenimiento' && (
        <div>
          <div className={styles.mantHeader}>
            <p className={styles.pageSub}>{maintenance.length} tarea{maintenance.length !== 1 ? 's' : ''} registrada{maintenance.length !== 1 ? 's' : ''}</p>
            <button className={styles.primaryBtn} onClick={() => setShowAddTask(true)}>
              <Plus size={15} /> Agregar tarea
            </button>
          </div>

          {maintenance.length === 0 ? (
            <div className={styles.empty}>No hay tareas de mantenimiento. Agrega la primera con el botón de arriba.</div>
          ) : (() => {
            const bySuite: Record<string, MaintenanceTask[]> = {};
            maintenance.forEach(t => {
              const key = t.suite || 'HOTEL';
              if (!bySuite[key]) bySuite[key] = [];
              bySuite[key].push(t);
            });
            return Object.entries(bySuite).map(([suite, tasks]) => {
              const openInSuite = tasks.filter(t => t.estado !== 'CERRADA').length;
              const highInSuite = tasks.filter(t => t.estado !== 'CERRADA' && t.prioridad === 'alta').length;
              const isOpen = openAccordion === suite;
              return (
                <div key={suite} className={styles.accordionItem}>
                  <button className={styles.accordionHeader} onClick={() => setOpenAccordion(isOpen ? null : suite)}>
                    <span className={styles.accordionSuiteName}>{suite}</span>
                    <span className={styles.accordionMeta}>
                      {highInSuite > 0 && <span className={styles.badgeOverdue}>{highInSuite} alta</span>}
                      {openInSuite > 0 && !highInSuite && <span className={styles.badgeSoon}>{openInSuite} abierta{openInSuite !== 1 ? 's' : ''}</span>}
                      {openInSuite === 0 && <span className={styles.badgeOk}>al día</span>}
                    </span>
                    <span className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ''}`}>›</span>
                  </button>
                  {isOpen && (
                    <div className={styles.accordionBody}>
                      {tasks.map(t => (
                        <div key={t.id} className={`${styles.accordionTask} ${t.estado !== 'CERRADA' && t.prioridad === 'alta' ? styles.accordionTaskOverdue : ''}`}>
                          <div className={styles.accordionTaskMain}>
                            <span className={styles.accordionTaskName}>{t.titulo}</span>
                            {t.notas && <span className={styles.taskNota}>{t.notas}</span>}
                          </div>
                          <div className={styles.accordionTaskMeta}>
                            <span className={styles[`prio_${t.prioridad}`]}>{t.prioridad}</span>
                            <span className={styles[`estado_${t.estado}`]}>{ESTADO_LABEL[t.estado]}</span>
                          </div>
                          <div className={styles.taskActions}>
                            <select
                              className={styles.taskSelect}
                              value={t.estado}
                              disabled={loading}
                              onChange={e => setMaintField(t.id, { estado: e.target.value as MaintenanceEstado })}
                            >
                              <option value="ABIERTA">Abierta</option>
                              <option value="EN_PROCESO">En proceso</option>
                              <option value="CERRADA">Cerrada</option>
                            </select>
                            {t.estado !== 'CERRADA' && (
                              <button className={styles.doneBtn} onClick={() => setMaintField(t.id, { estado: 'CERRADA' })} disabled={loading}>
                                ✓ Cerrar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Contenido: Estado de cuartos (mapa) */}
      {tab === 'cuartos' && <RoomMap />}

      {selectedSuite && (
        <ChecklistModal
          suite={selectedSuite}
          today={today}
          onClose={() => setSelectedSuite(null)}
          onSaved={refreshCleaning}
        />
      )}
      {showAddTask && (
        <AddTaskModal
          suites={suites}
          onClose={() => setShowAddTask(false)}
          onSaved={refreshMaintenance}
        />
      )}
    </div>
  );
}
