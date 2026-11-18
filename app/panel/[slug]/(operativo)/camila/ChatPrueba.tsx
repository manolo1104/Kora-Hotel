"use client";

// «Pruébala»: el hotelero le escribe a su asistente como si fuera un huésped y ve
// lo que contestaría en WhatsApp. Usa el mismo cerebro, las mismas herramientas
// y la misma disponibilidad real que el bot vivo; sólo el cobro y el aviso al
// equipo están apagados (se dice cuándo los habría usado).
//
// Antes: texto plano (los *asteriscos* salían tal cual), sin botón de empezar de
// nuevo, y sin forma de ver si había consultado disponibilidad o no.

import { useEffect, useRef, useState } from "react";
import { CalendarSearch, Link2, Loader2, RotateCcw, Send, UserRound, CalendarDays } from "lucide-react";
import { RUTA_ACTIVAR, REGALO_CAMILA_MENSAJES } from "@/lib/oferta";
import { TextoWhatsApp, btnSuave } from "@/components/panel/ui";
import type { BotAvailability } from "@/lib/bot/tools";

interface Msg {
  role: "user" | "assistant";
  content: string;
  acciones?: string[];
  error?: boolean;
}

const SUGERENCIAS = [
  "¿Tienen lugar este fin de semana para 2?",
  "¿A qué hora es el check-in?",
  "Somos 2 adultos y 2 niños, ¿cuánto sale?",
  "¿Aceptan mascotas?",
];

const ACCION_LABEL: Record<string, { texto: string; Icono: typeof CalendarSearch }> = {
  disponibilidad: { texto: "Consultó disponibilidad y precios reales", Icono: CalendarSearch },
  "link-pago": { texto: "En vivo, aquí mandaría el link de pago", Icono: Link2 },
  persona: { texto: "En vivo, aquí te avisaría por WhatsApp", Icono: UserRound },
};

function errorDe(error: string | undefined, status: number, nombre: string): string {
  switch (error) {
    case "sin-pago":
      return `${nombre} se activa con tu plan: al activarlo se abren este chat y la conexión con tu WhatsApp, con ${REGALO_CAMILA_MENSAJES} mensajes de regalo.`;
    case "sin-saldo":
      return `Se acabaron los mensajes de ${nombre}. Recarga en la pestaña «WhatsApp y ajustes» y vuelve a probar.`;
    case "motor-pausado":
      return `Tu plan no está activo, así que ${nombre} está en pausa (también con tus huéspedes). Reactívalo desde Suscripción.`;
    case "demasiadas-pruebas":
      return "Llevas muchas pruebas seguidas. Espera un rato y sigue.";
    case "sin-ia":
      return "El chat de prueba no está disponible ahora. Escríbenos y lo revisamos.";
    default:
      return status === 0 ? "Sin conexión. Revisa tu internet y vuelve a intentar." : "No pude responder ahora. Intenta de nuevo.";
  }
}

export default function ChatPrueba({
  nombreBot,
  saludo,
  permitida,
  onPrueba,
}: {
  nombreBot: string;
  saludo: string;
  permitida: boolean;
  onPrueba: () => void;
}) {
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [verificador, setVerificador] = useState(false);
  const fin = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes, enviando]);

  async function enviar(textoParam?: string) {
    const texto = (textoParam ?? input).trim();
    if (!texto || enviando) return;
    const historial = [...mensajes.filter((m) => !m.error), { role: "user" as const, content: texto }];
    setMensajes((m) => [...m, { role: "user", content: texto }]);
    setInput("");
    setEnviando(true);
    let status = 0;
    try {
      const res = await fetch("/api/admin/bot-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: historial.map(({ role, content }) => ({ role, content })) }),
      });
      status = res.status;
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.reply) {
        setMensajes((m) => [...m, { role: "assistant", content: d.reply, acciones: d.acciones ?? [] }]);
        onPrueba();
      } else {
        setMensajes((m) => [...m, { role: "assistant", content: errorDe(d.error, status, nombreBot), error: true }]);
      }
    } catch {
      setMensajes((m) => [...m, { role: "assistant", content: errorDe(undefined, 0, nombreBot), error: true }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-panel-border-soft bg-panel-surface">
      {/* Cabecera estilo chat */}
      <div className="flex items-center justify-between gap-3 border-b border-panel-border-soft px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-kora-primary text-sm font-bold text-white" aria-hidden="true">
            {nombreBot.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-kora-text">Pruébala</p>
            <p className="truncate text-xs text-kora-muted">Escríbele como si fueras un huésped</p>
          </div>
        </div>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={() => setMensajes([])}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-kora-muted hover:bg-panel-contrast/5 hover:text-kora-text"
          >
            <RotateCcw size={13} aria-hidden="true" /> Empezar de nuevo
          </button>
        )}
      </div>

      {!permitida ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-kora-text">{nombreBot} se activa con tu plan</p>
          <p className="text-sm text-kora-muted">
            Al activarlo se abren este chat de prueba y la conexión con tu WhatsApp, con {REGALO_CAMILA_MENSAJES} mensajes de regalo.
          </p>
          <a href={RUTA_ACTIVAR} className={btnSuave}>
            Activar mi plan
          </a>
        </div>
      ) : (
        <>
          {/* Conversación */}
          <div
            className="flex-1 space-y-2 overflow-y-auto bg-kora-bg px-3 py-4"
            style={{ minHeight: 260 }}
            aria-live="polite"
            aria-label={`Conversación de prueba con ${nombreBot}`}
          >
            {mensajes.length === 0 ? (
              <div className="space-y-3">
                {saludo.trim() && (
                  <Burbuja de="bot">
                    <TextoWhatsApp texto={saludo} />
                  </Burbuja>
                )}
                <p className="px-2 pt-1 text-center text-xs text-kora-muted">Toca una pregunta o escribe la tuya:</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => enviar(s)}
                      className="rounded-full border border-panel-border bg-panel-surface px-3 py-1.5 text-xs font-medium text-kora-text transition-colors hover:border-kora-primary/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              mensajes.map((m, i) => (
                <div key={i}>
                  <Burbuja de={m.role === "user" ? "huesped" : m.error ? "aviso" : "bot"}>
                    <TextoWhatsApp texto={m.content} />
                  </Burbuja>
                  {m.acciones && m.acciones.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 pl-1">
                      {m.acciones.map((a) => {
                        const info = ACCION_LABEL[a];
                        if (!info) return null;
                        return (
                          <span
                            key={a}
                            className="inline-flex items-center gap-1 rounded-full bg-[var(--chip-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--chip-info-text)]"
                          >
                            <info.Icono size={11} aria-hidden="true" /> {info.texto}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
            {enviando && (
              <Burbuja de="bot">
                <span className="inline-flex items-center gap-1.5 text-kora-muted">
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" /> escribiendo…
                </span>
              </Burbuja>
            )}
            <div ref={fin} />
          </div>

          {/* Escribir */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex items-center gap-2 border-t border-panel-border-soft p-3"
          >
            <label htmlFor="chat-prueba" className="sr-only">
              Mensaje de prueba
            </label>
            <input
              id="chat-prueba"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Escríbele a ${nombreBot}…`}
              maxLength={2000}
              className="input-kora flex-1 rounded-full px-4"
            />
            <button
              type="submit"
              disabled={!input.trim() || enviando}
              className="btn-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-kora-primary text-white transition-colors hover:bg-kora-primary-dark disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>

          {/* Verificador sin IA: precios exactos que daría */}
          <div className="border-t border-panel-border-soft px-4 py-3">
            <button
              type="button"
              onClick={() => setVerificador((v) => !v)}
              aria-expanded={verificador}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary hover:underline"
            >
              <CalendarDays size={14} aria-hidden="true" />
              {verificador ? "Ocultar" : "Ver"} qué precios daría para unas fechas
            </button>
            {verificador && <Verificador nombreBot={nombreBot} onPrueba={onPrueba} />}
          </div>
        </>
      )}
    </div>
  );
}

function Burbuja({ de, children }: { de: "huesped" | "bot" | "aviso"; children: React.ReactNode }) {
  const base = "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm break-words";
  if (de === "huesped")
    return (
      <div className="flex justify-end">
        <div className={`${base} rounded-br-md bg-kora-primary text-white`}>{children}</div>
      </div>
    );
  if (de === "aviso")
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] rounded-xl bg-[var(--chip-aviso-bg)] px-3 py-2 text-center text-xs text-[var(--chip-aviso-text)]">
          {children}
        </div>
      </div>
    );
  return (
    <div className="flex justify-start">
      <div className={`${base} rounded-bl-md bg-panel-surface text-kora-text`}>{children}</div>
    </div>
  );
}

function enDias(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

function Verificador({ nombreBot, onPrueba }: { nombreBot: string; onPrueba: () => void }) {
  const [checkin, setCheckin] = useState(enDias(7));
  const [checkout, setCheckout] = useState(enDias(9));
  const [adultos, setAdultos] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [r, setR] = useState<BotAvailability | null>(null);

  async function ver() {
    if (checkout <= checkin) {
      setError("La salida tiene que ser después de la llegada.");
      return;
    }
    setCargando(true);
    setError(null);
    setR(null);
    try {
      const res = await fetch("/api/admin/bot-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin, checkout, adultos, ninos }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setR(d as BotAvailability);
        onPrueba();
      } else setError("No pude consultar ahora. Intenta de nuevo.");
    } catch {
      setError("Sin conexión.");
    } finally {
      setCargando(false);
    }
  }

  const fieldCls = "input-kora px-2.5 py-1.5 text-xs";
  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-kora-muted">
          Llegada
          <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} className={`${fieldCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-kora-muted">
          Salida
          <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} className={`${fieldCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-kora-muted">
          Adultos
          <input type="number" min={1} max={20} value={adultos} onChange={(e) => setAdultos(Math.max(1, Number(e.target.value) || 1))} className={`${fieldCls} mt-1`} />
        </label>
        <label className="text-[11px] font-semibold text-kora-muted">
          Niños
          <input type="number" min={0} max={20} value={ninos} onChange={(e) => setNinos(Math.max(0, Number(e.target.value) || 0))} className={`${fieldCls} mt-1`} />
        </label>
      </div>
      <button type="button" onClick={ver} disabled={cargando} className={btnSuave}>
        {cargando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CalendarSearch size={14} aria-hidden="true" />}
        Ver lo que ofrecería {nombreBot}
      </button>
      {error && <p className="text-xs text-[var(--chip-mal-text)]">{error}</p>}
      {r && (
        <div className="space-y-1.5 text-xs">
          {r.error === "min-noches" ? (
            <p className="text-[var(--chip-aviso-text)]">Esas fechas piden mínimo {r.minNoches} noches.</p>
          ) : r.disponibles.length === 0 ? (
            <p className="text-kora-muted">No hay cuartos libres para ese grupo en esas fechas.</p>
          ) : (
            r.disponibles.map((c) => (
              <div key={String(c.id)} className="flex items-center justify-between gap-2 rounded-lg bg-kora-bg px-2.5 py-1.5">
                <span className="font-semibold text-kora-text">{c.nombre}</span>
                <span className="tabular-nums text-kora-text">
                  {c.totalTexto} <span className="text-kora-muted">· {r.noches} noche{r.noches === 1 ? "" : "s"}</span>
                </span>
              </div>
            ))
          )}
          {r.noCaben && r.noCaben.length > 0 && (
            <p className="text-kora-muted">No caben en uno solo: {r.noCaben.map((c) => c.nombre).join(", ")}.</p>
          )}
        </div>
      )}
    </div>
  );
}
