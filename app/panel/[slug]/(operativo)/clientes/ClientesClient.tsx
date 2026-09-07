'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, MessageSquare, X, Loader2, Send, Star, History, StickyNote, Mail, Eye, AlertTriangle } from 'lucide-react';
import type { GuestProfile } from '@/lib/admin/sheets-admin';
import styles from './clientes.module.css';
import { postJson, mensajeDeError } from '@/lib/ui/api';
import { PLANTILLAS } from '@/lib/email/plantillas-hotelero';

interface Props { initialClientes: GuestProfile[]; slug: string; hotelNombre: string }

function ClienteDrawer({ cliente, hotelName, onClose }: { cliente: GuestProfile; hotelName: string; onClose: () => void }) {
  const [notas, setNotas] = useState(cliente.notas || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'perfil' | 'historial' | 'notas' | 'correo'>('perfil');

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
      <div className={`${styles.drawer} ${activeTab === 'correo' ? styles.drawerAncho : ''}`}>
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
          <button className={`${styles.tab} ${activeTab === 'correo' ? styles.tabActive : ''}`} onClick={() => setActiveTab('correo')}>
            <Mail size={13} /> Correo
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

          {activeTab === 'correo' && <CorreoCliente cliente={cliente} />}

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


/**
 * Escribirle un correo a este huésped, con la marca del hotel.
 *
 * El SERVIDOR arma el borrador y el HTML: aquí no se calcula ni una fecha ni un
 * importe. La razón no es purismo — es que el total, el anticipo y la política
 * de cancelación tienen que decir lo mismo que cobra la caja, y eso sólo se
 * garantiza si salen del motor y no de una copia en el navegador.
 *
 * Y no hay «enviar» a ciegas: cada cambio pide el borrador de nuevo, así que lo
 * que se ve en la vista previa es literalmente el HTML que va a salir.
 */
function CorreoCliente({ cliente }: { cliente: GuestProfile }) {
  const [plantilla, setPlantilla] = useState<string>('llegada');
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [datos, setDatos] = useState<{ k: string; v: string }[]>([]);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [cta, setCta] = useState<{ texto: string; url: string } | null>(null);
  const [enviados, setEnviados] = useState<{ tipo: string; asunto: string; cuando: string; ok: boolean }[]>([]);
  const [html, setHtml] = useState('');
  const [verPrevia, setVerPrevia] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  interface Respuesta {
    ok?: boolean;
    asunto?: string;
    parrafos?: string[];
    datos?: { k: string; v: string }[];
    faltan?: string[];
    cta?: { texto: string; url: string } | null;
    html?: string;
    correos?: { tipo: string; asunto: string; cuando: string; ok: boolean }[];
    error?: string;
  }

  // Pide el borrador de la plantilla elegida. `texto:false` = tráeme el texto de
  // fábrica; `true` = respétame lo que llevo escrito y sólo refresca el HTML.
  const pedir = useCallback(
    async (id: string, conTexto: { asunto: string; parrafos: string[] } | null): Promise<Respuesta | null> => {
      const d = await postJson<Respuesta>('/api/admin/enviar-correo', {
        email: cliente.email,
        nombre: cliente.nombre,
        plantilla: id,
        ...(conTexto ? { asunto: conTexto.asunto, parrafos: conTexto.parrafos } : {}),
      });
      setDatos(d.datos ?? []);
      setFaltan(d.faltan ?? []);
      setCta(d.cta ?? null);
      setHtml(d.html ?? '');
      setEnviados(d.correos ?? []);
      return d;
    },
    [cliente.email, cliente.nombre],
  );

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargando(true);
      setError('');
      setEnviado(false);
      try {
        const d = await pedir(plantilla, null);
        if (cancelado || !d) return;
        setAsunto(d.asunto ?? '');
        setCuerpo((d.parrafos ?? []).join('\n\n'));
      } catch (e) {
        if (!cancelado) setError(mensajeDeError(e));
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [plantilla, pedir]);

  const parrafosDe = (t: string) => t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

  async function previsualizar() {
    setError('');
    try {
      await pedir(plantilla, { asunto, parrafos: parrafosDe(cuerpo) });
      setVerPrevia(true);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function enviar() {
    if (enviando) return;
    if (!confirm(`¿Mandarle este correo a ${cliente.nombre} (${cliente.email})?`)) return;
    setEnviando(true);
    setError('');
    try {
      // Éxito real = HTTP ok Y {ok:true}. Un 200 con ok:false NO es enviado.
      const d = await postJson<Respuesta>('/api/admin/enviar-correo', {
        email: cliente.email,
        nombre: cliente.nombre,
        plantilla,
        asunto,
        parrafos: parrafosDe(cuerpo),
        enviar: true,
      });
      if (d.ok) {
        setEnviado(true);
        // Que la lista de abajo refleje el envío que se acaba de hacer. El
        // correo YA salió: si esto falla no se le dice al hotelero que falló
        // nada —sería mentira y lo mandaría dos veces—, pero se registra.
        try {
          await pedir(plantilla, { asunto, parrafos: parrafosDe(cuerpo) });
        } catch (e) {
          console.warn('[correo] enviado, pero no pude refrescar la lista:', mensajeDeError(e));
        }
      } else {
        setError(d.error || 'No se pudo enviar el correo.');
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const sinCorreo = !cliente.email || cliente.email === 'N/A';
  const listo = !cargando && !faltan.length && asunto.trim() !== '' && parrafosDe(cuerpo).length > 0;

  if (sinCorreo) {
    return <p className={styles.emptyState}>Este cliente no tiene correo registrado.</p>;
  }

  return (
    <div className={styles.correoSection}>
      <div className={styles.correoCampo}>
        <span className={styles.notasLabel}>Plantilla</span>
        <select
          className={styles.correoSelect}
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          aria-label="Plantilla de correo"
        >
          {PLANTILLAS.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <p className={styles.correoAyuda}>
          {PLANTILLAS.find((p) => p.id === plantilla)?.cuando}
        </p>
      </div>

      {faltan.length > 0 && (
        <p className={styles.correoFalta} role="alert">
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Para esta plantilla falta {faltan.join(', ')}. Elige otra o escribe en blanco.</span>
        </p>
      )}

      <div className={styles.correoCampo}>
        <span className={styles.notasLabel}>Asunto</span>
        <input
          className={styles.correoInput}
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          placeholder="Asunto del correo"
        />
      </div>

      <div className={styles.correoCampo}>
        <span className={styles.notasLabel}>Mensaje</span>
        <textarea
          className={styles.notasInput}
          rows={9}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
          placeholder={'Escribe aquí.\n\nDeja una línea en blanco para separar párrafos.'}
        />
        <p className={styles.correoAyuda}>Una línea en blanco separa párrafos.</p>
      </div>

      {datos.length > 0 && (
        <div>
          <span className={styles.notasLabel}>Se añaden solos, con los datos reales</span>
          <div className={styles.correoDatos}>
            {datos.map((d) => (
              <div key={d.k} className={styles.correoDatoFila}>
                <span className={styles.correoDatoK}>{d.k}</span>
                <span className={styles.correoDatoV}>{d.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cta && <p className={styles.correoAyuda}>Lleva un botón: «{cta.texto}».</p>}

      <div className={styles.correoAcciones}>
        <button className={styles.btnSecundario} onClick={() => void previsualizar()} disabled={cargando}>
          <Eye size={14} /> Ver cómo queda
        </button>
        <button
          className={`${styles.offerBtn} ${enviado ? styles.offerBtnSent : ''}`}
          onClick={() => void enviar()}
          disabled={!listo || enviando || enviado}
        >
          {enviando ? <><Loader2 size={14} className={styles.spin} /> Enviando…</>
            : enviado ? '✓ Correo enviado'
            : <><Send size={14} /> Enviar</>}
        </button>
      </div>

      {error && <p role="alert" className={styles.correoFalta}>{error}</p>}

      {enviados.length > 0 && (
        <div className={styles.correoEnviados}>
          <span className={styles.notasLabel}>Ya le mandaste</span>
          {enviados.map((c, i) => (
            <div key={i} className={styles.correoEnviadoFila}>
              <span className={styles.correoEnviadoAsunto}>{c.asunto || c.tipo}</span>
              <span className={c.ok ? undefined : styles.correoFallo}>
                {c.ok ? fechaCorta(c.cuando) : 'no salió'}
              </span>
            </div>
          ))}
        </div>
      )}

      {verPrevia && (
        <div className={styles.previewOverlay} onClick={(e) => e.target === e.currentTarget && setVerPrevia(false)}>
          <div className={styles.previewCaja}>
            <div className={styles.previewBarra}>
              <span className={styles.previewAsunto}>{asunto || '(sin asunto)'}</span>
              <button className={styles.closeBtn} onClick={() => setVerPrevia(false)} aria-label="Cerrar vista previa">
                <X size={18} />
              </button>
            </div>
            {/* `sandbox` vacío: el HTML se arma en nuestro servidor, pero esto es
                el correo de un hotel con texto que teclea su gente. Un iframe sin
                permisos no ejecuta nada ni navega la pestaña. */}
            <iframe className={styles.previewFrame} title="Vista previa del correo" sandbox="" srcDoc={html} />
          </div>
        </div>
      )}
    </div>
  );
}

/** "3 sep" — lo que cabe al lado de un asunto. */
function fechaCorta(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export default function ClientesClient({ initialClientes, slug, hotelNombre }: Props) {
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

      {selected && <ClienteDrawer cliente={selected} hotelName={hotelNombre} onClose={() => setSelected(null)} />}
    </div>
  );
}
