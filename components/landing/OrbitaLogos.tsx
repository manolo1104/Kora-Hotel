"use client";

// Logos de las integraciones girando en espiral alrededor del chat del hero.
//
// Los logos salen de INTEGRACIONES (lib/integraciones.ts), la fuente única de
// con qué se integra Kora de verdad: si una integración sale de la lista, deja
// de volar sola. Sólo se usan las que tienen logo.
//
// La espiral: cada logo da vueltas en una elipse cuyo radio «respira» (entra y
// sale) a otro ritmo, así que la trayectoria es una espiral que se abre y se
// cierra. En la mitad de abajo de la elipse el logo pasa POR DELANTE del chat
// (más grande y opaco); en la de arriba, POR DETRÁS (más chico y tenue).
//
// Rendimiento: un solo requestAnimationFrame que escribe `transform` directo
// en el DOM (sin re-render de React), pausado fuera de pantalla. Con
// «reducir movimiento» los logos quedan quietos alrededor del chat.

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { INTEGRACIONES } from "@/lib/integraciones";

const LOGOS = INTEGRACIONES.filter((i) => i.status === "active" && i.logo);

const VUELTA_S = 26; // segundos por vuelta completa
const RESPIRO_S = 9; // segundos por ciclo de abrir/cerrar la espiral

export function OrbitaLogos({ children }: { children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const reducir = useReducedMotion();

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const n = LOGOS.length;
    let rx = 0;
    let ry = 0;
    let amp = 0.14;
    let visible = true;
    let raf = 0;
    const inicio = performance.now();

    const medir = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // En pantallas chicas el chat ocupa todo el ancho: los logos rozan el
      // borde en vez de salirse de la pantalla.
      const chico = w < 480;
      const holgura = chico ? 10 : 34;
      rx = w / 2 + holgura;
      ry = h / 2 + holgura;
      // En el celular la espiral respira menos: no hay espacio a los lados y,
      // si se cierra mucho, tapa los mensajes.
      amp = chico ? 0.05 : 0.14;
    };

    const pintar = (t: number) => {
      for (let i = 0; i < n; i++) {
        const nodo = items.current[i];
        if (!nodo) continue;
        const fase = (i / n) * Math.PI * 2;
        const ang = fase + (t / VUELTA_S) * Math.PI * 2;
        // 0.86–1.14: la espiral se abre y se cierra ALREDEDOR del borde del chat,
        // sin meterse sobre los mensajes (con 0.6 tapaba el texto).
        const s = 1 + amp * Math.sin((t / RESPIRO_S) * Math.PI * 2 + fase * 1.7);
        const x = Math.cos(ang) * rx * s;
        const y = Math.sin(ang) * ry * s;
        const prof = (Math.sin(ang) + 1) / 2; // 0 = atrás (arriba), 1 = adelante (abajo)
        const escala = 0.72 + 0.38 * prof;
        nodo.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${escala.toFixed(3)})`;
        nodo.style.opacity = (0.45 + 0.55 * prof).toFixed(2);
        nodo.style.zIndex = prof > 0.5 ? "30" : "0";
      }
    };

    medir();
    const ro = new ResizeObserver(() => {
      medir();
      if (reducir) pintar(0);
    });
    ro.observe(el);

    if (reducir) {
      pintar(0);
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(el);

    function tick(ahora: number) {
      raf = 0;
      if (!visible) return;
      pintar((ahora - inicio) / 1000);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [reducir]);

  return (
    // my-10 en celular: aire arriba y abajo para que la órbita no pise el
    // texto del hero.
    <div ref={caja} className="relative my-10 sm:my-0">
      {/* El chat va en medio (z-10): los logos de atrás (z-0) pasan por
          detrás y los de adelante (z-30) por encima. */}
      <div className="relative z-10">{children}</div>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {LOGOS.map((l, i) => (
          <div
            key={l.name}
            ref={(n) => {
              items.current[i] = n;
            }}
            className="absolute left-1/2 top-1/2 w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white border border-gray-100 shadow-lg flex items-center justify-center will-change-transform"
            style={{ opacity: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.logo} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
          </div>
        ))}
      </div>
    </div>
  );
}
