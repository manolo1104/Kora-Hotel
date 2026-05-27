"use client";

import { motion, useMotionValue, useMotionTemplate } from "motion/react";
import { ArrowRight, MessageCircle } from "lucide-react";

const EASE = [0.23, 1, 0.32, 1] as const;

function item(delay: number) {
  return {
    initial: { opacity: 0, transform: "translateY(24px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.55, delay, ease: EASE },
  };
}

function HotelIllustration() {
  return (
    <div className="relative select-none">
      <svg
        viewBox="0 0 500 460"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        aria-hidden="true"
      >
        <circle cx="250" cy="230" r="200" fill="#1B4332" fillOpacity="0.06" />
        <circle cx="250" cy="230" r="155" fill="#1B4332" fillOpacity="0.08" />

        <path d="M32 355 L72 250 L112 355Z" fill="#1B4332" fillOpacity="0.22" />
        <path d="M58 355 L103 228 L148 355Z" fill="#1B4332" fillOpacity="0.3" />
        <path d="M352 355 L392 235 L432 355Z" fill="#1B4332" fillOpacity="0.22" />
        <path d="M372 355 L417 215 L462 355Z" fill="#1B4332" fillOpacity="0.3" />

        <rect x="158" y="188" width="184" height="167" rx="3" fill="#1B4332" />
        <path d="M135 188 L250 112 L365 188Z" fill="#163527" />
        <rect x="244" y="103" width="12" height="11" rx="2" fill="#52B788" fillOpacity="0.85" />

        <rect x="178" y="212" width="24" height="20" rx="2" fill="#52B788" fillOpacity="0.7" />
        <rect x="214" y="212" width="24" height="20" rx="2" fill="#FAFAF8" fillOpacity="0.85" />
        <rect x="250" y="212" width="24" height="20" rx="2" fill="#52B788" fillOpacity="0.7" />
        <rect x="286" y="212" width="24" height="20" rx="2" fill="#FAFAF8" fillOpacity="0.85" />
        <rect x="322" y="212" width="16" height="20" rx="2" fill="#52B788" fillOpacity="0.5" />

        <rect x="178" y="248" width="24" height="20" rx="2" fill="#FAFAF8" fillOpacity="0.85" />
        <rect x="214" y="248" width="24" height="20" rx="2" fill="#52B788" fillOpacity="0.7" />
        <rect x="250" y="248" width="24" height="20" rx="2" fill="#FAFAF8" fillOpacity="0.85" />
        <rect x="286" y="248" width="24" height="20" rx="2" fill="#52B788" fillOpacity="0.7" />
        <rect x="322" y="248" width="16" height="20" rx="2" fill="#FAFAF8" fillOpacity="0.6" />

        <rect x="178" y="284" width="24" height="20" rx="2" fill="#52B788" fillOpacity="0.7" />
        <rect x="214" y="284" width="24" height="20" rx="2" fill="#FAFAF8" fillOpacity="0.85" />
        <rect x="286" y="284" width="24" height="20" rx="2" fill="#FAFAF8" fillOpacity="0.85" />
        <rect x="322" y="284" width="16" height="20" rx="2" fill="#52B788" fillOpacity="0.5" />

        <rect x="228" y="308" width="44" height="47" rx="22" fill="#52B788" fillOpacity="0.9" />

        <rect x="40" y="355" width="420" height="58" rx="4" fill="#1B4332" fillOpacity="0.06" />
        <path d="M250 355 L228 413 L272 413Z" fill="#1B4332" fillOpacity="0.1" />

        <ellipse cx="100" cy="298" rx="28" ry="78" fill="#52B788" fillOpacity="0.38" />
        <ellipse cx="108" cy="310" rx="22" ry="63" fill="#1B4332" fillOpacity="0.6" />
        <ellipse cx="400" cy="292" rx="28" ry="82" fill="#52B788" fillOpacity="0.38" />
        <ellipse cx="392" cy="304" rx="22" ry="67" fill="#1B4332" fillOpacity="0.6" />

        <circle cx="175" cy="145" r="2.5" fill="#52B788" fillOpacity="0.55" />
        <circle cx="320" cy="135" r="1.8" fill="#52B788" fillOpacity="0.4" />
        <circle cx="140" cy="178" r="1.8" fill="#52B788" fillOpacity="0.3" />
        <circle cx="358" cy="162" r="2.2" fill="#52B788" fillOpacity="0.45" />
      </svg>

      {/* Floating notification — bobs slowly (CSS, off main thread) */}
      <div
        className="animate-float absolute top-6 right-0 xl:-right-4 bg-white rounded-2xl shadow-md border border-gray-100 px-3 py-2.5 flex items-center gap-2.5 w-48"
        aria-hidden="true"
      >
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
          <MessageCircle size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-kora-text leading-tight">Nueva reserva</p>
          <p className="text-xs text-kora-muted truncate">Suite Jardín · WhatsApp</p>
        </div>
      </div>

      {/* Floating metric — slightly different phase */}
      <div
        className="animate-float-delayed absolute bottom-12 left-0 xl:-left-4 bg-kora-primary rounded-2xl shadow-md px-4 py-3 text-white"
        aria-hidden="true"
      >
        <p className="text-[10px] font-semibold text-kora-accent uppercase tracking-widest">
          Reservas directas
        </p>
        <p className="text-2xl font-bold text-white leading-none mt-0.5">+40%</p>
        <p className="text-[10px] text-kora-accent mt-0.5">vs OTAs este mes</p>
      </div>
    </div>
  );
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
        {/* Ambient cursor glow — off main thread via MotionValue */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-0 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-center">

            <div className="space-y-7">
              <motion.h1 {...item(0)} className="text-4xl sm:text-5xl xl:text-[3.5rem] font-bold tracking-tight text-kora-text leading-tight">
                Tu hotel lleno.{" "}
                <span className="text-shimmer text-kora-primary">
                  Sin depender de Booking.
                </span>
              </motion.h1>

              <motion.p {...item(0.12)} className="text-base sm:text-lg text-kora-muted leading-relaxed max-w-[52ch]">
                Kora es el sistema todo-en-uno que gestiona tu hotel, responde
                WhatsApps a las 2 AM, toma reservas directo y te dice
                exactamente qué está pasando con tu ocupación. Todo en español.
              </motion.p>

              <motion.div {...item(0.22)} className="flex flex-col sm:flex-row gap-3">
                <a
                  href="#contacto"
                  className="btn-press btn-arrow inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Ver demo en vivo
                  <ArrowRight size={16} />
                </a>
                <a
                  href="#contacto"
                  className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
                >
                  Solicitar acceso anticipado
                </a>
              </motion.div>

              <motion.div {...item(0.32)} className="space-y-3 pt-1">
                <p className="text-sm text-kora-muted">
                  Ya usado en{" "}
                  <span className="font-semibold text-kora-text">
                    Hotel Paraíso Encantado
                  </span>{" "}
                  · Xilitla, SLP
                </p>
                <div className="animate-pulse-ring inline-flex items-center gap-2 bg-[#1B4332]/8 text-kora-primary px-4 py-2 rounded-full text-sm font-medium">
                  <span className="text-kora-accent font-bold text-base leading-none">★</span>
                  Ahorra hasta $12,000 MXN/mes en comisiones de OTAs
                </div>
              </motion.div>
            </div>

            <motion.div
              className="hidden lg:block"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            >
              <HotelIllustration />
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}
