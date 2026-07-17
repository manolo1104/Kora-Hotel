"use client";

// Wrapper de next/image para las fotos de los hoteles (portadas, habitaciones,
// experiencias, add-ons). Centraliza los defaults para que TODAS las imágenes
// públicas se sirvan optimizadas (WebP/AVIF por dispositivo), diferidas por
// defecto y sin salto de layout. Sobre un esqueleto gris con pulso mientras
// carga → sensación "instantánea".
//
// Uso: el className controla el TAMAÑO de la caja (la imagen la llena con
// object-cover). El contenedor ya queda `relative`, así que `fill` funciona sin
// que quien lo usa tenga que posicionar nada.
//
//   <HotelImage src={url} alt="" className="h-14 w-14 rounded-lg" sizes="56px" />
//   <HotelImage src={cover} alt="" className="h-full w-full" priority />

import Image from "next/image";

export function HotelImage({
  src,
  alt,
  className = "",
  sizes = "(max-width: 640px) 100vw, 400px",
  priority = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  /** Ayuda a next/image a elegir el tamaño exacto por dispositivo (menos bytes). */
  sizes?: string;
  /** true solo para la imagen más importante de la página (hero/portada, el LCP). */
  priority?: boolean;
}) {
  if (!src) return null;
  return (
    <span className={`relative block overflow-hidden bg-gray-100 ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-cover"
      />
    </span>
  );
}
