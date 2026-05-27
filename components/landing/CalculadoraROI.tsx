"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

const WA_CALC_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20us%C3%A9%20la%20calculadora%20de%20Kora%20y%20quiero%20saber%20m%C3%A1s`;

function fmtMXN(n: number): string {
  const abs = Math.round(Math.abs(n));
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("es-MX") + " MXN";
}

interface Metricas {
  comisionMensual: number;
  comisionAnual: number;
  ahorroNetoAnual: number;
  roi: number;
}

function calcular(
  habitaciones: number,
  precioPorNoche: number,
  ocupacion: number,
  porcentajeOTA: number,
  comisionOTA: number
): Metricas {
  const nochesVendidas = habitaciones * (ocupacion / 100) * 30;
  const ingresosTotales = nochesVendidas * precioPorNoche;
  const ingresosOTA = ingresosTotales * (porcentajeOTA / 100);
  const comisionMensual = ingresosOTA * (comisionOTA / 100);
  const comisionAnual = comisionMensual * 12;
  const koraAnual = 2990 * 12; // $35,880 MXN
  const reservasRecuperadas = ingresosOTA * 0.4;
  const comisionEvitada = reservasRecuperadas * (comisionOTA / 100);
  const ahorroNetoAnual = comisionEvitada * 12 - koraAnual;
  const roi = (ahorroNetoAnual / koraAnual) * 100;
  return { comisionMensual, comisionAnual, ahorroNetoAnual, roi };
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

// ─── Metric card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  animKey: string;
  color: string;
  subtext: string;
}

function MetricCard({
  label,
  value,
  animKey,
  color,
  subtext,
}: MetricCardProps) {
  return (
    <div
      className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-2">
        {label}
      </p>
      <span
        key={animKey}
        className="kora-val block text-2xl sm:text-3xl font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
      <p className="mt-1.5 text-xs text-kora-muted leading-snug">{subtext}</p>
    </div>
  );
}

// ─── ROI card (special: includes badge) ──────────────────────────────────────

function ROICard({ roi, animKey }: { roi: number; animKey: string }) {
  const color = roi > 0 ? "#1B4332" : "#6B7280";
  const badge =
    roi > 200
      ? { text: "Kora se paga más de 2 veces", intense: true }
      : roi > 0
        ? { text: "Kora se paga solo", intense: false }
        : null;

  return (
    <div
      className="bg-white rounded-xl p-4 sm:p-5 border border-gray-100 shadow-sm"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-2">
        Retorno sobre inversión
      </p>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span
          key={animKey}
          className="kora-val text-2xl sm:text-3xl font-bold tabular-nums"
          style={{ color }}
        >
          {Math.round(roi)}%
        </span>
        {badge && (
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              badge.intense
                ? "bg-kora-accent text-kora-primary"
                : "bg-kora-accent/20 text-kora-primary"
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-kora-muted leading-snug">
        Por cada peso que inviertes en Kora
      </p>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function CalculadoraROI() {
  const [habitaciones, setHabitaciones] = useState<number>(15);
  const [precioPorNoche, setPrecioPorNoche] = useState<number>(1200);
  const [ocupacion, setOcupacion] = useState<number>(65);
  const [porcentajeOTA, setPorcentajeOTA] = useState<number>(70);
  const [comisionOTA, setComisionOTA] = useState<number>(18);

  const { comisionMensual, comisionAnual, ahorroNetoAnual, roi } = calcular(
    habitaciones,
    precioPorNoche,
    ocupacion,
    porcentajeOTA,
    comisionOTA
  );

  return (
    <section className="py-14 sm:py-20 bg-kora-bg">
      {/* Component-scoped slider + animation styles */}
      <style>{`
        .kora-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 3px;
        }
        .kora-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 3px;
        }
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
        .kora-slider::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          background: #e5e7eb;
        }
        .kora-slider::-moz-range-progress {
          height: 6px;
          border-radius: 3px;
          background: #52B788;
        }
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Card ── */}
        <div className="rounded-2xl border border-kora-primary overflow-hidden shadow-lg shadow-kora-primary/10">
          {/* Header */}
          <div className="bg-kora-primary px-6 py-5 sm:px-8 sm:py-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              ¿Cuánto te están costando las OTAs?
            </h2>
            <p className="mt-1 text-kora-accent text-sm">
              Mueve los controles y ve el impacto en tiempo real
            </p>
          </div>

          {/* Body */}
          <div className="bg-kora-bg p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Inputs */}
              <fieldset className="space-y-6 border-0 p-0 m-0">
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
                  id="precio"
                  label="Precio promedio por noche"
                  min={500}
                  max={5000}
                  step={100}
                  value={precioPorNoche}
                  display={fmtMXN(precioPorNoche)}
                  onChange={setPrecioPorNoche}
                />
                <SliderField
                  id="ocup"
                  label="Ocupación promedio"
                  min={20}
                  max={100}
                  step={5}
                  value={ocupacion}
                  display={`${ocupacion}%`}
                  onChange={setOcupacion}
                />
                <SliderField
                  id="ota"
                  label="Reservas que vienen de Booking/Airbnb"
                  min={10}
                  max={100}
                  step={5}
                  value={porcentajeOTA}
                  display={`${porcentajeOTA}%`}
                  onChange={setPorcentajeOTA}
                />
                <SliderField
                  id="com"
                  label="Comisión que cobran las OTAs"
                  min={12}
                  max={25}
                  step={1}
                  value={comisionOTA}
                  display={`${comisionOTA}%`}
                  onChange={setComisionOTA}
                />
              </fieldset>

              {/* Results */}
              <div className="space-y-3" aria-label="Resultados del cálculo">
                <MetricCard
                  label="Pagas a Booking/Airbnb cada mes"
                  value={fmtMXN(comisionMensual)}
                  animKey={fmtMXN(comisionMensual)}
                  color="#E24B4A"
                  subtext="Solo en comisiones, sin contar lo que pierdes"
                />
                <MetricCard
                  label="Comisiones al año"
                  value={fmtMXN(comisionAnual)}
                  animKey={fmtMXN(comisionAnual)}
                  color="#E24B4A"
                  subtext="Dinero que sale de tu bolsillo cada año"
                />
                <MetricCard
                  label="Ahorro estimado con Kora al año"
                  value={fmtMXN(ahorroNetoAnual)}
                  animKey={fmtMXN(ahorroNetoAnual)}
                  color={ahorroNetoAnual >= 0 ? "#52B788" : "#6B7280"}
                  subtext="Después de descontar el costo anual de Kora"
                />
                <ROICard
                  roi={roi}
                  animKey={String(Math.round(roi))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Legal note */}
        <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed px-2">
          * Estimación basada en convertir el 40% de tus reservas OTA a
          reservas directas con Kora. Los resultados reales varían según el
          hotel. Calculadora con fines ilustrativos.
        </p>

        {/* CTA */}
        <div className="mt-6 text-center">
          <p className="text-sm text-kora-text font-medium mb-3">
            ¿Quieres ver estos números aplicados a tu hotel?
          </p>
          <a
            href={WA_CALC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Hablar con Manolo por WhatsApp
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
