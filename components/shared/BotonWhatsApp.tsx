"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "motion/react";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { waLink } from "@/lib/contacto";

// El botón flotante sale en TODAS las páginas, así que es lo que más empuja a
// quien lo ve. Hasta el 15 sep 2026 decía «Escríbenos por WhatsApp» y competía
// con el registro como si fuera la forma de empezar. Decisión de Manolo: el
// camino principal es crear la cuenta; WhatsApp queda para resolver dudas. Por
// eso el texto habla de dudas y no de «empezar» ni de «quiero Kora».
const WA_URL = waLink("Hola, tengo una duda sobre Kora para mi hotel");
const ETIQUETA = "¿Dudas? Escríbenos por WhatsApp";

export function BotonWhatsApp() {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Magnetic pull on hover
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18 });
  const springY = useSpring(y, { stiffness: 200, damping: 18 });

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(timer);
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.35);
    y.set((e.clientY - cy) * 0.35);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
    setHovered(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg bg-[#25D366] hover:bg-[#1da851] w-14 h-14 md:w-16 md:h-16"
          aria-label={ETIQUETA}
          style={{ x: springX, y: springY }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={handleMouseLeave}
        >
          <MessageCircle size={28} className="text-white" aria-hidden="true" />

          <AnimatePresence>
            {hovered && (
              <motion.span
                className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap pointer-events-none"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.15 }}
                role="tooltip"
              >
                {ETIQUETA}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
