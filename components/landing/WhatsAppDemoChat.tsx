"use client";

import { useEffect, useRef, useState } from "react";
import { Send, ArrowRight } from "lucide-react";
import { WindowFrame } from "@/components/landing/ProductMockups";

type Msg = { from: "guest" | "bot"; text: string };

const SALUDO =
  "¡Hola! 👋 Soy Camila, la asistente del hotel. Pregúntame lo que quieras: disponibilidad, precios, si aceptamos mascotas… lo que un huésped te preguntaría.";

const SUGERENCIAS = [
  "¿Tienen disponibilidad este fin de semana?",
  "¿Cuánto cuesta la habitación más económica?",
  "¿Aceptan mascotas?",
];

const MAX_TURNOS_USUARIO = 10;

export function WhatsAppDemoChat() {
  const [mensajes, setMensajes] = useState<Msg[]>([{ from: "bot", text: SALUDO }]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const turnosUsuario = mensajes.filter((m) => m.from === "guest").length;
  const limiteAlcanzado = turnosUsuario >= MAX_TURNOS_USUARIO;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, cargando]);

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || cargando || limiteAlcanzado) return;
    setInput("");
    const nuevos: Msg[] = [...mensajes, { from: "guest", text: t }];
    setMensajes(nuevos);
    setCargando(true);
    try {
      const res = await fetch("/api/agent-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensajes: nuevos.map((m) => ({
            rol: m.from === "guest" ? "user" : "assistant",
            texto: m.text,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.texto) {
        setMensajes((prev) => [...prev, { from: "bot", text: d.texto }]);
      } else {
        setMensajes((prev) => [
          ...prev,
          { from: "bot", text: d.error || "Ups, no pude responder ahora. Inténtalo de nuevo. 🙏" },
        ]);
      }
    } catch {
      setMensajes((prev) => [
        ...prev,
        { from: "bot", text: "Se me fue la señal 📶 Inténtalo de nuevo en un momento." },
      ]);
    } finally {
      setCargando(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="relative select-none">
      <WindowFrame title="WhatsApp del hotel">
        {/* Cabecera del chat */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-kora-primary">
          <div className="w-8 h-8 rounded-full bg-kora-accent flex items-center justify-center text-kora-primary font-bold text-xs">
            C
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">Camila · Asistente IA</p>
            <p className="text-[10px] text-kora-accent leading-tight">en línea · responde al instante</p>
          </div>
          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-white/60 bg-white/10 rounded-full px-2 py-0.5">
            Demo
          </span>
        </div>

        {/* Conversación */}
        <div ref={scrollRef} className="p-4 space-y-2.5 bg-[#F3F1EC] h-[340px] overflow-y-auto">
          {mensajes.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.from === "guest" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 text-[12.5px] leading-snug shadow-sm whitespace-pre-line ${
                  m.from === "guest"
                    ? "bg-white text-kora-text rounded-2xl rounded-br-sm"
                    : "bg-kora-primary text-white rounded-2xl rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {cargando && (
            <div className="flex justify-start">
              <div className="bg-kora-primary/90 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Chips de sugerencia (solo antes del primer mensaje del usuario) */}
          {turnosUsuario === 0 && !cargando && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="btn-press text-[11px] font-medium text-kora-primary bg-white border border-kora-accent/40 rounded-full px-2.5 py-1 hover:bg-kora-accent/10 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Barra de entrada */}
        {limiteAlcanzado ? (
          <div className="bg-white px-4 py-3 text-center border-t border-gray-100">
            <p className="text-[12px] text-kora-muted">
              Así de bien atendería a <b>tus</b> huéspedes, 24/7.
            </p>
            <a
              href="/panel/onboarding"
              className="btn-press mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-kora-primary hover:underline"
            >
              Probar Kora gratis <ArrowRight size={14} />
            </a>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(input);
            }}
            className="flex items-center gap-2 bg-white px-3 py-2.5 border-t border-gray-100"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele como si fueras un huésped…"
              maxLength={280}
              disabled={cargando}
              className="flex-1 min-w-0 text-[13px] text-kora-text placeholder:text-kora-muted bg-[#F3F1EC] rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-kora-accent"
            />
            <button
              type="submit"
              disabled={cargando || !input.trim()}
              aria-label="Enviar"
              className="btn-press flex-shrink-0 w-9 h-9 rounded-full bg-kora-primary text-white flex items-center justify-center disabled:opacity-50 transition-opacity"
            >
              <Send size={16} />
            </button>
          </form>
        )}
      </WindowFrame>
      <p className="mt-3 text-center text-[11px] text-white/50">
        Demo real con IA sobre un hotel de ejemplo. Con tu hotel usa tus precios y tus datos.
      </p>
    </div>
  );
}
