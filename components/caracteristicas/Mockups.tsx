"use client";

import { motion, useReducedMotion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { CountUp } from "@/components/shared/CountUp";

// Mockups de la página de características que se animan al entrar en pantalla.
// Cada animación está motivada: "demuestra que el producto funciona / está vivo".
// Todo respeta prefers-reduced-motion (se muestra estático si el usuario lo pide).

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
    <div className="bg-kora-primary rounded-2xl p-5 shadow-xl">
      <p className="text-kora-accent text-[10px] font-bold uppercase tracking-widest mb-3">
        Motor de reservas
      </p>
      <div className="bg-white rounded-xl p-4 space-y-3">
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
    </div>
  );
}

// ─── Agente WhatsApp ────────────────────────────────────────────────────────────

export function WhatsAppMockup() {
  const reduce = useReducedMotion();
  const msg = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10, scale: 0.96 },
          whileInView: { opacity: 1, y: 0, scale: 1 },
          viewport: VIEWPORT,
          transition: { duration: 0.45, delay, ease: EASE },
        };

  return (
    <div className="bg-[#111B21] rounded-2xl p-4 shadow-xl max-w-xs mx-auto">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-3">
        <div className="w-7 h-7 rounded-full bg-kora-accent flex items-center justify-center">
          <MessageCircle size={13} className="text-kora-primary" />
        </div>
        <div>
          <p className="text-white text-xs font-semibold leading-none">
            Kora · Hotel Paraíso
          </p>
          <p className="text-[#00A884] text-[10px] mt-0.5">en línea</p>
        </div>
      </div>
      <div className="space-y-2">
        <motion.div {...msg(0)} className="flex justify-end">
          <div className="bg-[#005C4B] text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%]">
            Hola, ¿tienen cuarto para este fin de semana?
          </div>
        </motion.div>
        <motion.div {...msg(0.5)} className="flex justify-start">
          <div className="bg-[#202C33] text-white text-xs rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
            Hola! Si, tenemos la Suite Jardín y la Cabaña Huasteca disponibles.
            ¿Cuántas noches?
          </div>
        </motion.div>
        <motion.div {...msg(1)} className="flex justify-end">
          <div className="bg-[#005C4B] text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%]">
            2 noches, viernes y sábado
          </div>
        </motion.div>
        <motion.div {...msg(1.5)} className="flex justify-start">
          <div className="bg-[#202C33] text-white text-xs rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
            Perfecto. La Suite Jardín queda en $2,400/noche. Te mando el link de
            pago directo ahora.
          </div>
        </motion.div>
      </div>
    </div>
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
    <div className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
      <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-4">
        Mapa de habitaciones
      </p>
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
  );
}

// ─── Agente de llamadas ─────────────────────────────────────────────────────────

export function LlamadasMockup() {
  const reduce = useReducedMotion();
  const items = [
    { hora: "09:14", tipo: "Reserva", desc: "Suite Jardín · 3 noches · confirmada", ok: true },
    { hora: "11:42", tipo: "Consulta", desc: "Precio fin de semana · cotización enviada", ok: true },
    { hora: "14:07", tipo: "Reserva", desc: "Habitación Std · pendiente de pago", ok: false },
    { hora: "16:55", tipo: "Reserva", desc: "Cabaña Huasteca · 2 noches · confirmada", ok: true },
  ];
  const rowAnim = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, x: 16 },
          whileInView: { opacity: 1, x: 0 },
          viewport: VIEWPORT,
          transition: { duration: 0.4, delay: i * 0.1, ease: EASE },
        };

  return (
    <div className="bg-kora-primary rounded-2xl p-5 shadow-xl">
      <p className="text-kora-accent text-[10px] font-bold uppercase tracking-widest mb-4">
        Agente de llamadas activo
      </p>
      <div className="space-y-3">
        {items.map((item, i) => (
          <motion.div
            key={i}
            {...rowAnim(i)}
            className="flex items-start gap-3 bg-white/10 rounded-xl p-3"
          >
            <div
              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.ok ? "bg-kora-accent" : "bg-amber-400"}`}
            />
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold">
                {item.tipo}{" "}
                <span className="font-normal text-white/50">{item.hora}</span>
              </p>
              <p className="text-white/60 text-[10px] mt-0.5 leading-tight">
                {item.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
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
    <div className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
      <div className="flex justify-between items-baseline mb-4">
        <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
          Pricing esta semana
        </p>
        <span className="text-xs font-bold text-kora-accent">+18% RevPAR</span>
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {days.map((day, i) => (
          <div
            key={day}
            className="flex-1 h-full flex flex-col items-center justify-end gap-1"
          >
            <div className="w-full flex-1 flex items-end">
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
    <div className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
      <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-4">
        Dashboard · Mayo 2026
      </p>
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
  );
}
