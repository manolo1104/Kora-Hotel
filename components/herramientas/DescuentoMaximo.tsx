"use client";

import { useState } from "react";
import { ArrowRight, Percent, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

function fmtMXN(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-MX") + " MXN";
}

// ─── Slider ──────────────────────────────────────────────────────────────────

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

const ESCENARIOS = [10, 15, 20, 25, 30, 40];

// ─── Main ──────────────────────────────────────────────────────────────────

export function DescuentoMaximo() {
  const [tarifa, setTarifa] = useState<number>(1500);
  const [costo, setCosto] = useState<number>(350);

  const maxDescPct = tarifa > 0 ? Math.max(0, ((tarifa - costo) / tarifa) * 100) : 0;
  const sinMargen = costo >= tarifa;

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
              ¿Hasta cuánto puedes descontar?
            </h2>
            <p className="mt-1 text-kora-accent text-sm">
              Negocia grupos y last-minute sin trabajar a pérdida
            </p>
          </div>

          <div className="bg-kora-bg p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Inputs */}
              <fieldset className="space-y-6 border-0 p-0 m-0 self-center">
                <legend className="sr-only">Datos de tu habitación</legend>
                <SliderField
                  id="tarifa"
                  label="Tarifa normal por noche"
                  min={500}
                  max={6000}
                  step={50}
                  value={tarifa}
                  display={fmtMXN(tarifa)}
                  onChange={setTarifa}
                />
                <SliderField
                  id="costo"
                  label="Costo por noche ocupada (limpieza, amenidades, comisión…)"
                  min={0}
                  max={2000}
                  step={50}
                  value={costo}
                  display={fmtMXN(costo)}
                  onChange={setCosto}
                />
              </fieldset>

              {/* Resultados */}
              <div className="space-y-3" aria-label="Resultado del cálculo">
                {/* El número estrella: descuento máximo */}
                <div
                  className="rounded-xl p-5 sm:p-6 border-2 border-kora-primary bg-white shadow-sm"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Percent size={15} className="text-kora-primary" aria-hidden="true" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-kora-primary">
                      Puedes descontar hasta
                    </p>
                  </div>
                  <span
                    key={Math.round(maxDescPct)}
                    className="kora-val block text-4xl sm:text-5xl font-extrabold tabular-nums leading-none"
                    style={{ color: sinMargen ? "#B91C1C" : "#1B4332" }}
                  >
                    {sinMargen ? "0%" : `${Math.round(maxDescPct)}%`}
                  </span>
                  <p className="mt-2.5 text-xs text-kora-muted leading-snug">
                    {sinMargen
                      ? "A esta tarifa ya estás en o por debajo de tu costo: no hay margen para descontar."
                      : `Es el punto donde llegas a tu costo. Más allá de ahí, cada reserva te cuesta dinero.`}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-2">
                    Tu precio piso (no bajes de aquí)
                  </p>
                  <span
                    key={fmtMXN(costo)}
                    className="kora-val block text-2xl sm:text-3xl font-bold tabular-nums text-kora-text"
                  >
                    {fmtMXN(costo)}
                  </span>
                  <p className="mt-1.5 text-xs text-kora-muted leading-snug">
                    Vender a este precio no te deja ganancia, pero no pierdes.
                    Debajo, trabajas a pérdida.
                  </p>
                </div>

                {/* Tabla de escenarios */}
                <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-3">
                    Cuánto te queda según el descuento
                  </p>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-kora-muted uppercase tracking-wider pb-1.5 border-b border-gray-100">
                      <span>Descuento</span>
                      <span className="text-right">Precio</span>
                      <span className="text-right">Te queda</span>
                    </div>
                    {ESCENARIOS.map((d) => {
                      const precio = tarifa * (1 - d / 100);
                      const queda = precio - costo;
                      const perdida = queda < 0;
                      return (
                        <div
                          key={d}
                          className="grid grid-cols-3 gap-2 text-sm tabular-nums py-0.5"
                        >
                          <span className="text-kora-text font-medium">{d}%</span>
                          <span className="text-right text-kora-muted">
                            {fmtMXN(precio)}
                          </span>
                          <span
                            className="text-right font-bold"
                            style={{ color: perdida ? "#E24B4A" : "#1B4332" }}
                          >
                            {perdida ? "−" : ""}
                            {fmtMXN(Math.abs(queda))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed px-2">
        * Descuento máximo = (tarifa − costo por noche) ÷ tarifa. El "costo por
        noche" incluye comisiones: por eso, en una reserva directa (sin comisión)
        tu costo baja y puedes descontar más sin perder. Cálculo orientativo.
      </p>

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Calculadora de descuento máximo"
            title="Recibe tu tabla de descuentos seguros"
            subtitle="Te mandamos por WhatsApp hasta dónde puedes descontar en grupos y last-minute sin trabajar a pérdida, según tus números."
            buttonText="Enviarme mi tabla"
            hiddenFields={{
              tarifa_normal: fmtMXN(tarifa),
              costo_por_noche: fmtMXN(costo),
              descuento_maximo: sinMargen ? "0%" : `${Math.round(maxDescPct)}%`,
              precio_piso: fmtMXN(costo),
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
              Más margen para negociar
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Sin comisiones, tu margen para descontar crece
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Cada reserva directa con Kora te ahorra la comisión, así que tu costo
            por noche baja y puedes ofrecer mejores precios sin perder. Y el precio
            dinámico ajusta tus descuentos solo en las fechas flojas.
          </p>
          <a
            href="/#contacto?utm_source=descuento-maximo"
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
