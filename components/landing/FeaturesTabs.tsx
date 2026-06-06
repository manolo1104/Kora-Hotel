"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Globe, LayoutDashboard, TrendingUp, BarChart2, ArrowRight } from "lucide-react";
import {
  ReservaMockup,
  PMSMockup,
  PricingMockup,
  DashboardMockup,
} from "@/components/caracteristicas/Mockups";

const EASE = [0.16, 1, 0.3, 1] as const;

const tabs = [
  {
    id: "motor-reservas",
    label: "Reservas",
    Icon: Globe,
    title: "Reservas directas, sin comisiones",
    desc: "Tu propio motor de reservas conectado a tu web. El huésped reserva y paga sin pasar por Booking ni Airbnb. Te quedas con el 100%.",
    Mockup: ReservaMockup,
  },
  {
    id: "pms",
    label: "PMS",
    Icon: LayoutDashboard,
    title: "Tu hotel en una sola pantalla",
    desc: "Mapa de habitaciones en tiempo real, check-in y check-out digital, y housekeeping coordinado. Se acabaron el cuaderno y el Excel.",
    Mockup: PMSMockup,
  },
  {
    id: "pricing-dinamico",
    label: "Precios con IA",
    Icon: TrendingUp,
    title: "Precios que se ajustan solos",
    desc: "Kora sube y baja tus tarifas según la demanda, los puentes y los eventos locales. Sin contratar un revenue manager.",
    Mockup: PricingMockup,
  },
  {
    id: "dashboard",
    label: "Panel",
    Icon: BarChart2,
    title: "Las métricas que de verdad importan",
    desc: "Ocupación, RevPAR y forecast a 30 días, más el CRM con el historial de cada huésped. Todo en una pantalla.",
    Mockup: DashboardMockup,
  },
];

export function FeaturesTabs() {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const { Mockup } = current;

  return (
    <div>
      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-10">
        {tabs.map(({ id, label, Icon }) => {
          const on = id === active;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              aria-pressed={on}
              className={`btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                on
                  ? "bg-kora-primary text-white"
                  : "bg-white border border-gray-200 text-kora-text hover:border-kora-primary/40"
              }`}
            >
              <Icon size={15} className={on ? "text-kora-accent" : "text-kora-primary"} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Contenido de la pestaña activa */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        >
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-kora-text leading-tight">
              {current.title}
            </h3>
            <p className="mt-4 text-kora-muted text-base leading-relaxed max-w-lg">
              {current.desc}
            </p>
            <Link
              href={`/caracteristicas#${current.id}`}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:gap-2.5 transition-all"
            >
              Ver cómo funciona
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="max-w-sm mx-auto w-full">
            <Mockup />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
