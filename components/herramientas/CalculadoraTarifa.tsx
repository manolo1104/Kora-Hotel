"use client";

import { useState } from "react";
import { ArrowRight, Gauge, Sparkles } from "lucide-react";
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

// Diagnóstico honesto basado en la relación precio/ocupación (revenue management
// básico): ocupación muy alta = casi siempre cobras de menos; ocupación baja =
// el problema rara vez es solo el precio.
function diagnosticar(ocupacion: number): Diagnostico {
  if (ocupacion >= 85) {
    return {
      titulo: "Probablemente estás cobrando de menos",
      texto:
        "Una ocupación tan alta casi siempre significa que tu tarifa está baja para tu demanda. Podrías subir el precio en fechas fuertes y ganar más con las mismas habitaciones.",
      color: "#B45309",
      bg: "#FFFBEB",
      borde: "#F59E0B",
    };
  }
  if (ocupacion >= 70) {
    return {
      titulo: "Vas muy bien — tienes margen para subir",
      texto:
        "Tu ocupación es saludable. Tienes espacio para subir la tarifa en puentes, fines de semana y temporada alta sin perder huéspedes.",
      color: "#1B4332",
      bg: "#F0FAF4",
      borde: "#52B788",
    };
  }
  if (ocupacion >= 50) {
    return {
      titulo: "Equilibrio sano entre precio y ocupación",
      texto:
        "Estás en un buen punto. Aquí el precio dinámico es donde más ayuda: sube la tarifa en los días de mayor demanda y la baja en los flojos para llenar.",
      color: "#1B4332",
      bg: "#F0FAF4",
      borde: "#52B788",
    };
  }
  return {
    titulo: "Ocupación baja: el precio no suele ser el único problema",
    texto:
      "Bajar la tarifa a ciegas rara vez llena el hotel. Con ocupación baja, el problema suele ser visibilidad y reservas que se pierden (quien escribe y nadie contesta), más que el precio en sí.",
    color: "#6B7280",
    bg: "#F9FAFB",
    borde: "#D1D5DB",
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

export function CalculadoraTarifa() {
  const [habitaciones, setHabitaciones] = useState<number>(15);
  const [tarifa, setTarifa] = useState<number>(1500);
  const [ocupacion, setOcupacion] = useState<number>(65);

  const revpar = tarifa * (ocupacion / 100);
  const ingresoMensual = revpar * habitaciones * 30;
  const dx = diagnosticar(ocupacion);

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
              Calcula tu RevPAR y tu precio ideal
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
                  id="hab"
                  label="Habitaciones"
                  min={5}
                  max={80}
                  step={1}
                  value={habitaciones}
                  display={String(habitaciones)}
                  onChange={setHabitaciones}
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
                  id="ocup"
                  label="Ocupación promedio"
                  min={20}
                  max={100}
                  step={1}
                  value={ocupacion}
                  display={`${ocupacion}%`}
                  onChange={setOcupacion}
                />
              </fieldset>

              {/* Resultados */}
              <div className="space-y-3" aria-label="Resultado del cálculo">
                {/* El número estrella: RevPAR */}
                <div
                  className="rounded-xl p-5 sm:p-6 border-2 border-kora-primary bg-white shadow-sm"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge size={15} className="text-kora-primary" aria-hidden="true" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-kora-primary">
                      Tu RevPAR
                    </p>
                  </div>
                  <span
                    key={fmtMXN(revpar)}
                    className="kora-val block text-4xl sm:text-5xl font-extrabold tabular-nums leading-none text-kora-primary"
                  >
                    {fmtMXN(revpar)}
                  </span>
                  <p className="mt-2.5 text-xs text-kora-muted leading-snug">
                    Ingreso por habitación disponible (tarifa × ocupación). La
                    métrica que mide de verdad si tu hotel rinde.
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-2">
                    Ingreso estimado al mes
                  </p>
                  <span
                    key={fmtMXN(ingresoMensual)}
                    className="kora-val block text-2xl sm:text-3xl font-bold tabular-nums text-kora-text"
                  >
                    {fmtMXN(ingresoMensual)}
                  </span>
                  <p className="mt-1.5 text-xs text-kora-muted leading-snug">
                    RevPAR × habitaciones × 30 noches.
                  </p>
                </div>

                {/* Diagnóstico (el valor real y accionable) */}
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
                    Diagnóstico de tu precio
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
        * RevPAR (Revenue Per Available Room) = tarifa promedio × ocupación. El
        diagnóstico es orientativo y se basa en principios de revenue management;
        los resultados reales dependen de tu mercado y temporada.
      </p>

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Calculadora de tarifa / RevPAR"
            title="Recibe tu reporte de pricing personalizado"
            subtitle="Te mandamos por WhatsApp el análisis de tu tarifa y un plan para subir tu RevPAR con precio dinámico, sin perder ocupación."
            buttonText="Enviarme mi reporte"
            hiddenFields={{
              habitaciones: String(habitaciones),
              tarifa: fmtMXN(tarifa),
              ocupacion: `${ocupacion}%`,
              revpar: fmtMXN(revpar),
              ingreso_mensual: fmtMXN(ingresoMensual),
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
              Precio dinámico automático
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Sube tu RevPAR sin estar pendiente del precio
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Kora ajusta tu tarifa solo en puentes, fines de semana y eventos
            locales — sube cuando hay demanda y llena cuando está flojo. Tú no
            tocas nada.
          </p>
          <a
            href={`/contacto?revpar=${Math.round(revpar)}&utm_source=calculadora-tarifa`}
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
