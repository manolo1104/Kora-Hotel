"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "motion/react";

interface CountUpProps {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function CountUp({ to, prefix = "", suffix = "", duration = 1.5, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref as React.RefObject<Element>, { once: true, margin: "-60px 0px" });
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (isInView && !started && ref.current) {
      setStarted(true);
      const el = ref.current;
      const formatear = (v: number) =>
        `${prefix}${Math.round(v).toLocaleString("es-MX")}${suffix}`;
      // Con movimiento reducido no animamos: el valor real ya está pintado.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.textContent = formatear(to);
        return;
      }
      animate(0, to, {
        duration,
        ease: [0.23, 1, 0.32, 1],
        onUpdate: (v) => {
          el.textContent = formatear(v);
        },
      });
    }
  }, [isInView, started, to, prefix, suffix, duration]);

  // El HTML inicial (SSR, crawlers, JS deshabilitado o hidratación rota) debe
  // mostrar el valor real, nunca 0; la animación solo lo re-escribe encima.
  return (
    <span ref={ref} className={className}>
      {prefix}
      {to.toLocaleString("es-MX")}
      {suffix}
    </span>
  );
}
