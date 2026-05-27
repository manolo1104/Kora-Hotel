"use client";

import { useScroll, useSpring, motion } from "motion/react";

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[70] h-[2px] bg-kora-accent origin-left pointer-events-none"
      style={{ scaleX }}
    />
  );
}
