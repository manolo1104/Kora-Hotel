"use client";

import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useScroll,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { ArrowRight, Gift, Lock, FileCheck, Database } from "lucide-react";
import { BookingEngineMockup } from "@/components/landing/ProductMockups";
import { trackCta } from "@/lib/analytics";

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

  // Parallax sutil del mockup al hacer scroll (solo si el usuario acepta movimiento).
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const mockupY = useTransform(scrollY, [0, 600], [0, reduceMotion ? 0 : -40]);

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

        {/* Textura: grid de líneas con máscara radial + grano (cero JS) */}
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-noise" aria-hidden="true" />

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
                Reservas directas, sin comisión
              </motion.p>

              {/* Headline palabra por palabra con blur que se enfoca (Linear/Apple).
                  La frase shimmer entra como una sola unidad para no romper su gradiente. */}
              <h1 className="text-4xl sm:text-5xl xl:text-[3.5rem] font-bold tracking-tight text-kora-text leading-tight">
                {["Llena", "tu", "hotel", "con", "reservas", "directas."].map((palabra, i) => (
                  <motion.span
                    key={palabra}
                    className="inline-block whitespace-pre"
                    initial={
                      reduceMotion
                        ? false
                        : { opacity: 0, y: 16, filter: "blur(8px)" }
                    }
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.55, delay: 0.08 + i * 0.09, ease: EASE }}
                  >
                    {palabra}{" "}
                  </motion.span>
                ))}
                <motion.span
                  className="inline-block"
                  initial={
                    reduceMotion ? false : { opacity: 0, y: 16, filter: "blur(10px)" }
                  }
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.65, delay: 0.4, ease: EASE }}
                >
                  <span className="text-shimmer text-kora-primary">
                    Sin depender de Booking.
                  </span>
                </motion.span>
              </h1>

              <motion.p {...item(0.12)} className="text-base sm:text-lg text-kora-muted leading-relaxed max-w-[52ch]">
                Tu propia página de reservas con 0% de comisión, y cuando entra la
                reserva, Kora opera el resto: todo tu hotel en una sola pantalla.
                En español, con CFDI.
              </motion.p>

              <motion.div {...item(0.2)} className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/pago/iniciar?plan=kora"
                  onClick={() => trackCta("hero_pago")}
                  className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Empezar 30 días gratis
                  <ArrowRight size={16} />
                </a>
                <a
                  href="#demo-motor"
                  className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
                >
                  Probar el motor en vivo
                </a>
              </motion.div>

              {/* Alta self-service: entra directo al onboarding a cargar tu hotel */}
              <motion.a
                {...item(0.22)}
                href="/panel/onboarding"
                onClick={() => trackCta("hero_onboarding")}
                className="btn-press btn-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:text-kora-primary-dark transition-colors"
              >
                Empieza a cargar tu hotel ahora
                <ArrowRight size={15} aria-hidden="true" />
              </motion.a>

              {/* Señales de confianza honestas (tipo Stripe) */}
              <motion.ul
                {...item(0.24)}
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-kora-muted"
                aria-label="Señales de confianza"
              >
                <li className="inline-flex items-center gap-1.5">
                  <Lock size={12} className="text-kora-primary" aria-hidden="true" />
                  Pagos seguros con Stripe
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <FileCheck size={12} className="text-kora-primary" aria-hidden="true" />
                  CFDI 4.0 con el SAT
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Database size={12} className="text-kora-primary" aria-hidden="true" />
                  Tus datos son tuyos, exportables
                </li>
              </motion.ul>

              {/* Oferta secundaria: servicio de sitio web (degradada, debajo de los CTAs) */}
              <motion.a
                {...item(0.26)}
                href="#precios"
                className="inline-flex items-center gap-1.5 text-xs text-kora-muted hover:text-kora-primary transition-colors"
              >
                <Gift size={13} className="text-kora-accent flex-shrink-0" aria-hidden="true" />
                <span>
                  ¿Sin página web? Te creamos una con tu motor de reservas
                  <span className="font-semibold"> · servicio aparte</span>
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
                  30 días gratis, sin compromiso: pruébalo con tu hotel y el
                  primer cobro es hasta el día 31 (cancela antes y no pagas).
                </p>
                <div className="animate-pulse-ring inline-flex items-center gap-2 bg-[#1B4332]/8 text-kora-primary px-4 py-2 rounded-full text-sm font-medium">
                  <span className="text-kora-accent font-bold text-base leading-none">★</span>
                  Ahorra hasta $12,000 MXN/mes en comisiones de OTAs
                </div>
              </motion.div>
            </div>

            {/* Mockup del producto: visible también en móvil (es el "wow" del sitio).
                En desktop hace un parallax sutil al scrollear. */}
            <motion.div
              className="pt-2 lg:pt-0 lg:pr-6 xl:pr-2"
              style={{ y: mockupY }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            >
              <BookingEngineMockup />
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
