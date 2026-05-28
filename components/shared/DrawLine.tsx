"use client";

import { motion, useReducedMotion } from "motion/react";

// Línea que se "dibuja" de arriba hacia abajo al entrar en pantalla.
// Motivación: refuerza la secuencia ordenada de los pasos del timeline.
export function DrawLine({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className} aria-hidden="true" />;
  }

  return (
    <motion.div
      className={className}
      style={{ transformOrigin: "top" }}
      initial={{ scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden="true"
    />
  );
}
