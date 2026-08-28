'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, MessageSquare, X, Loader2, Send, Star, History, StickyNote } from 'lucide-react';
import type { GuestProfile } from '@/lib/admin/sheets-admin';
import styles from './clientes.module.css';
import { postJson, mensajeDeError } from '@/lib/ui/api';

interface Props { initialClientes: GuestProfile[]; slug: string }

function ClienteDrawer({ cliente, hotelName, onClose }: { cliente: GuestProfile; hotelName: string; onClose: () => void }) {
  const [notas, setNotas] = useState(cliente.notas || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'perfil' | 'historial' | 'notas'>('perfil');

  async function saveNotas() {
    setSaving(true);
    setError('');
    try {
      // El fetch de antes no miraba `res.ok`. fetch sólo lanza si falla la RED:
      // un 500 entraba por el camino feliz y pintaba el ✓ verde con la nota
      // perdida. Y 25 líneas más abajo, `sendOffer` ya traía el arreglo con su
      // comentario — nunca se propagó a esta función de al lado.
      await postJson('/api/admin/guest-notes', { email: cliente.email, notas });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally { setSaving(false); }
  }

  async function sendOffer() {
    if (sendingOffer) return;
    if (!confirm(`¿Enviar oferta personalizada a ${cliente.nombre} (${cliente.email})?`)) return;
    setSendingOffer(true);
    setError('');
    try {
      // Éxito real = HTTP ok Y {ok:true}. Un 200 con {ok:false} NO es enviado.
      const d = await postJson<{ ok?: boolean; error?: string }>('/api/admin/send-offer', {
        email: cliente.email, nombre: cliente.nombre,
        suitesFavoritas: cliente.suitesFavoritas,
        ultimaEstancia: cliente.ultimaEstancia,
        totalReservas: cliente.totalReservas, notas: cliente.notas,
      });
      if (d.ok) { setOfferSent(true); setTimeout(() => setOfferSent(false), 4000); }
      else { setError(d.error || 'No se pudo enviar el correo.'); }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally { setSendingOffer(false); }
  }

  function openWA() {
    const num = cliente.telefono?.replace(/\D/g, '') || '';
    if (!num) return;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(`Hola ${cliente.nombre.split(' ')[0]}, te contactamos desde ${hotelName} 🌿`)}`, '_blank');
  }

  const isVIP = cliente.totalReservas >= 3 || cliente.totalGastado >= 10000;

  return (
    <div className={styles.drawerOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerNameRow}>
              <h2 className={styles.drawerName}>{cliente.nombre}</h2>
              {isVIP && <span className={styles.vipBadge}>VIP</span>}
            </div>
            <p className={styles.drawerEmail}>{cliente.email}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'perfil' ? styles.tabActive : ''}`} onClick={() => setActiveTab('perfil')}>
            <Star size={13} /> Perfil
          </button>
          <button className={`${styles.tab} ${activeTab === 'historial' ? styles.tabActive : ''}`} onClick={() => setActiveTab('historial')}>
            <History size={13} /> Historial ({cliente.historial?.length || 0})
          </button>
          <button className={`${styles.tab} ${activeTab === 'notas' ? styles.tabActive : ''}`} onClick={() => setActiveTab('notas')}>
            <StickyNote size={13} /> Notas {cliente.notas ? '●' : ''}
          </button>
        </div>

        <div className={styles.drawerBody}>

          {activeTab === 'perfil' && <>
            <div className={styles.statsGrid}>
              <div className={styles.stat}><span className={styles.statLabel}>Estancias</span><span className={styles.statVal}>{cliente.totalReservas}</span></div>
              <div className={styles.stat}><span className={styles.statLabel}>Total gastado</span><span className={styles.statVal}>${cliente.totalGastado.toLocaleString('es-MX')}</span></div>
              <div className={styles.stat}><span className={styles.statLabel}>Última visita</span><span className={styles.statVal}>{cliente.ultimaEstancia || '—'}</span></div>
            </div>

            {cliente.telefono && cliente.telefono !== 'N/A' && (
              <div className={styles.contact}>
                <span>{cliente.telefono}</span>
                <button className={styles.waBtn} onClick={openWA}>
                  <MessageSquare size={14} /> WhatsApp
                </button>
              </div>
            )}

            {cliente.suitesFavoritas.length > 0 && (
              <div className={styles.suites}>
                <p className={styles.suitesLabel}>Suites reservadas</p>
                <div className={styles.suiteTags}>
                  {cliente.suitesFavoritas.map(s => <span key={s} className={styles.suiteTag}>{s}</span>)}
                </div>
              </div>
            )}

            {cliente.email && cliente.email !== 'N/A' && (
              <div className={styles.offerSection}>
                <p className={styles.offerDesc}>Claude redacta un email personalizado con oferta especial basado en su historial.</p>
                <button
                  className={`${styles.offerBtn} ${offerSent ? styles.offerBtnSent : ''}`}
                  onClick={sendOffer}
                  disabled={sendingOffer || offerSent}
                >
                  {sendingOffer
                    ? <><Loader2 size={14} className={styles.spin} /> Generando y enviando…</>
                    : offerSent
                    ? '✓ Oferta enviada'
                    : <><Send size={14} /> Enviar oferta personalizada</>
                  }
                </button>
              </div>
            )}
          </>}

          {activeTab === 'historial' && (
            <div className={styles.historialList}>
              {(!cliente.historial || cliente.historial.length === 0) ? (
                <p className={styles.emptyState}>Sin estancias registradas.</p>
              ) : cliente.historial.map((stay, i) => (
                <div key={i} className={styles.stayCard}>
                  <div className={styles.stayHeader}>
                    <span className={styles.staySuite}>{stay.habitaciones}</span>
                    <span className={styles.stayTotal}>${stay.total?.toLocaleString('es-MX') || '—'}</span>
                  </div>
                  <div className={styles.stayDates}>
                    {stay.checkin} → {stay.checkout}
                    <span className={styles.stayMeta}> · {stay.noches} noches · {stay.huespedes} huéspedes</span>
                  </div>
                  <div className={styles.stayId}>{stay.confirmacion}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'notas' && (
            <div className={styles.notasSection}>
              <p className={styles.notasHint}>Solo visible para staff. El bot de WhatsApp lee estas notas para personalizar su respuesta.</p>
              <textarea
                className={styles.notasInput}
                rows={7}
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder={'Preferencias, alergias, ocasiones especiales…\nEj: "Viaja con perro pequeño", "Cliente VIP — upgrade si hay disponible"'}
              />
              <button className={styles.saveBtn} onClick={saveNotas} disabled={saving}>
                {saving ? <Loader2 size={13} className={styles.spin} /> : null}
                {saved ? '✓ Guardado' : 'Guardar notas'}
              </button>
              {error && (
                <p role="alert" style={{ color: 'var(--chip-mal-text)', fontSize: 13, marginTop: 8 }}>{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientesClient({ initialClientes, slug }: Props) {
  const [clientes, setClientes] = useState(initialClientes);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GuestProfile | null>(null);

  // Refresca la lista desde el endpoint (lo provee otro agente). Si falla,
  // se conserva initialClientes ya cargado en el servidor.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/clientes');
        if (!res.ok) return;
        const data = await res.json();
        const list: GuestProfile[] = Array.isArray(data) ? data : data.clientes;
        if (!cancel && Array.isArray(list)) setClientes(list);
      } catch { /* mantener datos del servidor */ }
    })();
    return () => { cancel = true; };
  }, [slug]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return clientes;
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.telefono.includes(q)
    );
  }, [clientes, search]);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Clientes</h1>
          <p className={styles.pageSub}>{clientes.length} huéspedes · ${clientes.reduce((s, c) => s + c.totalGastado, 0).toLocaleString('es-MX')} MXN total</p>
        </div>
      </div>

      <div className={styles.searchWrap}>
        <Search size={15} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Buscar por nombre, email o teléfono…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Cliente</th><th>Teléfono</th><th>Reservas</th><th>Total gastado</th><th>Última estancia</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>Sin clientes que mostrar</td></tr>
            ) : filtered.map(c => (
              <tr key={c.email} className={styles.row} onClick={() => setSelected(c)}>
                <td>
                  <div className={styles.clienteName}>{c.nombre}</div>
                  <div className={styles.clienteEmail}>{c.email}</div>
                </td>
                <td>{c.telefono !== 'N/A' ? c.telefono : '—'}</td>
                <td>{c.totalReservas}</td>
                <td className={styles.total}>${c.totalGastado.toLocaleString('es-MX')}</td>
                <td>{c.ultimaEstancia || '—'}</td>
                <td>
                  {c.notas && <span className={styles.notaBadge} title="Tiene notas">📝</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <ClienteDrawer cliente={selected} hotelName="tu hotel" onClose={() => setSelected(null)} />}
    </div>
  );
}
