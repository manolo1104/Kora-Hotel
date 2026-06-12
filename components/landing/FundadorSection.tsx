"use client";

import { useState } from "react";
import { Quote } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { FUNDADOR } from "@/lib/fundador";

// Iconos de marca (lucide ya no los incluye).
function LinkedinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.12-1.38 5.86 5.86 0 0 0 1.38-2.12c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.12A5.86 5.86 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" />
    </svg>
  );
}

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function FundadorSection() {
  const [imgError, setImgError] = useState(false);

  return (
    <section id="fundador" className="py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-10 md:gap-12 items-center">
          {/* Foto + redes */}
          <Reveal>
            <div className="flex flex-col items-center text-center">
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden bg-kora-primary shadow-lg">
                {!imgError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={FUNDADOR.foto}
                    alt={`Foto de ${FUNDADOR.nombre}`}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-5xl font-bold">
                    {iniciales(FUNDADOR.nombre)}
                  </div>
                )}
              </div>

              <p className="mt-4 text-lg font-bold text-kora-text">
                {FUNDADOR.nombre}
              </p>
              <p className="text-sm text-kora-muted">{FUNDADOR.rol}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kora-accent/15 text-kora-primary text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-kora-accent" aria-hidden="true" />
                Hotelero en activo · Hotel Paraíso Encantado, Xilitla SLP
              </span>

              <div className="mt-4 flex items-center gap-3">
                <a
                  href={FUNDADOR.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn de Manolo"
                  className="btn-press w-10 h-10 rounded-full border border-kora-primary/20 flex items-center justify-center text-kora-primary hover:bg-kora-primary hover:text-white transition-colors"
                >
                  <LinkedinIcon size={18} />
                </a>
                <a
                  href={FUNDADOR.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram de Manolo"
                  className="btn-press w-10 h-10 rounded-full border border-kora-primary/20 flex items-center justify-center text-kora-primary hover:bg-kora-primary hover:text-white transition-colors"
                >
                  <InstagramIcon size={18} />
                </a>
              </div>
            </div>
          </Reveal>

          {/* Porqué + problema */}
          <Reveal delay={0.1}>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kora-accent/15 text-kora-primary text-xs font-bold mb-4">
                Por qué hago esto
              </span>
              <Quote
                size={32}
                className="text-kora-accent/40 mb-2"
                aria-hidden="true"
              />

              <p className="text-xl sm:text-2xl font-semibold text-kora-text leading-snug mb-5">
                &ldquo;Diseñé Kora para mi propio hotel porque no encontré nada
                que realmente funcionara para hoteles como el nuestro.&rdquo;
              </p>

              <div className="space-y-4">
                {FUNDADOR.porque.map((parrafo, i) => (
                  <p
                    key={i}
                    className="text-base sm:text-lg text-kora-text leading-relaxed"
                  >
                    {parrafo}
                  </p>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border-l-4 border-kora-accent bg-kora-bg px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-kora-primary mb-1">
                  El problema que quiero resolver
                </p>
                <p className="text-base sm:text-lg font-semibold text-kora-text leading-snug">
                  {FUNDADOR.problema}
                </p>
              </div>

              <p className="mt-5 text-sm text-kora-muted leading-relaxed">
                {FUNDADOR.lanzamiento}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
