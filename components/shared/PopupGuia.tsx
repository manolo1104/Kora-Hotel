"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SuscripcionForm, CLAVE_SUSCRITO } from "@/components/shared/SuscripcionForm";

// El popup de la guía.
//
// LA REGLA QUE MÁS IMPORTA: no aparece al entrar. Un modal en el segundo cero
// interrumpe antes de haber dado nada, y lo que consigue es que la persona
// cierre la pestaña — no que se suscriba. Aquí espera a una de tres señales de
// que sí está leyendo:
//   · llegó al 45% de la página,
//   · lleva 35 segundos,
//   · o mueve el cursor hacia la barra del navegador (sólo en escritorio: en
//     móvil ese gesto no existe y disparar por “toque” sería un falso positivo).
//
// Y NUNCA aparece si: ya se suscribió, ya lo vio en los últimos 30 días, tiene
// sesión iniciada (ya es cliente: pedirle el correo otra vez es absurdo), o
// está en una página de dinero o de trámite. El resto de las exclusiones —
// sitios de los hoteles (/h, /g), CRM, panel, entrar — las aplica SiteFrame,
// que es el único lugar donde se monta.

const CLAVE_VISTO = "kora_popup_guia_visto";
const DIAS_DESCANSO = 30;
const UMBRAL_SCROLL = 0.45;
const ESPERA_MS = 35_000;

/** Rutas donde interrumpir sería un error: pago, reserva, prueba del editor. */
const RUTAS_MUDAS = ["/pago", "/reserva", "/probar-editor", "/baja", "/guia"];

function puedeAparecer(path: string): boolean {
  if (RUTAS_MUDAS.some((r) => path.startsWith(r))) return false;

  // Con sesión iniciada no se pide el correo: ya es cliente.
  if (typeof document !== "undefined" && document.cookie.includes("-auth-token")) {
    return false;
  }

  try {
    if (localStorage.getItem(CLAVE_SUSCRITO)) return false;
    const visto = Number(localStorage.getItem(CLAVE_VISTO) || 0);
    if (visto && Date.now() - visto < DIAS_DESCANSO * 86_400_000) return false;
  } catch {
    // Almacenamiento bloqueado (incógnito): mejor NO aparecer que aparecer en
    // cada carga sin poder recordar que ya se mostró.
    return false;
  }
  return true;
}

export function PopupGuia() {
  const path = usePathname() ?? "";
  const [abierto, setAbierto] = useState(false);
  const armado = useRef(false);
  const cerrar = useRef<HTMLButtonElement>(null);

  const marcarVisto = useCallback(() => {
    try {
      localStorage.setItem(CLAVE_VISTO, String(Date.now()));
    } catch {
      // sin almacenamiento: no se puede recordar, y no pasa nada
    }
  }, []);

  const abrir = useCallback(() => {
    if (armado.current) return;
    armado.current = true;
    marcarVisto();
    setAbierto(true);
  }, [marcarVisto]);

  // ── Los tres disparadores ────────────────────────────────────────────────
  useEffect(() => {
    if (!puedeAparecer(path)) return;

    const onScroll = () => {
      const alto = document.documentElement.scrollHeight - window.innerHeight;
      if (alto > 0 && window.scrollY / alto >= UMBRAL_SCROLL) abrir();
    };

    // Salida: el cursor cruza el borde superior de la ventana. Sólo con ratón.
    const onSalida = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) abrir();
    };

    const reloj = window.setTimeout(abrir, ESPERA_MS);
    window.addEventListener("scroll", onScroll, { passive: true });

    const finoPuntero = window.matchMedia("(pointer: fine)").matches;
    if (finoPuntero) document.addEventListener("mouseout", onSalida);

    return () => {
      window.clearTimeout(reloj);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onSalida);
    };
  }, [path, abrir]);

  // ── Escape, foco y bloqueo del scroll de fondo ───────────────────────────
  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", onTecla);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrar.current?.focus();
    return () => {
      document.removeEventListener("keydown", onTecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto]);

  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Fondo. Clic fuera = cerrar. */}
          <div
            className="absolute inset-0 bg-kora-text/50 backdrop-blur-[2px]"
            onClick={() => setAbierto(false)}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="popup-guia-titulo"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <button
              ref={cerrar}
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-kora-muted transition-colors hover:bg-gray-100 hover:text-kora-text"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <div className="bg-kora-primary px-7 pb-6 pt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-kora-accent">
                Guía gratis
              </p>
              <h2
                id="popup-guia-titulo"
                className="mt-2.5 text-2xl font-bold leading-tight tracking-tight text-white"
              >
                Del 40% al 25% de dependencia de Booking en 90 días
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                El plan que seguí en mi propio hotel en Xilitla, semana por
                semana. Con las plantillas de WhatsApp que usé y los dos errores
                que me costaron el primer mes.
              </p>
            </div>

            <div className="px-7 pb-7 pt-6">
              <SuscripcionForm
                origen="popup"
                piel="popup"
                textoBoton="Mándame la guía"
                nota="Sin costo. Te das de baja en un clic, siempre."
                autoFocus
              />
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="mt-4 w-full text-center text-xs text-kora-muted transition-colors hover:text-kora-text"
              >
                Ahora no, gracias
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
