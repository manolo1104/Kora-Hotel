"use client";

import { motion, useInView } from "motion/react";
import { useRef, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** "up" (default) | "left" | "right" | "none" (opacity only) */
  direction?: "up" | "left" | "right" | "none";
}

const OFFSET = 20;

// Cada dirección anima sobre el mismo eje (from → to) para que Motion
// interpole de forma limpia, sin saltos al pasar de X a Y.
const directions = {
  up:    { from: `translateY(${OFFSET}px)`,  to: "translateY(0px)" },
  left:  { from: `translateX(-${OFFSET}px)`, to: "translateX(0px)" },
  right: { from: `translateX(${OFFSET}px)`,  to: "translateX(0px)" },
  none:  { from: "none",                     to: "none" },
};

export function Reveal({
  children,
  delay = 0,
  className,
  direction = "up",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px 0px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, transform: directions[direction].from }}
      animate={
        isInView
          ? { opacity: 1, transform: directions[direction].to }
          : {}
      }
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
