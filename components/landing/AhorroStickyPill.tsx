"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { trackCta } from "@/lib/analytics";

// Pill flotante que sigue al usuario tras usar la CalculadoraROI: le recuerda
// SU cifra (la que él mismo configuró — honestidad) con un CTA a precios.
// Se oculta al llegar al formulario de contacto y se puede descartar.

const DISMISS_KEY = "kora_pill_descartado";

export function AhorroStickyPill({
  comisionAnual,
  visible,
}: {
  comisionAnual: number;
  /** true cuando el usuario ya interactuó Y la calculadora salió del viewport */
  visible: boolean;
}) {
  const reduce = useReducedMotion();
  const [descartado, setDescartado] = useState(true); // evita flash en SSR
  const [enContacto, setEnContacto] = useState(false);

  useEffect(() => {
    setDescartado(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  // Ocultar cuando el formulario de contacto está en pantalla (no competir con él).
  useEffect(() => {
    const contacto = document.getElementById("contacto");
    if (!contacto) return;
    const obs = new IntersectionObserver(([e]) => setEnContacto(e.isIntersecting), {
      threshold: 0.15,
    });
    obs.observe(contacto);
    return () => obs.disconnect();
  }, []);

  function descartar() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDescartado(true);
  }

  const mostrar = visible && !descartado && !enContacto && comisionAnual > 0;
  const cifra = "$" + Math.round(comisionAnual).toLocaleString("es-MX");

  return (
    <AnimatePresence>
      {mostrar && (
        <motion.div
          role="complementary"
          aria-label="Resumen de tu cálculo de comisiones"
          className="fixed bottom-5 left-1/2 z-40 w-max max-w-[calc(100vw-6.5rem)]"
          style={{ x: "-50%" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 rounded-full bg-kora-primary/95 backdrop-blur border border-white/10 shadow-2xl shadow-kora-primary/30 pl-4 pr-1.5 py-1.5 text-white">
            <p className="text-xs sm:text-sm leading-tight whitespace-nowrap">
              Pierdes{" "}
              <span className="font-bold tabular-nums text-kora-accent">{cifra}</span>
              <span className="hidden sm:inline">/año en comisiones</span>
              <span className="sm:hidden">/año</span>
              <span className="block text-[9px] text-white/50 leading-none mt-0.5">
                según tu calculadora
              </span>
            </p>
            <a
              href="#precios"
              onClick={() => trackCta("pill_ahorro")}
              className="btn-press inline-flex items-center gap-1 rounded-full bg-kora-accent text-kora-primary font-bold text-xs sm:text-sm px-3.5 py-2 hover:bg-kora-accent-dark transition-colors whitespace-nowrap"
            >
              Recupéralos
              <ArrowRight size={13} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={descartar}
              aria-label="Cerrar"
              className="btn-press w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
