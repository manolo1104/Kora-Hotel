"use client";

import { useRef, type ReactNode } from "react";

// Borde luminoso que sigue al cursor (patrón Vercel/Linear). El brillo vive en
// un pseudo-elemento CSS (.glow-border) y aquí solo movemos dos variables CSS
// directamente en el DOM — cero re-renders de React, solo activo con mouse.
export function GlowCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - r.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - r.top}px`);
  }

  return (
    <div ref={ref} onMouseMove={onMove} className={`glow-border ${className}`}>
      {children}
    </div>
  );
}
