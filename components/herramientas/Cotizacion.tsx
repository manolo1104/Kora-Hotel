"use client";

import { useState } from "react";
import { ArrowRight, Printer, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

function fmtMXN(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-MX") + " MXN";
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-kora-text mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function nochesEntre(entrada: string, salida: string): number {
  if (!entrada || !salida) return 0;
  const d1 = new Date(entrada).getTime();
  const d2 = new Date(salida).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2) || d2 <= d1) return 0;
  return Math.round((d2 - d1) / 86400000);
}

function fechaLarga(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Cotizacion() {
  const [hotel, setHotel] = useState("");
  const [contacto, setContacto] = useState("");
  const [cliente, setCliente] = useState("");
  const [entrada, setEntrada] = useState("");
  const [salida, setSalida] = useState("");
  const [habitaciones, setHabitaciones] = useState(1);
  const [tipo, setTipo] = useState("");
  const [tarifa, setTarifa] = useState(1500);
  const [incluye, setIncluye] = useState("");

  const noches = nochesEntre(entrada, salida);
  const total = tarifa * noches * habitaciones;
  const folio = new Date()
    .toLocaleDateString("es-MX", { year: "2-digit", month: "2-digit", day: "2-digit" })
    .replace(/\//g, "");

  function imprimir() {
    window.print();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .cotizacion-doc, .cotizacion-doc * { visibility: visible !important; }
          .cotizacion-doc {
            position: absolute; left: 0; top: 0; width: 100%;
            box-shadow: none !important; border: none !important; border-radius: 0 !important;
            padding: 32px !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Formulario ── */}
        <Reveal>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm no-print">
            <h2 className="text-lg font-bold text-kora-text mb-4">
              Datos de la cotización
            </h2>
            <div className="space-y-4">
              <Campo label="Nombre de tu hotel">
                <input
                  className={inputCls}
                  value={hotel}
                  onChange={(e) => setHotel(e.target.value)}
                  placeholder="Hotel Paraíso Encantado"
                />
              </Campo>
              <Campo label="Tu contacto (teléfono / WhatsApp)">
                <input
                  className={inputCls}
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="+52 489 123 4567"
                />
              </Campo>
              <Campo label="Nombre del cliente">
                <input
                  className={inputCls}
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Sr. Juan Pérez"
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Entrada">
                  <input
                    type="date"
                    className={inputCls}
                    value={entrada}
                    onChange={(e) => setEntrada(e.target.value)}
                  />
                </Campo>
                <Campo label="Salida">
                  <input
                    type="date"
                    className={inputCls}
                    value={salida}
                    onChange={(e) => setSalida(e.target.value)}
                  />
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Habitaciones">
                  <input
                    type="number"
                    min={1}
                    className={inputCls}
                    value={habitaciones}
                    onChange={(e) => setHabitaciones(Math.max(1, Number(e.target.value)))}
                  />
                </Campo>
                <Campo label="Tarifa por noche">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    className={inputCls}
                    value={tarifa}
                    onChange={(e) => setTarifa(Number(e.target.value))}
                  />
                </Campo>
              </div>
              <Campo label="Tipo de habitación">
                <input
                  className={inputCls}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  placeholder="Habitación doble con vista"
                />
              </Campo>
              <Campo label="¿Qué incluye? (opcional)">
                <textarea
                  className={inputCls}
                  rows={3}
                  value={incluye}
                  onChange={(e) => setIncluye(e.target.value)}
                  placeholder="Desayuno, wifi, estacionamiento…"
                />
              </Campo>
            </div>
          </div>
        </Reveal>

        {/* ── Vista previa (documento) ── */}
        <Reveal delay={0.1}>
          <div>
            <div className="cotizacion-doc bg-white rounded-2xl border border-gray-200 shadow-sm p-7 sm:p-8">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b-2 border-kora-primary pb-4">
                <div>
                  <p className="text-xl font-extrabold text-kora-primary tracking-tight">
                    {hotel || "Tu Hotel"}
                  </p>
                  {contacto && (
                    <p className="text-xs text-kora-muted mt-1">{contacto}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
                    Cotización
                  </p>
                  <p className="text-xs text-kora-muted mt-1">Folio {folio}</p>
                </div>
              </div>

              {/* Cliente */}
              <div className="mt-5">
                <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
                  Para
                </p>
                <p className="text-sm font-semibold text-kora-text mt-0.5">
                  {cliente || "Nombre del cliente"}
                </p>
              </div>

              {/* Detalle */}
              <div className="mt-5 rounded-xl bg-kora-bg p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Llegada</span>
                  <span className="font-semibold text-kora-text">{fechaLarga(entrada)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Salida</span>
                  <span className="font-semibold text-kora-text">{fechaLarga(salida)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Noches</span>
                  <span className="font-semibold text-kora-text">{noches}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Habitación</span>
                  <span className="font-semibold text-kora-text">
                    {habitaciones} × {tipo || "habitación"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Tarifa por noche</span>
                  <span className="font-semibold text-kora-text">{fmtMXN(tarifa)}</span>
                </div>
              </div>

              {incluye && (
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
                    Incluye
                  </p>
                  <p className="text-sm text-kora-text mt-0.5 whitespace-pre-line">
                    {incluye}
                  </p>
                </div>
              )}

              {/* Total */}
              <div className="mt-5 flex items-baseline justify-between border-t-2 border-kora-primary pt-4">
                <span className="text-sm font-bold text-kora-text">Total</span>
                <span className="text-2xl font-extrabold text-kora-primary tabular-nums">
                  {fmtMXN(total)}
                </span>
              </div>

              <p className="mt-4 text-[11px] text-kora-muted leading-relaxed">
                Cotización sujeta a disponibilidad. Vigencia: 7 días a partir de la
                fecha de emisión.
              </p>
            </div>

            {/* Botón imprimir */}
            <div className="mt-4 text-center no-print">
              <button
                type="button"
                onClick={imprimir}
                className="btn-press btn-fill inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                <Printer size={16} aria-hidden="true" />
                Descargar / Imprimir PDF
              </button>
              <p className="mt-2 text-xs text-kora-muted">
                Tip: en el diálogo elige “Guardar como PDF”.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10 no-print">
          <LeadCaptureTool
            herramienta="Generador de cotización en PDF"
            title="¿Quieres que tus cotizaciones se manden solas?"
            subtitle="Te mostramos por WhatsApp cómo Kora genera cotizaciones y confirma reservas en automático, sin que tú las hagas a mano."
            buttonText="Quiero saber más"
            hiddenFields={{ hotel: hotel || "—" }}
          />
        </div>
      </Reveal>

      {/* ── CAPA 3: el puente a Kora ── */}
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center no-print">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              Cotiza y confirma sin escribir
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Deja de cotizar una por una
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Con Kora, el agente de IA cotiza por WhatsApp, toma el anticipo y
            confirma la reserva solo — 24/7, en español. Tú solo ves cómo se llena
            tu hotel.
          </p>
          <a
            href="/contacto?utm_source=cotizacion"
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
