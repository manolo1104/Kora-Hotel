"use client";

import { motion, useReducedMotion } from "motion/react";
import { CountUp } from "@/components/shared/CountUp";
import { WindowFrame } from "@/components/landing/ProductMockups";

// Mockups de la página de características. Comparten el mismo marco visual
// ("ventana de app" con WindowFrame) que los mockups del inicio, para que todo
// el sitio se sienta cohesivo. Se animan al entrar en pantalla y respetan
// prefers-reduced-motion.

// El agente de WhatsApp reutiliza EXACTAMENTE el mismo mockup del inicio
// (misma marca, mismo chat dinámico) para no tener dos diseños distintos.
export { WhatsAppMockup } from "@/components/landing/ProductMockups";

const VIEWPORT = { once: true, amount: 0.4 } as const;
const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Motor de reservas ─────────────────────────────────────────────────────────

export function ReservaMockup() {
  const reduce = useReducedMotion();
  const row = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          whileInView: { opacity: 1, y: 0 },
          viewport: VIEWPORT,
          transition: { duration: 0.4, delay, ease: EASE },
        };

  return (
    <WindowFrame title="Motor de reservas">
      <div className="p-5 space-y-3">
        <motion.div {...row(0)} className="flex justify-between items-center">
          <p className="text-xs font-semibold text-kora-text">Check-in</p>
          <span className="text-xs bg-kora-bg border border-gray-200 rounded-lg px-3 py-1.5 text-kora-text">
            Vie 6 jun
          </span>
        </motion.div>
        <motion.div {...row(0.08)} className="flex justify-between items-center">
          <p className="text-xs font-semibold text-kora-text">Check-out</p>
          <span className="text-xs bg-kora-bg border border-gray-200 rounded-lg px-3 py-1.5 text-kora-text">
            Dom 8 jun
          </span>
        </motion.div>
        <motion.div {...row(0.16)} className="flex justify-between items-center">
          <p className="text-xs font-semibold text-kora-text">Habitación</p>
          <span className="text-xs bg-kora-bg border border-gray-200 rounded-lg px-3 py-1.5 text-kora-text">
            Suite Jardín
          </span>
        </motion.div>
        <motion.div {...row(0.26)} className="pt-1">
          <div className="w-full py-2.5 rounded-full bg-kora-accent text-center text-xs font-bold text-kora-primary">
            Reservar ahora · $2,400 MXN
          </div>
        </motion.div>
      </div>
    </WindowFrame>
  );
}

// ─── PMS ────────────────────────────────────────────────────────────────────────

export function PMSMockup() {
  const reduce = useReducedMotion();
  const habitaciones = [
    { num: "101", estado: "libre", nombre: "Std Norte" },
    { num: "102", estado: "ocupada", nombre: "Std Sur" },
    { num: "103", estado: "limpieza", nombre: "Std Vista" },
    { num: "201", estado: "libre", nombre: "Suite Jardín" },
    { num: "202", estado: "ocupada", nombre: "Suite Patio" },
    { num: "301", estado: "libre", nombre: "Cabaña" },
  ];
  const color: Record<string, string> = {
    libre: "bg-kora-accent/20 text-kora-primary border-kora-accent/40",
    ocupada: "bg-kora-primary text-white border-kora-primary",
    limpieza: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const tile = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, scale: 0.8 },
          whileInView: { opacity: 1, scale: 1 },
          viewport: VIEWPORT,
          transition: { duration: 0.35, delay: i * 0.06, ease: EASE },
        };

  return (
    <WindowFrame title="Mapa de habitaciones">
      <div className="p-5">
        <div className="grid grid-cols-3 gap-2">
          {habitaciones.map((h, i) => (
            <motion.div
              key={h.num}
              {...tile(i)}
              className={`border rounded-xl p-2.5 text-center ${color[h.estado]}`}
            >
              <p className="text-base font-bold leading-none">{h.num}</p>
              <p className="text-[9px] mt-1 leading-tight opacity-80">{h.nombre}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 text-[10px] text-kora-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-kora-accent" />
            Libre
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-kora-primary" />
            Ocupada
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Limpieza
          </span>
        </div>
      </div>
    </WindowFrame>
  );
}

// ─── Pricing dinámico ───────────────────────────────────────────────────────────

export function PricingMockup() {
  const reduce = useReducedMotion();
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  const prices = [980, 1050, 1020, 1100, 1450, 1800, 1650];
  const max = Math.max(...prices);
  const bar = (i: number, pct: number) =>
    reduce
      ? { style: { height: `${pct}%` } }
      : {
          style: { height: `${pct}%`, transformOrigin: "bottom" as const },
          initial: { scaleY: 0 },
          whileInView: { scaleY: 1 },
          viewport: VIEWPORT,
          transition: { duration: 0.5, delay: i * 0.07, ease: EASE },
        };

  return (
    <WindowFrame title="Pricing dinámico">
      <div className="p-5">
        <div className="flex justify-between items-baseline mb-4">
          <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
            Pricing esta semana
          </p>
          <span className="text-xs font-bold text-kora-accent">+18% RevPAR</span>
        </div>
        <div className="flex items-end gap-1.5">
          {days.map((day, i) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              {/* Riel de altura FIJA (h-24) para que el % de la barra siempre resuelva */}
              <div className="w-full h-24 flex items-end">
                <motion.div
                  {...bar(i, (prices[i] / max) * 100)}
                  className={`w-full rounded-md ${i >= 4 ? "bg-kora-primary" : "bg-kora-accent/40"}`}
                />
              </div>
              <span className="text-[9px] text-kora-muted font-medium">{day}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-kora-muted leading-tight">
          Finde detectado · precios ajustados automáticamente
        </p>
      </div>
    </WindowFrame>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────

export function DashboardMockup() {
  const metrics = [
    { label: "Ocupación", to: 74, suffix: "%", prefix: "", color: "text-kora-primary" },
    { label: "RevPAR", to: 892, suffix: "", prefix: "$", color: "text-kora-primary" },
    { label: "ADR", to: 1205, suffix: "", prefix: "$", color: "text-kora-text" },
    { label: "Res. directas", to: 61, suffix: "%", prefix: "", color: "text-kora-accent" },
  ];

  return (
    <WindowFrame title="Panel y métricas">
      <div className="p-5">
        <div className="grid grid-cols-2 gap-2 mb-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-kora-bg rounded-xl p-3">
              <p className="text-[9px] text-kora-muted uppercase tracking-wide">
                {m.label}
              </p>
              <CountUp
                to={m.to}
                prefix={m.prefix}
                suffix={m.suffix}
                duration={1.2}
                className={`text-lg font-bold tabular-nums mt-0.5 block ${m.color}`}
              />
            </div>
          ))}
        </div>
        <div className="bg-kora-accent/10 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-kora-primary">
            Forecast 30 días
          </p>
          <p className="text-xs text-kora-muted mt-0.5">
            Ocupación proyectada: 79% · Ingresos: $312,400 MXN
          </p>
        </div>
      </div>
    </WindowFrame>
  );
}
