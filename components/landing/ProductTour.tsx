"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useInView,
  useScroll,
  useSpring,
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
// usuario. En móvil cae a la versión apilada (paso → mockup).

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

/** Un paso de la columna izquierda: avisa cuando cruza el centro del viewport. */
function Paso({
  paso,
  activo,
  onActivo,
}: {
  paso: (typeof PASOS)[number];
  activo: boolean;
  onActivo: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Franja de detección: el centro exacto del viewport (sin scroll listeners).
  const enCentro = useInView(ref, { margin: "-50% 0px -50% 0px" });

  useEffect(() => {
    if (enCentro) onActivo();
  }, [enCentro, onActivo]);

  return (
    <div
      ref={ref}
      className={`min-h-[70vh] flex items-center transition-opacity duration-300 ${
        activo ? "opacity-100" : "opacity-40"
      }`}
    >
      <div className="pl-14 relative">
        <span
          className={`absolute left-0 top-1 text-sm font-bold tabular-nums transition-colors duration-300 ${
            activo ? "text-kora-accent" : "text-kora-muted/50"
          }`}
          aria-hidden="true"
        >
          {paso.num}
        </span>
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
    </div>
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

  const { Mockup } = PASOS[activo];

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
        {PASOS.map((p, i) => (
          <Paso key={p.id} paso={p} activo={i === activo} onActivo={() => setActivo(i)} />
        ))}
      </div>

      {/* Mockup pegajoso: se queda con el usuario mientras scrollea los pasos */}
      <div className="relative">
        <div className="sticky top-28 flex items-center" style={{ minHeight: "calc(100vh - 14rem)" }}>
          <div className="w-full max-w-md mx-auto">
            {reduce ? (
              <Mockup />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activo}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <Mockup />
                </motion.div>
              </AnimatePresence>
            )}
            {/* Indicador de pasos bajo el mockup */}
            <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
              {PASOS.map((p, i) => (
                <span
                  key={p.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activo ? "w-6 bg-kora-primary" : "w-1.5 bg-kora-primary/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Paso de texto en móvil: detecta cuándo cruza la franja de lectura. */
function PasoMovilTexto({
  paso,
  activo,
  onActivo,
}: {
  paso: (typeof PASOS)[number];
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
    <div
      ref={ref}
      className={`min-h-[45vh] flex items-center transition-opacity duration-300 ${
        activo ? "opacity-100" : "opacity-40"
      }`}
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
    </div>
  );
}

function TourMovil() {
  const [activo, setActivo] = useState(0);
  const reduce = useReducedMotion();
  const { Mockup } = PASOS[activo];

  return (
    <div>
      {/* Mockup pegajoso: se queda bajo la navbar y cambia mientras lees los pasos.
          El fondo con blur tapa el contenido que pasa por detrás. */}
      <div className="sticky top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 pt-3 pb-3 bg-kora-bg/95 backdrop-blur-sm">
        <div className="max-w-[330px] sm:max-w-[380px] mx-auto">
          {reduce ? (
            <Mockup />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activo}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <Mockup />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        {/* Indicador de pasos */}
        <div className="mt-2.5 flex items-center justify-center gap-2" aria-hidden="true">
          {PASOS.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activo ? "w-6 bg-kora-primary" : "w-1.5 bg-kora-primary/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Los pasos pasan por debajo del mockup */}
      <div className="pt-2">
        {PASOS.map((p, i) => (
          <PasoMovilTexto key={p.id} paso={p} activo={i === activo} onActivo={() => setActivo(i)} />
        ))}
      </div>
    </div>
  );
}

export function ProductTour() {
  // Render móvil por default (coincide con SSR); tras montar, desktop si aplica.
  // La sección vive bajo el fold, así que el swap no produce CLS visible.
  const [esDesktop, setEsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setEsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return esDesktop ? <TourDesktop /> : <TourMovil />;
}
