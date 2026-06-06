"use client";

import { motion, useMotionValue, useMotionTemplate } from "motion/react";
import { ArrowRight, Gift } from "lucide-react";
import { DashboardMockup } from "@/components/landing/ProductMockups";
import { LUGARES_DISPONIBLES, TOTAL_LUGARES, LANZAMIENTO } from "@/lib/oferta";

const EASE = [0.23, 1, 0.32, 1] as const;

function item(delay: number) {
  return {
    initial: { opacity: 0, transform: "translateY(24px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.55, delay, ease: EASE },
  };
}

export function Hero() {
  const mouseX = useMotionValue(400);
  const mouseY = useMotionValue(300);
  const background = useMotionTemplate`radial-gradient(600px at ${mouseX}px ${mouseY}px, rgba(82,183,136,0.07), transparent 65%)`;

  return (
    <>
      <div id="hero-sentinel" className="absolute top-32 pointer-events-none" aria-hidden="true" />

      <section
        className="relative min-h-[100dvh] flex items-center bg-kora-bg pt-16 overflow-x-hidden"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mouseX.set(e.clientX - rect.left);
          mouseY.set(e.clientY - rect.top);
        }}
      >
        {/* Aurora: gradiente animado sutil estilo Stripe (CSS, fuera del hilo principal) */}
        <div className="hero-aurora" aria-hidden="true">
          <div className="hero-aurora__blob hero-aurora__blob--1" />
          <div className="hero-aurora__blob hero-aurora__blob--2" />
        </div>

        {/* Ambient cursor glow — off main thread via MotionValue */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-0 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-center">

            <div className="space-y-6">
              <motion.p
                {...item(0)}
                className="text-xs sm:text-sm font-bold uppercase tracking-widest text-kora-primary/70"
              >
                Reservas directas + WhatsApp con IA
              </motion.p>

              <motion.h1 {...item(0.06)} className="text-4xl sm:text-5xl xl:text-[3.5rem] font-bold tracking-tight text-kora-text leading-tight">
                Tu hotel lleno.{" "}
                <span className="text-shimmer text-kora-primary">
                  Sin depender de Booking.
                </span>
              </motion.h1>

              <motion.p {...item(0.12)} className="text-base sm:text-lg text-kora-muted leading-relaxed max-w-[52ch]">
                Página web con reservas directas, un agente de WhatsApp con IA que
                cotiza y cierra reservas 24/7, y todo tu hotel en una sola pantalla.
                En español, con CFDI, sin comisiones.
              </motion.p>

              <motion.div {...item(0.2)} className="flex flex-col sm:flex-row gap-3">
                <a
                  href="#contacto"
                  className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Solicitar mi demo
                  <ArrowRight size={16} />
                </a>
                <a
                  href="#demo"
                  className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
                >
                  Ver demo en vivo (90 seg)
                </a>
              </motion.div>

              {/* Oferta secundaria: web gratis (degradada, debajo de los CTAs) */}
              <motion.a
                {...item(0.26)}
                href="#precios"
                className="inline-flex items-center gap-1.5 text-xs text-kora-muted hover:text-kora-primary transition-colors"
              >
                <Gift size={13} className="text-kora-accent flex-shrink-0" aria-hidden="true" />
                <span>
                  Bonus: sitio web profesional gratis para los primeros {TOTAL_LUGARES} hoteles
                  <span className="font-semibold"> · quedan {LUGARES_DISPONIBLES} de {TOTAL_LUGARES}</span>
                </span>
              </motion.a>

              <motion.div {...item(0.32)} className="space-y-3 pt-1">
                <p className="text-sm text-kora-muted">
                  Ya usado en{" "}
                  <span className="font-semibold text-kora-text">
                    Hotel Paraíso Encantado
                  </span>{" "}
                  · Xilitla, SLP
                </p>
                <p className="text-xs text-kora-muted">
                  Apenas comenzamos: abrimos los primeros {TOTAL_LUGARES}{" "}
                  lugares fundadores en {LANZAMIENTO}.
                </p>
                <div className="animate-pulse-ring inline-flex items-center gap-2 bg-[#1B4332]/8 text-kora-primary px-4 py-2 rounded-full text-sm font-medium">
                  <span className="text-kora-accent font-bold text-base leading-none">★</span>
                  Ahorra hasta $12,000 MXN/mes en comisiones de OTAs
                </div>
              </motion.div>
            </div>

            <motion.div
              className="hidden lg:block lg:pr-6 xl:pr-2"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            >
              <DashboardMockup />
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
