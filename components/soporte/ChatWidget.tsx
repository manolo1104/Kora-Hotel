"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, Loader2, MessageCircle, Send, X } from "lucide-react";
import { WHATSAPP } from "@/lib/contacto";

// Chat de soporte con IA. Flota en el sitio de Kora y el panel (no en las
// páginas públicas de los hoteles ni en el CRM — eso lo decide SiteFrame).

const WA_FUNDADOR = `https://wa.me/${WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(
  "Hola, vengo del chat de ayuda de Kora y tengo una duda"
)}`;

interface Turno {
  rol: "user" | "assistant";
  texto: string;
  escalar?: boolean;
}

const SALUDO: Turno = {
  rol: "assistant",
  texto:
    "¡Hola! Soy el asistente de Kora 🤖 Pregúntame lo que quieras: precios, cómo funciona tu página gratis, pagos… Te contesto al instante.",
};

// El id de la conversación ya NO se inventa aquí: lo genera el servidor y
// vuelve en la respuesta. El de antes (`s_<fecha>_<8 al azar>`) se podía
// adivinar, y con él se pisaba la conversación de otra persona.

// Convierte rutas internas (/precios, /ayuda…) en links.
function ConTexto({ texto }: { texto: string }) {
  const partes = texto.split(/(\/(?:precios|panel|entrar|ayuda|herramientas)[a-z0-9\-/]*)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith("/") ? (
          <Link key={i} href={p} className="font-semibold underline text-kora-primary">
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export function ChatWidget({ elevado = false }: { elevado?: boolean }) {
  const pathname = usePathname() ?? "";
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Turno[]>([SALUDO]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef<string>("");
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionRef.current) {
      // Vacío en la primera pregunta: el servidor devuelve el suyo y se guarda.
      sessionRef.current = sessionStorage.getItem("kora_soporte_sid") ?? "";
    }
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, abierto, cargando]);

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    setError("");
    setTexto("");
    const historial: Turno[] = [...mensajes, { rol: "user", texto: pregunta }];
    setMensajes(historial);
    setCargando(true);
    try {
      const res = await fetch("/api/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // El saludo inicial no se manda (es decorativo).
          mensajes: historial.slice(1).map(({ rol, texto }) => ({ rol, texto })),
          sessionId: sessionRef.current,
          pagina: pathname,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.sessionId === "string" && data.sessionId) {
        sessionRef.current = data.sessionId;
        try {
          sessionStorage.setItem("kora_soporte_sid", data.sessionId);
        } catch {
          /* modo privado o almacenamiento lleno: el hilo sigue en memoria */
        }
      }
      if (res.ok && data.texto) {
        setMensajes((m) => [
          ...m,
          { rol: "assistant", texto: data.texto, escalar: data.escalar === true },
        ]);
      } else {
        setError(data.error || "No pudimos responder. Inténtalo de nuevo.");
      }
    } catch {
      setError("No pudimos responder. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {/* Burbuja */}
      <AnimatePresence>
        {!abierto && (
          <motion.button
            type="button"
            onClick={() => setAbierto(true)}
            aria-label="Abrir chat de ayuda"
            className={`fixed right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-kora-primary text-white shadow-lg hover:scale-105 transition-transform ${
              elevado ? "bottom-24 md:bottom-28" : "bottom-6"
            }`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1 }}
          >
            <HelpCircle size={22} aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Ventana */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
            style={{ height: "min(560px, calc(100vh - 6rem))" }}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-label="Chat de ayuda de Kora"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-kora-primary text-white">
              <div>
                <p className="text-sm font-bold">Ayuda de Kora</p>
                <p className="text-[11px] text-white/70">Respuesta al instante · 24/7</p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar chat"
                className="btn-press w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-kora-bg/60">
              {mensajes.map((m, i) => (
                <div key={i}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                      m.rol === "user"
                        ? "ml-auto bg-kora-primary text-white rounded-br-md"
                        : "bg-white border border-gray-100 text-kora-text shadow-sm rounded-bl-md"
                    }`}
                  >
                    {m.rol === "assistant" ? <ConTexto texto={m.texto} /> : m.texto}
                  </div>
                  {m.escalar && (
                    <a
                      href={WA_FUNDADOR}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-press mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#25D366] text-white font-bold text-xs hover:bg-[#1da851] transition-colors"
                    >
                      <MessageCircle size={14} aria-hidden="true" />
                      Hablar con Manolo por WhatsApp
                    </a>
                  )}
                </div>
              ))}
              {cargando && (
                <div className="inline-flex items-center gap-2 bg-white border border-gray-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-kora-muted shadow-sm">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Escribiendo…
                </div>
              )}
              {error && (
                <p className="text-xs text-red-600 leading-relaxed">
                  {error}{" "}
                  <a href={WA_FUNDADOR} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    Escríbenos por WhatsApp
                  </a>
                </p>
              )}
              <div ref={finRef} />
            </div>

            {/* Input */}
            <form onSubmit={enviar} className="flex items-center gap-2 px-3 py-3 border-t border-gray-100 bg-white">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe tu pregunta…"
                maxLength={1500}
                className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm text-kora-text placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent"
              />
              <button
                type="submit"
                disabled={cargando || !texto.trim()}
                aria-label="Enviar"
                className="btn-press w-10 h-10 rounded-full bg-kora-accent text-kora-primary flex items-center justify-center hover:bg-kora-accent-dark transition-colors disabled:opacity-50"
              >
                <Send size={16} aria-hidden="true" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
