"use client";

import { useState } from "react";
import { ArrowRight, Receipt, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

// Formato con 2 decimales, porque los impuestos llevan centavos.
function fmtMXN(n: number): string {
  return (
    "$" +
    n.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) +
    " MXN"
  );
}

// ─── Toggle de botones ───────────────────────────────────────────────────────

interface ToggleGroupProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function ToggleGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: ToggleGroupProps<T>) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-kora-text leading-tight block">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={label}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`btn-press px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                active
                  ? "bg-kora-primary text-white border-kora-primary"
                  : "bg-white text-kora-text border-gray-200 hover:border-kora-accent"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slider (para la tasa de ISH) ─────────────────────────────────────────────

interface SliderFieldProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
}

function SliderField({
  id,
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm font-semibold text-kora-text leading-tight"
        >
          {label}
        </label>
        <span className="text-lg font-bold text-kora-primary tabular-nums shrink-0">
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="kora-slider w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-kora-accent focus-visible:ring-offset-2 rounded-full"
        style={{
          background: `linear-gradient(to right, #52B788 ${pct}%, #e5e7eb ${pct}%)`,
        }}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      />
    </div>
  );
}

// ─── Fila de desglose ─────────────────────────────────────────────────────────

function FilaDesglose({
  label,
  value,
  bold = false,
  destacado = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  destacado?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-2.5 ${
        destacado ? "" : "border-b border-gray-100"
      }`}
    >
      <span
        className={`text-sm ${
          bold ? "font-bold text-kora-text" : "text-kora-muted"
        }`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          bold
            ? "text-lg font-bold text-kora-primary"
            : "text-sm font-semibold text-kora-text"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function CalculadoraImpuestos() {
  const [monto, setMonto] = useState<number>(1500);
  const [esBase, setEsBase] = useState<boolean>(true); // true = monto es tarifa base
  const [ivaPct, setIvaPct] = useState<number>(16); // 16 normal, 8 frontera
  const [ishPct, setIshPct] = useState<number>(3); // varía por estado

  const ivaR = ivaPct / 100;
  const ishR = ishPct / 100;

  // Si el monto es base: sumamos impuestos. Si es total: los desglosamos hacia atrás.
  const base = esBase ? monto : monto / (1 + ivaR + ishR);
  const iva = base * ivaR;
  const ish = base * ishR;
  const total = base + iva + ish;

  const heroLabel = esBase ? "Total a cobrar al huésped" : "Tu tarifa real (sin impuestos)";
  const heroValue = esBase ? total : base;
  const heroSub = esBase
    ? "Esto es lo que el huésped paga, impuestos incluidos."
    : "De lo que cobras, esto es lo que de verdad te queda como hospedaje.";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Estilos del slider (component-scoped) */}
      <style>{`
        .kora-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 3px;
        }
        .kora-slider::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; }
        .kora-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          margin-top: -7px;
          border-radius: 50%;
          background: #1B4332;
          border: 2.5px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
          transition: box-shadow 0.15s;
        }
        .kora-slider::-webkit-slider-thumb:hover,
        .kora-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 7px rgba(82,183,136,0.20);
        }
        .kora-slider::-moz-range-track { height: 6px; border-radius: 3px; background: #e5e7eb; }
        .kora-slider::-moz-range-progress { height: 6px; border-radius: 3px; background: #52B788; }
        .kora-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1B4332;
          border: 2.5px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
        }
        @keyframes koraValIn {
          from { opacity: 0.4; transform: translateY(3px); }
          to   { opacity: 1;   transform: translateY(0); }
        }
        .kora-val { animation: koraValIn 0.2s ease-out; }
      `}</style>

      {/* ── CAPA 1: la calculadora + el resultado ── */}
      <Reveal>
        <div className="rounded-2xl border border-kora-primary overflow-hidden shadow-lg shadow-kora-primary/10">
          <div className="bg-kora-primary px-6 py-5 sm:px-8 sm:py-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Calcula el IVA y el Impuesto al Hospedaje
            </h2>
            <p className="mt-1 text-kora-accent text-sm">
              Desglosa cualquier monto de tu hotel en segundos
            </p>
          </div>

          <div className="bg-kora-bg p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Inputs */}
              <fieldset className="space-y-6 border-0 p-0 m-0 self-start">
                <legend className="sr-only">Datos de la reserva</legend>

                {/* Monto */}
                <div className="space-y-2">
                  <label
                    htmlFor="monto"
                    className="text-sm font-semibold text-kora-text leading-tight block"
                  >
                    Monto de la reserva
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-kora-muted font-semibold">
                      $
                    </span>
                    <input
                      id="monto"
                      type="number"
                      min={0}
                      step={50}
                      value={Number.isNaN(monto) ? "" : monto}
                      onChange={(e) => setMonto(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 text-kora-text text-base font-semibold focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                      placeholder="1500"
                    />
                  </div>
                </div>

                <ToggleGroup
                  label="Ese monto es…"
                  value={esBase ? "base" : "total"}
                  options={[
                    { value: "base", label: "Tarifa base (sin impuestos)" },
                    { value: "total", label: "Total (impuestos incluidos)" },
                  ]}
                  onChange={(v) => setEsBase(v === "base")}
                />

                <ToggleGroup
                  label="IVA"
                  value={ivaPct}
                  options={[
                    { value: 16, label: "16% (general)" },
                    { value: 8, label: "8% (frontera)" },
                  ]}
                  onChange={setIvaPct}
                />

                <SliderField
                  id="ish"
                  label="Impuesto al Hospedaje (ISH) de tu estado"
                  min={0}
                  max={5}
                  step={0.5}
                  value={ishPct}
                  display={`${ishPct}%`}
                  onChange={setIshPct}
                />
              </fieldset>

              {/* Resultados */}
              <div className="space-y-3" aria-label="Resultado del cálculo">
                {/* El número estrella */}
                <div
                  className="rounded-xl p-5 sm:p-6 border-2 border-kora-primary bg-white shadow-sm"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Receipt size={15} className="text-kora-primary" aria-hidden="true" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-kora-primary">
                      {heroLabel}
                    </p>
                  </div>
                  <span
                    key={fmtMXN(heroValue)}
                    className="kora-val block text-3xl sm:text-4xl font-extrabold tabular-nums leading-none text-kora-primary"
                  >
                    {fmtMXN(heroValue)}
                  </span>
                  <p className="mt-2.5 text-xs text-kora-muted leading-snug">
                    {heroSub}
                  </p>
                </div>

                {/* Desglose completo */}
                <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-1">
                    Desglose
                  </p>
                  <FilaDesglose label="Tarifa base (hospedaje)" value={fmtMXN(base)} />
                  <FilaDesglose label={`IVA (${ivaPct}%)`} value={fmtMXN(iva)} />
                  <FilaDesglose
                    label={`Impuesto al Hospedaje (${ishPct}%)`}
                    value={fmtMXN(ish)}
                  />
                  <FilaDesglose label="Total" value={fmtMXN(total)} bold destacado />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed px-2">
        * El IVA general es 16% (8% en la franja fronteriza). El Impuesto al
        Hospedaje (ISH) es estatal y va de 2% a 5% según el estado — confírmalo
        con tu contador o la tesorería de tu estado. Cálculo orientativo, no es
        asesoría fiscal.
      </p>

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Calculadora de IVA + ISH"
            title="Recibe la guía de impuestos para hoteles"
            subtitle="Te mandamos por WhatsApp cómo calcular bien el IVA y el Impuesto al Hospedaje de tus reservas, y cómo llevarlo sin líos con Kora."
            buttonText="Enviarme la guía"
            hiddenFields={{
              monto: fmtMXN(monto || 0),
              tipo_monto: esBase ? "Tarifa base" : "Total con impuestos",
              iva_pct: `${ivaPct}%`,
              ish_pct: `${ishPct}%`,
              total: fmtMXN(total),
            }}
          />
        </div>
      </Reveal>

      {/* ── CAPA 3: el puente a Kora ── */}
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              Tus impuestos, claros en cada reserva
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Olvídate de calcular impuestos a mano
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Kora desglosa el IVA y el Impuesto al Hospedaje en cada reserva y te
            muestra tu total neto claro. Sin Excel y sin errores.
          </p>
          <a
            href="/?utm_source=calculadora-impuestos#contacto"
            className="btn-press btn-arrow btn-fill mt-6 inline-flex items-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Ver cómo funciona Kora
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </Reveal>
    </div>
  );
}
