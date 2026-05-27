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
      animate(0, to, {
        duration,
        ease: [0.23, 1, 0.32, 1],
        onUpdate: (v) => {
          el.textContent = `${prefix}${Math.round(v).toLocaleString("es-MX")}${suffix}`;
        },
      });
    }
  }, [isInView, started, to, prefix, suffix, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
