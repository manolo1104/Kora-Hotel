'use client';

// La bandeja de WhatsApp del hotel.
//
// Empezó siendo un espejo: enseñaba lo que Camila había contestado y nada más.
// El problema de un espejo es que cuando el huésped pregunta algo que Camila no
// sabe, el hotelero tiene que abrir WhatsApp en su teléfono — y desde ahí ya no
// hay panel, ni etiquetas, ni forma de callar a Camila para no hablar encima.
//
// Ahora se puede trabajar aquí: contestar, marcar «yo contesto», etiquetar el
// hilo y corregir a Camila cuando se equivoca (eso último es lo único que de
// verdad la hace mejorar: la corrección se guarda como pregunta frecuente y
// llega a su cerebro en el mensaje siguiente).
//
// «EN VIVO» ES UN REFRESCO CADA 8 SEGUNDOS, no un WebSocket, y así se dice en
// pantalla. La tabla `camila_conversaciones` tiene RLS activo y CERO políticas a
// propósito —son mensajes de huéspedes—, así que una suscripción desde el
// navegador no recibiría nada sin abrirla, y eso no se va a hacer por una
// animación. El sondeo se para solo cuando la pestaña deja de estar visible.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2, MessageSquare, RefreshCw, ArrowLeft, Send, Bot, Hand, Tag, Wand2, X, Check,
} from 'lucide-react';
import { getJson, postJson, mensajeDeError } from '@/lib/ui/api';

interface Turno {
  rol: 'user' | 'assistant';
  texto: string;
  ts?: string;
  /** Ausente = lo dijo Camila. `"hotel"` = lo escribió una persona del hotel. */
  por?: 'hotel';
}

interface Hilo {
  chatId: string;
  telefono: string;
  ultimoAt: string;
  mensajes: number;
  ultimoTexto?: string;
  turnos?: Turno[];
  etiquetas: string[];
  pausadoHasta: string | null;
  vistoAt: string | null;
  noLeidos: number;
}

const ETIQUETAS = ['Nueva', 'Cotizando', 'Reservó', 'Perdida', 'Atender yo'] as const;

/** El color de cada etiqueta. Se lee de un vistazo o no sirve para filtrar. */
const COLOR_ETIQUETA: Record<string, string> = {
  Nueva: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  Cotizando: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  Reservó: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  Perdida: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'Atender yo': 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};

/** Cada cuánto se vuelve a preguntar, mientras la pestaña esté a la vista. */
const REFRESCO_MS = 8000;

/** Cuánto calla Camila cuando el hotelero contesta. */
const PAUSA_MIN = 120;

/** "hace 5 min", "ayer", "12 sep" — lo que un hotelero lee de un vistazo. */
function cuando(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function hora(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

/** ¿Sigue vigente la pausa? Una fecha pasada es lo mismo que no tenerla. */
function enPausa(hasta: string | null): boolean {
  if (!hasta) return false;
  const t = Date.parse(hasta);
  return Number.isFinite(t) && t > Date.now();
}

export default function Conversaciones({ nombreBot }: { nombreBot: string }) {
  const [hilos, setHilos] = useState<Hilo[] | null>(null);
  const [abierto, setAbierto] = useState<Hilo | null>(null);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [cargandoHilo, setCargandoHilo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [respuesta, setRespuesta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<Turno | null>(null);

  // El chat abierto, en una ref: el temporizador se crea una vez y no puede
  // quedarse mirando un valor viejo.
  const abiertoRef = useRef<string | null>(null);
  useEffect(() => {
    abiertoRef.current = abierto?.chatId ?? null;
  }, [abierto]);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setError(null);
    try {
      const d = await getJson<{ hilos: Hilo[] }>('/api/admin/camila-conversaciones');
      setHilos(d.hilos ?? []);
      // Si hay uno abierto, se refresca también: es donde el hotelero está
      // mirando y donde importa que aparezca el mensaje nuevo.
      const chat = abiertoRef.current;
      if (chat) {
        const det = await getJson<{ hilo: Hilo }>(
          `/api/admin/camila-conversaciones?chat=${encodeURIComponent(chat)}`,
        );
        setAbierto((prev) => (prev && prev.chatId === chat ? det.hilo : prev));
      }
    } catch (e) {
      if (!silencioso) {
        setHilos((prev) => prev ?? []);
        setError(mensajeDeError(e));
      }
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El refresco. Se salta las vueltas en las que la pestaña no está a la vista:
  // no tiene sentido consultar la base para un panel que nadie está mirando.
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void cargar(true);
    }, REFRESCO_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargar(true);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cargar]);

  async function abrir(h: Hilo) {
    setAbierto(h);
    setRespuesta('');
    setAviso(null);
    setCargandoHilo(true);
    try {
      const d = await getJson<{ hilo: Hilo }>(
        `/api/admin/camila-conversaciones?chat=${encodeURIComponent(h.chatId)}`,
      );
      setAbierto(d.hilo);
      // Marcar leído. Que falle (el SQL de la bandeja sin correr) no merece una
      // alerta al hotelero —no poder recordar dónde te quedaste no le rompe el
      // día— pero sí queda en la consola: si nadie lo ve, nadie lo arregla.
      //
      // Y el punto de «sin leer» SÓLO se apaga si de verdad se guardó. Apagarlo
      // igual dejaba la pantalla mintiendo durante ocho segundos: el hotelero
      // veía desaparecer el punto y el siguiente refresco se lo devolvía.
      try {
        await postJson('/api/admin/camila-chat', { chatId: h.chatId, visto: true });
        setHilos((prev) => prev?.map((x) => (x.chatId === h.chatId ? { ...x, noLeidos: 0 } : x)) ?? prev);
      } catch (e) {
        console.warn('[bandeja] no se pudo marcar como leído:', mensajeDeError(e));
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargandoHilo(false);
    }
  }

  /** Cambia algo del hilo abierto y refleja el resultado REAL, no el deseado. */
  async function cambiarChat(cambio: Record<string, unknown>) {
    if (!abierto) return;
    setAviso(null);
    try {
      const d = await postJson<{ ok?: boolean; pausadoHasta?: string | null }>(
        '/api/admin/camila-chat',
        { chatId: abierto.chatId, ...cambio },
      );
      await cargar(true);
      return d;
    } catch (e) {
      setAviso(mensajeDeError(e));
    }
  }

  async function enviar() {
    const texto = respuesta.trim();
    if (!texto || !abierto || enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      const d = await postJson<{ ok?: boolean; error?: string; avisoPausa?: string | null }>(
        '/api/admin/camila-responder',
        { chatId: abierto.chatId, texto, pausarMin: PAUSA_MIN },
      );
      if (!d.ok) {
        setAviso(d.error || 'No se pudo enviar.');
        return;
      }
      setRespuesta('');
      if (d.avisoPausa) setAviso(d.avisoPausa);
      await cargar(true);
    } catch (e) {
      setAviso(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const visibles = (hilos ?? []).filter((h) => !filtro || h.etiquetas.includes(filtro));
  const sinLeer = (hilos ?? []).reduce((n, h) => n + (h.noLeidos > 0 ? 1 : 0), 0);

  if (hilos === null) {
    return (
      <div className="grid place-items-center py-16 text-kora-muted">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  // Estado vacío honesto: distingue "aún no ha hablado con nadie" de un error.
  if (hilos.length === 0) {
    return (
      <div className="rounded-2xl border border-panel-contrast/10 bg-panel-surface p-8 text-center space-y-2">
        <MessageSquare size={26} className="mx-auto text-kora-muted" />
        <p className="font-semibold text-kora-text">Todavía no hay conversaciones</p>
        <p className="text-sm text-kora-muted max-w-md mx-auto">
          {error
            ? `No pude leerlas ahora mismo: ${error}`
            : `En cuanto un huésped le escriba a ${nombreBot}, la conversación aparecerá aquí y podrás contestarle sin salir del panel.`}
        </p>
        <button onClick={() => void cargar()} className="btn-press text-sm text-kora-primary font-semibold pt-2">
          Volver a revisar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-kora-muted">
          {hilos.length} {hilos.length === 1 ? 'conversación' : 'conversaciones'}
          {sinLeer > 0 && <> · <span className="font-semibold text-kora-primary">{sinLeer} sin leer</span></>}
        </p>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-kora-muted" title="Se vuelve a consultar cada 8 segundos mientras tengas esta pestaña abierta.">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En vivo · se actualiza solo
          </span>
          <button
            onClick={() => void cargar()}
            className="btn-press inline-flex items-center gap-1.5 text-sm text-kora-primary font-semibold"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Filtro por etiqueta */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFiltro(null)}
          className={`btn-press rounded-full px-3 py-1 text-xs font-semibold ${!filtro ? 'bg-kora-primary text-white' : 'bg-panel-surface border border-panel-contrast/10 text-kora-muted'}`}
        >
          Todas
        </button>
        {ETIQUETAS.map((e) => {
          const n = (hilos ?? []).filter((h) => h.etiquetas.includes(e)).length;
          return (
            <button
              key={e}
              onClick={() => setFiltro(filtro === e ? null : e)}
              className={`btn-press rounded-full px-3 py-1 text-xs font-semibold ${filtro === e ? 'bg-kora-primary text-white' : `${COLOR_ETIQUETA[e]} border border-transparent`}`}
            >
              {e}{n > 0 && ` · ${n}`}
            </button>
          );
        })}
      </div>

      <div className="grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-4">
        {/* Lista de hilos. En móvil se esconde al abrir uno. */}
        <ul
          className={`rounded-2xl border border-panel-contrast/10 bg-panel-surface divide-y divide-panel-contrast/10 overflow-hidden max-h-[34rem] overflow-y-auto ${abierto ? 'hidden md:block' : ''}`}
        >
          {visibles.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-kora-muted">Ninguna con esa etiqueta.</li>
          )}
          {visibles.map((h) => (
            <li key={h.chatId}>
              <button
                onClick={() => void abrir(h)}
                className={`w-full text-left px-4 py-3 hover:bg-kora-primary/5 transition-colors ${abierto?.chatId === h.chatId ? 'bg-kora-primary/5' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {h.noLeidos > 0 && <span className="shrink-0 w-2 h-2 rounded-full bg-kora-primary" aria-label="sin leer" />}
                    <span className={`truncate text-sm ${h.noLeidos > 0 ? 'font-bold text-kora-text' : 'font-semibold text-kora-text'}`}>
                      {h.telefono}
                    </span>
                  </span>
                  <span className="text-[11px] text-kora-muted shrink-0">{cuando(h.ultimoAt)}</span>
                </div>
                {h.ultimoTexto && (
                  <p className="text-xs text-kora-muted mt-0.5 line-clamp-2">{h.ultimoTexto}</p>
                )}
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {h.etiquetas.map((e) => (
                    <span key={e} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLOR_ETIQUETA[e] ?? ''}`}>{e}</span>
                  ))}
                  {enPausa(h.pausadoHasta) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-panel-contrast/10 px-2 py-0.5 text-[10px] font-semibold text-kora-muted">
                      <Hand size={9} /> lo atiendes tú
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Hilo abierto */}
        <div className={`rounded-2xl border border-panel-contrast/10 bg-panel-surface ${abierto ? '' : 'hidden md:block'}`}>
          {!abierto ? (
            <div className="grid place-items-center h-full min-h-[16rem] text-sm text-kora-muted px-6 text-center">
              Elige una conversación para leerla y contestarla.
            </div>
          ) : (
            <div className="flex flex-col max-h-[34rem]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-contrast/10">
                <button
                  onClick={() => setAbierto(null)}
                  className="btn-press md:hidden text-kora-muted"
                  aria-label="Volver a la lista"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-kora-text truncate">{abierto.telefono}</p>
                  <p className="text-[11px] text-kora-muted">Último mensaje {cuando(abierto.ultimoAt)}</p>
                </div>
                {/* Quién atiende este chat. El estado que se pinta es el que
                    devolvió el servidor, no el que se acaba de pulsar. */}
                <button
                  onClick={() => void cambiarChat({ pausarMin: enPausa(abierto.pausadoHasta) ? 0 : PAUSA_MIN })}
                  className={`btn-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    enPausa(abierto.pausadoHasta)
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-kora-primary/10 text-kora-primary'
                  }`}
                  title={enPausa(abierto.pausadoHasta)
                    ? `${nombreBot} no contesta en este chat. Pulsa para que vuelva.`
                    : `${nombreBot} está contestando. Pulsa para atenderlo tú.`}
                >
                  {enPausa(abierto.pausadoHasta) ? <><Hand size={12} /> Lo atiendes tú</> : <><Bot size={12} /> {nombreBot} responde</>}
                </button>
              </div>

              {/* Etiquetas del hilo */}
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-panel-contrast/10">
                <Tag size={12} className="text-kora-muted" />
                {ETIQUETAS.map((e) => {
                  const puesta = abierto.etiquetas.includes(e);
                  return (
                    <button
                      key={e}
                      onClick={() =>
                        void cambiarChat({
                          etiquetas: puesta ? abierto.etiquetas.filter((x) => x !== e) : [...abierto.etiquetas, e],
                        })
                      }
                      className={`btn-press rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity ${COLOR_ETIQUETA[e]} ${puesta ? '' : 'opacity-40'}`}
                    >
                      {puesta && <Check size={9} className="inline mr-1" />}{e}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-kora-bg/50">
                {cargandoHilo && !abierto.turnos && (
                  <div className="grid place-items-center py-10 text-kora-muted">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                )}
                {(abierto.turnos ?? []).map((t, i) => (
                  <div key={i} className={`flex ${t.rol === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[85%]">
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          t.rol === 'user'
                            ? 'bg-panel-surface border border-panel-contrast/10 text-kora-text'
                            : t.por === 'hotel'
                              ? 'bg-panel-contrast/15 text-kora-text border border-panel-contrast/10'
                              : 'bg-kora-primary text-white'
                        }`}
                      >
                        {t.texto}
                        <span
                          className={`block text-[10px] mt-1 ${t.rol === 'user' || t.por === 'hotel' ? 'text-kora-muted' : 'text-white/70'}`}
                        >
                          {t.por === 'hotel' ? 'tú · ' : ''}{hora(t.ts)}
                        </span>
                      </div>
                      {/* Corregir sólo tiene sentido sobre lo que dijo Camila. */}
                      {t.rol === 'assistant' && t.por !== 'hotel' && (
                        <button
                          onClick={() => setCorrigiendo(t)}
                          className="btn-press mt-0.5 ml-auto flex items-center gap-1 text-[10px] text-kora-muted hover:text-kora-primary"
                        >
                          <Wand2 size={10} /> Corregir
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Caja de respuesta */}
              <div className="border-t border-panel-contrast/10 p-3 space-y-2">
                {aviso && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{aviso}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    className="input-kora flex-1 resize-none text-sm"
                    rows={2}
                    value={respuesta}
                    onChange={(e) => setRespuesta(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void enviar();
                      }
                    }}
                    placeholder={`Escríbele al huésped… (Enter manda, Shift+Enter salta línea)`}
                  />
                  <button
                    onClick={() => void enviar()}
                    disabled={enviando || !respuesta.trim()}
                    className="btn-press shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-kora-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Enviar
                  </button>
                </div>
                <p className="text-[11px] text-kora-muted">
                  Sale por el WhatsApp de tu hotel. Al contestar tú, {nombreBot} se calla 2 horas en
                  este chat para no escribir encima.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {corrigiendo && (
        <Corregir
          turno={corrigiendo}
          nombreBot={nombreBot}
          preguntaSugerida={preguntaAntesDe(abierto?.turnos ?? [], corrigiendo)}
          onCerrar={() => setCorrigiendo(null)}
        />
      )}
    </div>
  );
}

/** El mensaje del huésped que provocó esa respuesta: es la «pregunta» a corregir. */
function preguntaAntesDe(turnos: Turno[], turno: Turno): string {
  const i = turnos.indexOf(turno);
  for (let j = i - 1; j >= 0; j--) if (turnos[j].rol === 'user') return turnos[j].texto.slice(0, 200);
  return '';
}

/**
 * «Camila contestó esto y no era.» Lo que el hotelero escriba aquí se guarda
 * como pregunta frecuente del bot, que es la misma lista del entrenamiento: el
 * prompt se arma en el servidor, así que la corrección llega al bot vivo en el
 * mensaje siguiente sin tocar nada más.
 */
function Corregir({
  turno,
  nombreBot,
  preguntaSugerida,
  onCerrar,
}: {
  turno: Turno;
  nombreBot: string;
  preguntaSugerida: string;
  onCerrar: () => void;
}) {
  const [pregunta, setPregunta] = useState(preguntaSugerida);
  const [respuesta, setRespuesta] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      const d = await postJson<{ ok?: boolean; error?: string }>('/api/admin/camila-corregir', {
        pregunta,
        respuesta,
      });
      if (d.ok) {
        setListo(true);
        setTimeout(onCerrar, 1400);
      } else {
        setError(d.error || 'No se pudo guardar.');
      }
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-panel-surface p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-kora-text">Enséñale a {nombreBot}</h3>
          <button onClick={onCerrar} className="btn-press text-kora-muted" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="rounded-xl bg-kora-bg/60 border border-panel-contrast/10 p-3">
          <p className="text-[11px] uppercase tracking-wide text-kora-muted mb-1">Contestó</p>
          <p className="text-sm text-kora-text whitespace-pre-wrap line-clamp-4">{turno.texto}</p>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-kora-muted">Cuando le pregunten</span>
          <input className="input-kora w-full text-sm" value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="¿Aceptan mascotas?" />
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-kora-muted">Debe contestar</span>
          <textarea className="input-kora w-full text-sm" rows={4} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Sí, perros de hasta 15 kg con un cargo de $200 por estancia." />
        </label>

        <p className="text-[11px] text-kora-muted">
          Se guarda entre las preguntas frecuentes de {nombreBot}, y lo usa desde el siguiente mensaje.
          Puedes verlo y editarlo en Configurar → Reglas de conversación.
        </p>

        {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onCerrar} className="btn-press rounded-xl px-4 py-2 text-sm font-semibold text-kora-muted">Cancelar</button>
          <button
            onClick={() => void guardar()}
            disabled={guardando || listo || pregunta.trim().length < 3 || respuesta.trim().length < 2}
            className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-kora-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : listo ? <Check size={14} /> : <Wand2 size={14} />}
            {listo ? 'Aprendido' : 'Enseñárselo'}
          </button>
        </div>
      </div>
    </div>
  );
}
