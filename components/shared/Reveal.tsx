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

const directions = {
  up:    { transform: `translateY(${OFFSET}px)` },
  left:  { transform: `translateX(-${OFFSET}px)` },
  right: { transform: `translateX(${OFFSET}px)` },
  none:  { transform: "none" },
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
      initial={{ opacity: 0, ...directions[direction] }}
      animate={
        isInView
          ? { opacity: 1, transform: "translateY(0px)" }
          : {}
      }
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
