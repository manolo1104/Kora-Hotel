'use client';

// Lo que Camila le ha contestado a los huéspedes.
//
// La tabla `camila_conversaciones` llevaba semanas llenándose sin que existiera
// una sola función que la leyera, mientras la página de venta prometía que
// «todas las conversaciones quedan en tu panel y puedes leerlas». Esta es la
// pantalla que faltaba para que esa frase sea verdad.
//
// Lista de hilos a la izquierda, conversación a la derecha. Las burbujas usan el
// mismo lenguaje visual que el chat de prueba de la pantalla de al lado, para
// que el hotelero reconozca de un vistazo quién dijo qué.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, RefreshCw, ArrowLeft } from 'lucide-react';
import { getJson, mensajeDeError } from '@/lib/ui/api';

interface Turno {
  rol: 'user' | 'assistant';
  texto: string;
  ts?: string;
}

interface Hilo {
  chatId: string;
  telefono: string;
  ultimoAt: string;
  mensajes: number;
  ultimoTexto?: string;
  turnos?: Turno[];
}

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

export default function Conversaciones({ nombreBot }: { nombreBot: string }) {
  const [hilos, setHilos] = useState<Hilo[] | null>(null);
  const [abierto, setAbierto] = useState<Hilo | null>(null);
  const [cargandoHilo, setCargandoHilo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await getJson<{ hilos: Hilo[] }>('/api/admin/camila-conversaciones');
      setHilos(d.hilos ?? []);
    } catch (e) {
      setHilos([]);
      setError(mensajeDeError(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function abrir(h: Hilo) {
    setAbierto(h);
    setCargandoHilo(true);
    try {
      const d = await getJson<{ hilo: Hilo }>(
        `/api/admin/camila-conversaciones?chat=${encodeURIComponent(h.chatId)}`,
      );
      setAbierto(d.hilo);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargandoHilo(false);
    }
  }

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
            : `En cuanto un huésped le escriba a ${nombreBot}, la conversación completa aparecerá aquí para que veas qué le contestó.`}
        </p>
        <button onClick={() => void cargar()} className="btn-press text-sm text-kora-primary font-semibold pt-2">
          Volver a revisar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-kora-muted">
          {hilos.length} {hilos.length === 1 ? 'conversación' : 'conversaciones'} · lo que {nombreBot} le
          contestó a tus huéspedes
        </p>
        <button
          onClick={() => void cargar()}
          className="btn-press inline-flex items-center gap-1.5 text-sm text-kora-primary font-semibold"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      <div className="grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-4">
        {/* Lista de hilos. En móvil se esconde al abrir uno. */}
        <ul
          className={`rounded-2xl border border-panel-contrast/10 bg-panel-surface divide-y divide-panel-contrast/10 overflow-hidden max-h-[32rem] overflow-y-auto ${abierto ? 'hidden md:block' : ''}`}
        >
          {hilos.map((h) => (
            <li key={h.chatId}>
              <button
                onClick={() => void abrir(h)}
                className={`w-full text-left px-4 py-3 hover:bg-kora-primary/5 transition-colors ${abierto?.chatId === h.chatId ? 'bg-kora-primary/5' : ''}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-sm text-kora-text truncate">{h.telefono}</span>
                  <span className="text-[11px] text-kora-muted shrink-0">{cuando(h.ultimoAt)}</span>
                </div>
                {h.ultimoTexto && (
                  <p className="text-xs text-kora-muted mt-0.5 line-clamp-2">{h.ultimoTexto}</p>
                )}
                <p className="text-[11px] text-kora-muted mt-1">
                  {h.mensajes} {h.mensajes === 1 ? 'mensaje' : 'mensajes'}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {/* Hilo abierto */}
        <div className={`rounded-2xl border border-panel-contrast/10 bg-panel-surface ${abierto ? '' : 'hidden md:block'}`}>
          {!abierto ? (
            <div className="grid place-items-center h-full min-h-[16rem] text-sm text-kora-muted px-6 text-center">
              Elige una conversación para leerla completa.
            </div>
          ) : (
            <div className="flex flex-col max-h-[32rem]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-panel-contrast/10">
                <button
                  onClick={() => setAbierto(null)}
                  className="btn-press md:hidden text-kora-muted"
                  aria-label="Volver a la lista"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-kora-text truncate">{abierto.telefono}</p>
                  <p className="text-[11px] text-kora-muted">Último mensaje {cuando(abierto.ultimoAt)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-kora-bg/50">
                {cargandoHilo && !abierto.turnos && (
                  <div className="grid place-items-center py-10 text-kora-muted">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                )}
                {(abierto.turnos ?? []).map((t, i) => (
                  <div key={i} className={`flex ${t.rol === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        t.rol === 'user'
                          ? 'bg-panel-surface border border-panel-contrast/10 text-kora-text'
                          : 'bg-kora-primary text-white'
                      }`}
                    >
                      {t.texto}
                      {t.ts && (
                        <span
                          className={`block text-[10px] mt-1 ${t.rol === 'user' ? 'text-kora-muted' : 'text-white/70'}`}
                        >
                          {hora(t.ts)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* El huésped a la izquierda y Camila a la derecha: al revés que en
                  el chat de prueba, donde quien escribe es el hotelero. */}
              <p className="px-4 py-2 text-[11px] text-kora-muted border-t border-panel-contrast/10">
                Izquierda: tu huésped · Derecha: {nombreBot}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
