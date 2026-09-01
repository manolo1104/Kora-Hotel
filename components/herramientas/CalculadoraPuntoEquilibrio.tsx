"use client";

import { useState } from "react";
import { ArrowRight, Scale, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

function fmtMXN(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-MX") + " MXN";
}

interface Diagnostico {
  titulo: string;
  texto: string;
  color: string;
  bg: string;
  borde: string;
}

// Diagnóstico honesto según la ocupación que necesitas para no perder.
function diagnosticar(
  contribucion: number,
  ocupacionNecesaria: number
): Diagnostico {
  if (contribucion <= 0) {
    return {
      titulo: "Pierdes en cada reserva",
      texto:
        "Tu costo por noche ocupada es mayor que lo que cobras: cada reserva te cuesta dinero, sin importar cuántas vendas. Necesitas subir la tarifa o bajar tus costos por noche (incluidas las comisiones).",
      color: "#B91C1C",
      bg: "#FEF2F2",
      borde: "#EF4444",
    };
  }
  if (ocupacionNecesaria > 100) {
    return {
      titulo: "Ni llenando el hotel cubres tus gastos",
      texto:
        "Con esta tarifa y estos costos, ni al 100% de ocupación llegas a cubrir tus gastos fijos. Tienes que subir el precio o reducir gastos fijos y comisiones.",
      color: "#B91C1C",
      bg: "#FEF2F2",
      borde: "#EF4444",
    };
  }
  if (ocupacionNecesaria >= 75) {
    return {
      titulo: "Margen muy apretado",
      texto:
        "Necesitas casi llenar el hotel solo para no perder. Aquí cada comisión que evitas y cada reserva directa que capturas te da aire de verdad.",
      color: "#B45309",
      bg: "#FFFBEB",
      borde: "#F59E0B",
    };
  }
  if (ocupacionNecesaria >= 50) {
    return {
      titulo: "Punto de equilibrio razonable",
      texto:
        "Cubres tus gastos con una ocupación media. Todo lo que vendas por encima de ese punto es ganancia directa para ti.",
      color: "#1B4332",
      bg: "#F0FAF4",
      borde: "#52B788",
    };
  }
  return {
    titulo: "Buen colchón de rentabilidad",
    texto:
      "Alcanzas el equilibrio con ocupación moderada, así que la mayor parte de tus reservas son utilidad. El foco ahora es llenar más y subir tarifa en fechas fuertes.",
    color: "#1B4332",
    bg: "#F0FAF4",
    borde: "#52B788",
  };
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

// ─── Main ──────────────────────────────────────────────────────────────────

export function CalculadoraPuntoEquilibrio() {
  const [gastosFijos, setGastosFijos] = useState<number>(150000);
  const [tarifa, setTarifa] = useState<number>(1500);
  const [costoVariable, setCostoVariable] = useState<number>(350);
  const [habitaciones, setHabitaciones] = useState<number>(15);

  const contribucion = tarifa - costoVariable; // ganancia por noche vendida
  const nochesDisponibles = habitaciones * 30;
  const nochesEquilibrio =
    contribucion > 0 ? Math.ceil(gastosFijos / contribucion) : Infinity;
  const ocupacionNecesaria =
    contribucion > 0 ? (nochesEquilibrio / nochesDisponibles) * 100 : Infinity;

  const dx = diagnosticar(contribucion, ocupacionNecesaria);

  const nochesDisplay =
    contribucion > 0 ? `${nochesEquilibrio} noches` : "No alcanzable";
  const ocupacionDisplay =
    contribucion > 0
      ? `${Math.min(ocupacionNecesaria, 999).toFixed(0)}% de ocupación`
      : "—";

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
              Calcula tu punto de equilibrio
            </h2>
            <p className="mt-1 text-kora-accent text-sm">
              Mueve los controles con los datos de tu hotel
            </p>
          </div>

          <div className="bg-kora-bg p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Inputs */}
              <fieldset className="space-y-6 border-0 p-0 m-0 self-center">
                <legend className="sr-only">Datos de tu hotel</legend>
                <SliderField
                  id="gastos"
                  label="Gastos fijos al mes (renta, nómina, servicios, internet…)"
                  min={10000}
                  max={600000}
                  step={5000}
                  value={gastosFijos}
                  display={fmtMXN(gastosFijos)}
                  onChange={setGastosFijos}
                />
                <SliderField
                  id="tarifa"
                  label="Tarifa promedio por noche"
                  min={500}
                  max={6000}
                  step={50}
                  value={tarifa}
                  display={fmtMXN(tarifa)}
                  onChange={setTarifa}
                />
                <SliderField
                  id="variable"
                  label="Costo por noche ocupada (limpieza, amenidades, comisión…)"
                  min={0}
                  max={2000}
                  step={50}
                  value={costoVariable}
                  display={fmtMXN(costoVariable)}
                  onChange={setCostoVariable}
                />
                <SliderField
                  id="hab"
                  label="Habitaciones"
                  min={5}
                  max={80}
                  step={1}
                  value={habitaciones}
                  display={String(habitaciones)}
                  onChange={setHabitaciones}
                />
              </fieldset>

              {/* Resultados */}
              <div className="space-y-3" aria-label="Resultado del cálculo">
                {/* El número estrella: noches para no perder */}
                <div
                  className="rounded-xl p-5 sm:p-6 border-2 border-kora-primary bg-white shadow-sm"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Scale size={15} className="text-kora-primary" aria-hidden="true" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-kora-primary">
                      Necesitas vender al mes
                    </p>
                  </div>
                  <span
                    key={nochesDisplay}
                    className="kora-val block text-4xl sm:text-5xl font-extrabold tabular-nums leading-none text-kora-primary"
                  >
                    {nochesDisplay}
                  </span>
                  <p className="mt-2.5 text-xs text-kora-muted leading-snug">
                    {contribucion > 0
                      ? `Eso es ${ocupacionDisplay}. Lo que vendas por encima es ganancia.`
                      : "Con esta tarifa y costos, no hay número de noches que te haga ganar."}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-2">
                    Ganancia por cada noche extra
                  </p>
                  <span
                    key={fmtMXN(contribucion)}
                    className="kora-val block text-2xl sm:text-3xl font-bold tabular-nums"
                    style={{ color: contribucion > 0 ? "#1B4332" : "#B91C1C" }}
                  >
                    {fmtMXN(contribucion)}
                  </span>
                  <p className="mt-1.5 text-xs text-kora-muted leading-snug">
                    Tarifa menos costo por noche. Cada noche por encima del
                    equilibrio te deja esto.
                  </p>
                </div>

                {/* Diagnóstico */}
                <div
                  className="rounded-xl p-4 sm:p-5 border-2 shadow-sm"
                  style={{ background: dx.bg, borderColor: dx.borde }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: dx.color }}
                  >
                    Diagnóstico
                  </p>
                  <p
                    key={dx.titulo}
                    className="kora-val text-base sm:text-lg font-bold leading-snug"
                    style={{ color: dx.color }}
                  >
                    {dx.titulo}
                  </p>
                  <p className="mt-1.5 text-xs text-kora-text/70 leading-snug">
                    {dx.texto}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed px-2">
        * El punto de equilibrio = gastos fijos ÷ (tarifa − costo por noche). Las
        comisiones de las OTAs se incluyen en el costo por noche, por eso cada
        reserva directa baja tu punto de equilibrio. Cálculo orientativo.
      </p>

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Calculadora de punto de equilibrio"
            title="Recibe tu reporte de rentabilidad"
            subtitle="Te mandamos por WhatsApp tu punto de equilibrio y un plan para bajarlo con reservas directas, sin comisiones."
            buttonText="Enviarme mi reporte"
            hiddenFields={{
              gastos_fijos: fmtMXN(gastosFijos),
              tarifa: fmtMXN(tarifa),
              costo_variable: fmtMXN(costoVariable),
              habitaciones: String(habitaciones),
              noches_equilibrio: nochesDisplay,
              ganancia_noche_extra: fmtMXN(contribucion),
              diagnostico: dx.titulo,
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
              Menos comisiones, menor punto de equilibrio
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Cada reserva directa baja el número de noches que necesitas
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            La comisión de las OTAs sube tu costo por noche. Con Kora capturas
            reservas directas sin comisión y un agente de IA contesta tu WhatsApp
            24/7 — bajas tu punto de equilibrio y ves tus números en un solo
            dashboard.
          </p>
          <a
            href="/contacto?utm_source=punto-de-equilibrio"
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
