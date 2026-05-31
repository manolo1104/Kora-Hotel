"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

function fmtMXN(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-MX") + " MXN";
}

type Demanda = "Media" | "Media-alta" | "Alta" | "Muy alta";

interface Temporada {
  nombre: string;
  cuando: string;
  demanda: Demanda;
  uplift: number; // % de alza sugerido
}

// Temporadas altas recurrentes en México. Las fechas de los puentes (lunes)
// se mueven cada año; las fijas se indican con su día.
const TEMPORADAS: Temporada[] = [
  { nombre: "Año Nuevo", cuando: "1 de enero", demanda: "Alta", uplift: 25 },
  { nombre: "Puente de la Constitución", cuando: "1er lunes de febrero", demanda: "Media-alta", uplift: 20 },
  { nombre: "Puente de Benito Juárez", cuando: "3er lunes de marzo", demanda: "Media-alta", uplift: 20 },
  { nombre: "Semana Santa y Pascua", cuando: "Marzo–abril (2 semanas)", demanda: "Muy alta", uplift: 40 },
  { nombre: "Día del Trabajo", cuando: "1 de mayo", demanda: "Media", uplift: 15 },
  { nombre: "Vacaciones de verano", cuando: "Mediados de julio a mediados de agosto", demanda: "Alta", uplift: 25 },
  { nombre: "Independencia", cuando: "15–16 de septiembre", demanda: "Alta", uplift: 25 },
  { nombre: "Día de Muertos", cuando: "1–2 de noviembre", demanda: "Muy alta", uplift: 35 },
  { nombre: "Puente de la Revolución", cuando: "3er lunes de noviembre", demanda: "Media-alta", uplift: 20 },
  { nombre: "Navidad y Fin de Año", cuando: "20 de diciembre – 6 de enero", demanda: "Muy alta", uplift: 40 },
];

const MAX_UPLIFT = Math.max(...TEMPORADAS.map((t) => t.uplift));

function colorDemanda(d: Demanda): { color: string; bg: string } {
  switch (d) {
    case "Muy alta":
      return { color: "#B91C1C", bg: "#FEF2F2" };
    case "Alta":
      return { color: "#1B4332", bg: "#F0FAF4" };
    case "Media-alta":
      return { color: "#B45309", bg: "#FFFBEB" };
    default:
      return { color: "#6B7280", bg: "#F3F4F6" };
  }
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
        <label htmlFor={id} className="text-sm font-semibold text-kora-text leading-tight">
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

export function CalendarioPuentes() {
  const [tarifa, setTarifa] = useState<number>(1500);

  const tarifaTope = tarifa * (1 + MAX_UPLIFT / 100);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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

      {/* ── CAPA 1: input + calendario ── */}
      <Reveal>
        <div className="rounded-2xl border border-kora-primary overflow-hidden shadow-lg shadow-kora-primary/10">
          <div className="bg-kora-primary px-6 py-5 sm:px-8 sm:py-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Tu calendario de tarifas del año
            </h2>
            <p className="mt-1 text-kora-accent text-sm">
              Pon tu tarifa normal y ve el precio sugerido en cada temporada alta
            </p>
          </div>

          <div className="bg-kora-bg p-6 sm:p-8">
            <div className="max-w-md mx-auto">
              <SliderField
                id="tarifa"
                label="Tu tarifa normal por noche"
                min={500}
                max={6000}
                step={50}
                value={tarifa}
                display={fmtMXN(tarifa)}
                onChange={setTarifa}
              />
            </div>

            {/* Hero: tope en temporada alta */}
            <div
              className="mt-6 rounded-xl p-5 sm:p-6 border-2 border-kora-primary bg-white shadow-sm text-center"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <CalendarDays size={15} className="text-kora-primary" aria-hidden="true" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-kora-primary">
                  En tus mejores fechas podrías cobrar
                </p>
              </div>
              <span
                key={fmtMXN(tarifaTope)}
                className="kora-val block text-4xl sm:text-5xl font-extrabold tabular-nums leading-none text-kora-primary"
              >
                {fmtMXN(tarifaTope)}
              </span>
              <p className="mt-2.5 text-xs text-kora-muted leading-snug">
                Ej. Semana Santa, Día de Muertos y Navidad (+{MAX_UPLIFT}% sobre tu
                tarifa normal).
              </p>
            </div>

            {/* Lista de temporadas */}
            <div className="mt-6 space-y-2.5">
              {TEMPORADAS.map((t) => {
                const precio = tarifa * (1 + t.uplift / 100);
                const c = colorDemanda(t.demanda);
                return (
                  <div
                    key={t.nombre}
                    className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-kora-text text-sm leading-tight">
                        {t.nombre}
                      </p>
                      <p className="text-xs text-kora-muted mt-0.5">{t.cuando}</p>
                      <span
                        className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ color: c.color, background: c.bg }}
                      >
                        Demanda {t.demanda.toLowerCase()}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-bold text-kora-accent uppercase tracking-wider">
                        +{t.uplift}%
                      </p>
                      <p
                        key={fmtMXN(precio)}
                        className="kora-val text-lg sm:text-xl font-bold text-kora-primary tabular-nums leading-tight"
                      >
                        {fmtMXN(precio)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed px-2">
        * Los % de alza son sugerencias orientativas y varían según tu destino y
        ocupación. Las fechas de los puentes (lunes) cambian cada año; las fijas se
        indican con su día. Ajusta según la demanda real de tu zona.
      </p>

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Calendario de tarifas por puentes"
            title="Recibe tu calendario de precios del año"
            subtitle="Te mandamos por WhatsApp el calendario completo con tus precios sugeridos para cada temporada alta, listo para usar."
            buttonText="Enviarme mi calendario"
            hiddenFields={{
              tarifa_normal: fmtMXN(tarifa),
              tarifa_tope_temporada_alta: fmtMXN(tarifaTope),
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
            No tienes que acordarte de subir tus precios
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Kora ajusta tu tarifa solo en cada puente, temporada alta y evento
            local — sube cuando hay demanda y baja en los días flojos para llenar.
            Sin que tú estés pendiente del calendario.
          </p>
          <a
            href="/#contacto?utm_source=calendario-puentes"
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
