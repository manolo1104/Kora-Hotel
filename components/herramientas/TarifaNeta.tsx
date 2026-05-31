"use client";

import { useState } from "react";
import { ArrowRight, Tag, Sparkles } from "lucide-react";
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

// ─── Main ──────────────────────────────────────────────────────────────────

export function TarifaNeta() {
  const [neto, setNeto] = useState<number>(1500);
  const [comision, setComision] = useState<number>(16);

  const factor = 1 - comision / 100;
  const publicarOTA = neto / factor; // precio a publicar en la OTA para netear "neto"
  const diferenciaPrecio = publicarOTA - neto; // cuánto más caro queda en la OTA
  const ventajaDirecto = neto * (comision / 100); // si cobras igual en ambos, lo que te deja de más el directo

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
              ¿A qué precio publicar en Booking?
            </h2>
            <p className="mt-1 text-kora-accent text-sm">
              Para que después de la comisión te quede lo que quieres
            </p>
          </div>

          <div className="bg-kora-bg p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Inputs */}
              <fieldset className="space-y-6 border-0 p-0 m-0 self-center">
                <legend className="sr-only">Datos de tu tarifa</legend>
                <SliderField
                  id="neto"
                  label="Precio por noche que quieres recibir (lo que te queda)"
                  min={500}
                  max={6000}
                  step={50}
                  value={neto}
                  display={fmtMXN(neto)}
                  onChange={setNeto}
                />
                <SliderField
                  id="comision"
                  label="Comisión que te cobra la OTA"
                  min={10}
                  max={25}
                  step={1}
                  value={comision}
                  display={`${comision}%`}
                  onChange={setComision}
                />
              </fieldset>

              {/* Resultados */}
              <div className="space-y-3" aria-label="Resultado del cálculo">
                {/* El número estrella: precio a publicar */}
                <div
                  className="rounded-xl p-5 sm:p-6 border-2 border-kora-primary bg-white shadow-sm"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Tag size={15} className="text-kora-primary" aria-hidden="true" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-kora-primary">
                      Precio a publicar en la OTA
                    </p>
                  </div>
                  <span
                    key={fmtMXN(publicarOTA)}
                    className="kora-val block text-4xl sm:text-5xl font-extrabold tabular-nums leading-none text-kora-primary"
                  >
                    {fmtMXN(publicarOTA)}
                  </span>
                  <p className="mt-2.5 text-xs text-kora-muted leading-snug">
                    Para que, tras la comisión del {comision}%, te queden tus{" "}
                    {fmtMXN(neto)}.
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-2">
                    El huésped paga esto de más en la OTA
                  </p>
                  <span
                    key={fmtMXN(diferenciaPrecio)}
                    className="kora-val block text-2xl sm:text-3xl font-bold tabular-nums"
                    style={{ color: "#E24B4A" }}
                  >
                    {fmtMXN(diferenciaPrecio)}
                  </span>
                  <p className="mt-1.5 text-xs text-kora-muted leading-snug">
                    Por la misma habitación, en Booking sale más caro que
                    reservando directo contigo.
                  </p>
                </div>

                {/* Hook verde: ventaja del directo */}
                <div
                  className="rounded-xl p-5 sm:p-6 border-2 shadow-sm"
                  style={{ borderColor: "#52B788", background: "#F0FAF4" }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-kora-primary">
                    Cada reserva directa te deja de más
                  </p>
                  <span
                    key={fmtMXN(ventajaDirecto)}
                    className="kora-val block text-3xl sm:text-4xl font-extrabold tabular-nums leading-none text-kora-primary"
                  >
                    {fmtMXN(ventajaDirecto)}
                  </span>
                  <p className="mt-2.5 text-xs text-kora-text/70 leading-snug">
                    Si cobras el mismo precio en los dos lados, cada reserva
                    directa te deja esto de más: la comisión que ya no pagas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed px-2">
        * Precio a publicar = precio neto ÷ (1 − comisión). Cálculo orientativo;
        no incluye comisiones de pago ni promociones de la OTA (Genius,
        Preferente), que reducen aún más tu neto.
      </p>

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Calculadora de tarifa neta por canal"
            title="Recibe tu estrategia de precios por canal"
            subtitle="Te mandamos por WhatsApp cómo poner tus precios en cada canal para ganar más con reservas directas, sin pelearte con las OTAs."
            buttonText="Enviarme la estrategia"
            hiddenFields={{
              precio_neto_deseado: fmtMXN(neto),
              comision: `${comision}%`,
              precio_a_publicar_ota: fmtMXN(publicarOTA),
              ventaja_por_reserva_directa: fmtMXN(ventajaDirecto),
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
              Mejor precio, sin intermediarios
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Ofrece un mejor precio directo y quédate con todo
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Con Kora tienes tu propia página de reservas directas y precio
            dinámico: puedes ofrecer una tarifa más atractiva que en Booking y aun
            así ganar más, porque no pagas comisión.
          </p>
          <a
            href="/#contacto?utm_source=tarifa-neta"
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
