"use client";

import { motion } from "motion/react";

interface CoverImageProps {
  src: string;
  alt: string;
}

export function CoverImage({ src, alt }: CoverImageProps) {
  return (
    <motion.div
      // Proporción FIJA, no un max-height: con `maxHeight` la caja se volvía más
      // y más panorámica entre más ancha la pantalla (3:1 a 1440px, 5:1 en un
      // monitor grande) y se comía la portada. Las portadas de /blog/portadas
      // se diseñan contra esta banda de 3:1 — si cambia aquí, hay que cambiar
      // SEGURO en scripts/portadas-blog/render.py.
      className="mx-auto w-full max-w-[1920px] overflow-hidden bg-gray-100 aspect-[16/9] sm:aspect-[3/1]"
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      animate={{ clipPath: "inset(0 0 0% 0)" }}
      transition={{ duration: 0.85, ease: [0.77, 0, 0.175, 1], delay: 0.05 }}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        loading="eager"
      />
    </motion.div>
  );
}
