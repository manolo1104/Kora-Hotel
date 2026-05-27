"use client";

import { motion } from "motion/react";

interface CoverImageProps {
  src: string;
  alt: string;
}

export function CoverImage({ src, alt }: CoverImageProps) {
  return (
    <motion.div
      className="w-full overflow-hidden bg-gray-100"
      style={{ maxHeight: 480 }}
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      animate={{ clipPath: "inset(0 0 0% 0)" }}
      transition={{ duration: 0.85, ease: [0.77, 0, 0.175, 1], delay: 0.05 }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full object-cover"
        style={{ aspectRatio: "21/9", maxHeight: 480 }}
        loading="eager"
      />
    </motion.div>
  );
}
