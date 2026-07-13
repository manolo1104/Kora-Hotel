"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { Globe, LayoutDashboard, BarChart2, ArrowRight } from "lucide-react";
import {
  ReservaMockup,
  PMSMockup,
  DashboardMockup,
} from "@/components/caracteristicas/Mockups";

const EASE = [0.23, 1, 0.32, 1] as const;

// Tour de producto scroll-driven (patrón Stripe/Linear): en desktop el mockup
// queda fijo mientras los pasos hacen scroll y un rail de progreso sigue al
// usuario. En móvil cae a la versión apilada (mockup pegajoso → pasos).
// Ambas variantes viven en el DOM y se eligen por CSS (hidden lg:block): así
// SSR y cliente pintan lo mismo y no hay remount al hidratar.

const PASOS = [
  {
    id: "motor-reservas",
    num: "01",
    label: "Reservas",
    Icon: Globe,
    title: "Reservas directas, sin comisiones",
    desc: "Tu propio motor en tu web: el huésped elige fechas en un calendario con disponibilidad real, paga con tarjeta u OXXO —o deja garantía y paga al llegar— y la reserva cae confirmada en tu panel. Te quedas con el 100% del dinero y con los datos de tu huésped.",
    Mockup: ReservaMockup,
    demoHref: "#demo-motor",
  },
  {
    id: "pms",
    num: "02",
    label: "PMS",
    Icon: LayoutDashboard,
    title: "Tu hotel en una sola pantalla",
    desc: "Mapa de habitaciones en tiempo real, check-in y check-out digital, y housekeeping coordinado. Se acabaron el cuaderno y el Excel.",
    Mockup: PMSMockup,
    demoHref: null,
  },
  {
    id: "dashboard",
    num: "03",
    label: "Panel",
    Icon: BarChart2,
    title: "Las métricas que de verdad importan",
    desc: "Ocupación, RevPAR y forecast a 30 días, más el CRM con el historial de cada huésped. Todo en una pantalla.",
    Mockup: DashboardMockup,
    demoHref: null,
  },
];

/** Los 3 mockups apilados en la misma celda de grid: nunca se desmontan (sus
    micro-loops internos siguen vivos) y el contenedor mide siempre el más
    alto, así el cambio de paso no salta de altura bajo el sticky. El inactivo
    sale con profundidad (y + scale + rotateX) hacia donde ya pasó el scroll. */
function EscenarioMockups({ activo }: { activo: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid" style={{ perspective: 1200 }}>
      {/* Halo ambiental que acompaña al paso (el blur es CSS estático;
          solo se animan transform y opacity) */}
      <motion.div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-kora-accent/25 via-kora-primary/10 to-transparent blur-2xl"
        initial={false}
        animate={
          reduce
            ? { opacity: 0.5 }
            : { opacity: 0.45 + activo * 0.12, x: (activo - 1) * 18, rotate: (activo - 1) * 2 }
        }
        transition={{ duration: 0.8, ease: EASE }}
      />
      {PASOS.map((p, i) => {
        const esActivo = i === activo;
        // Lo ya recorrido sale hacia arriba; lo que viene espera abajo.
        const dir = i < activo ? -1 : 1;
        return (
          <motion.div
            key={p.id}
            className={`[grid-area:1/1] ${esActivo ? "" : "pointer-events-none"}`}
            style={{ transformStyle: "preserve-3d" }}
            initial={false}
            animate={
              reduce
                ? { opacity: esActivo ? 1 : 0 }
                : {
                    opacity: esActivo ? 1 : 0,
                    y: esActivo ? 0 : dir * 28,
                    scale: esActivo ? 1 : 0.96,
                    rotateX: esActivo ? 0 : dir * -5,
                  }
            }
            transition={{ duration: 0.55, ease: EASE }}
            aria-hidden={!esActivo}
          >
            <p.Mockup />
          </motion.div>
        );
      })}
    </div>
  );
}

/** Tabs con píldora deslizante: indican el paso activo y navegan hacia él. */
function TourTabs({
  activo,
  idPrefix,
  className = "mt-5",
  scrollBlock = "center",
}: {
  activo: number;
  idPrefix: string;
  className?: string;
  scrollBlock?: ScrollLogicalPosition;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={`flex justify-center ${className}`}>
      <div
        role="tablist"
        aria-label="Pasos del tour"
        className="flex items-center gap-1 rounded-full border border-kora-primary/10 bg-white/70 p-1 backdrop-blur-sm"
      >
        {PASOS.map((p, i) => {
          const on = i === activo;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() =>
                document
                  .getElementById(`tour-paso-${idPrefix}-${p.id}`)
                  ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: scrollBlock })
              }
              className={`relative rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                on ? "text-white" : "text-kora-muted hover:text-kora-text"
              }`}
            >
              {on && (
                <motion.span
                  layoutId={`tour-tab-${idPrefix}`}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-kora-primary"
                  transition={
                    reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }
                  }
                />
              )}
              <span className="relative z-10 tabular-nums">
                {p.num} · {p.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Un paso de la columna izquierda: avisa cuando cruza el centro del viewport. */
function Paso({
  paso,
  idDom,
  activo,
  onActivo,
}: {
  paso: (typeof PASOS)[number];
  idDom: string;
  activo: boolean;
  onActivo: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // Franja de detección: el centro exacto del viewport (sin scroll listeners).
  const enCentro = useInView(ref, { margin: "-50% 0px -50% 0px" });

  useEffect(() => {
    if (enCentro) onActivo();
  }, [enCentro, onActivo]);

  return (
    <motion.div
      ref={ref}
      id={idDom}
      className="min-h-[70vh] flex items-center"
      initial={false}
      animate={{ opacity: activo ? 1 : 0.35, x: activo || reduce ? 0 : -6 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="pl-14 relative">
        {/* El número es el nodo del rail: un chip circular sobre la línea */}
        <motion.span
          className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border bg-kora-bg text-sm font-bold tabular-nums"
          initial={false}
          animate={{
            scale: reduce ? 1 : activo ? 1.08 : 1,
            color: activo ? "#52B788" : "rgba(107,114,128,0.6)",
            borderColor: activo ? "rgba(82,183,136,0.6)" : "rgba(27,67,50,0.12)",
          }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 26 }}
          aria-hidden="true"
        >
          {paso.num}
        </motion.span>
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-3">
          <paso.Icon size={14} className="text-kora-primary" aria-hidden="true" />
          {paso.label}
        </p>
        <h3 className="text-2xl xl:text-3xl font-bold tracking-tight text-kora-text leading-tight">
          {paso.title}
        </h3>
        <p className="mt-4 text-kora-muted text-base leading-relaxed max-w-lg">{paso.desc}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          {paso.demoHref && (
            <a
              href={paso.demoHref}
              className="btn-arrow inline-flex items-center gap-1.5 text-sm font-bold text-kora-primary hover:text-kora-primary-dark transition-colors"
            >
              Probar el motor en vivo
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          )}
          <Link
            href={`/caracteristicas#${paso.id}`}
            className="btn-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:text-kora-primary-dark transition-colors"
          >
            Ver cómo funciona
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function TourDesktop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(0);
  const reduce = useReducedMotion();

  // Rail de progreso: se rellena siguiendo el scroll del usuario por la sección.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });
  const progreso = useSpring(scrollYProgress, { stiffness: 140, damping: 28 });
  // Punta luminosa que recorre el rail (un solo nodo absoluto).
  const puntaTop = useTransform(progreso, (v) => `${Math.min(100, Math.max(0, v * 100))}%`);
  // El escenario "flota" con el scroll dentro del sticky (profundidad Apple).
  const yFloat = useTransform(scrollYProgress, [0, 1], [24, -24]);
  const tilt = useTransform(scrollYProgress, [0, 1], [2.5, -2.5]);

  return (
    <div ref={containerRef} className="relative grid grid-cols-2 gap-16">
      {/* Columna de pasos con rail de progreso */}
      <div className="relative">
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-kora-primary/10" aria-hidden="true" />
        <motion.div
          className="absolute left-[18px] top-0 bottom-0 w-px bg-kora-accent origin-top"
          style={{ scaleY: reduce ? 1 : progreso }}
          aria-hidden="true"
        />
        {!reduce && (
          <motion.div
            className="absolute left-[18px] -ml-1 h-2 w-2 rounded-full bg-kora-accent shadow-[0_0_12px_rgba(82,183,136,0.9)]"
            style={{ top: puntaTop }}
            aria-hidden="true"
          />
        )}
        {PASOS.map((p, i) => (
          <Paso
            key={p.id}
            paso={p}
            idDom={`tour-paso-d-${p.id}`}
            activo={i === activo}
            onActivo={() => setActivo(i)}
          />
        ))}
      </div>

      {/* Mockup pegajoso: se queda con el usuario mientras scrollea los pasos */}
      <div className="relative">
        <div className="sticky top-28 flex items-center" style={{ minHeight: "calc(100vh - 14rem)" }}>
          <div className="w-full max-w-md mx-auto">
            <motion.div
              style={reduce ? undefined : { y: yFloat, rotateX: tilt, transformPerspective: 1200 }}
            >
              <EscenarioMockups activo={activo} />
            </motion.div>
            <TourTabs activo={activo} idPrefix="d" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Paso de texto en móvil: detecta cuándo cruza la franja de lectura. */
function PasoMovilTexto({
  paso,
  idDom,
  activo,
  onActivo,
}: {
  paso: (typeof PASOS)[number];
  idDom: string;
  activo: boolean;
  onActivo: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // La franja de detección va bajo el mockup pegajoso (mitad inferior de la pantalla).
  const enCentro = useInView(ref, { margin: "-60% 0px -25% 0px" });

  useEffect(() => {
    if (enCentro) onActivo();
  }, [enCentro, onActivo]);

  return (
    <motion.div
      ref={ref}
      id={idDom}
      className="min-h-[45vh] flex items-center"
      initial={false}
      animate={{ opacity: activo ? 1 : 0.4 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <div>
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-2">
          <span className={`font-bold tabular-nums ${activo ? "text-kora-accent" : "text-kora-muted/60"}`}>
            {paso.num}
          </span>
          <paso.Icon size={14} className="text-kora-primary" aria-hidden="true" />
          {paso.label}
        </p>
        <h3 className="text-2xl font-bold tracking-tight text-kora-text leading-tight">
          {paso.title}
        </h3>
        <p className="mt-3 text-kora-muted text-base leading-relaxed">{paso.desc}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {paso.demoHref && (
            <a
              href={paso.demoHref}
              className="btn-arrow inline-flex items-center gap-1.5 text-sm font-bold text-kora-primary"
            >
              Probar el motor en vivo
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          )}
          <Link
            href={`/caracteristicas#${paso.id}`}
            className="btn-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary"
          >
            Ver cómo funciona
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function TourMovil() {
  const [activo, setActivo] = useState(0);

  return (
    <div>
      {/* Mockup pegajoso: se queda bajo la navbar y cambia mientras lees los pasos.
          El fondo con blur tapa el contenido que pasa por detrás. */}
      <div className="sticky top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-3 pb-3 bg-kora-bg/95 backdrop-blur-sm">
        <div className="max-w-[330px] sm:max-w-[380px] mx-auto">
          <EscenarioMockups activo={activo} />
        </div>
        {/* Con el mockup pegado arriba, el paso tocado debe quedar en la franja
            de lectura (mitad inferior) → block: "end". */}
        <TourTabs activo={activo} idPrefix="m" className="mt-2.5" scrollBlock="end" />
      </div>

      {/* Los pasos pasan por debajo del mockup */}
      <div className="pt-2">
        {PASOS.map((p, i) => (
          <PasoMovilTexto
            key={p.id}
            paso={p}
            idDom={`tour-paso-m-${p.id}`}
            activo={i === activo}
            onActivo={() => setActivo(i)}
          />
        ))}
      </div>
    </div>
  );
}

export function ProductTour() {
  // Variantes desktop/móvil elegidas por CSS: cero JS de breakpoint, cero
  // remount al hidratar. El árbol oculto queda inerte (useInView no
  // intersecta elementos con display:none).
  return (
    <>
      <div className="hidden lg:block">
        <TourDesktop />
      </div>
      <div className="lg:hidden">
        <TourMovil />
      </div>
    </>
  );
}
