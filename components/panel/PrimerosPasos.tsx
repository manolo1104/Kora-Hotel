"use client";

// Checklist "Primeros pasos" del Inicio: refleja el estado real del hotel
// (mismo diagnóstico que la página de Camila) y enlaza a dónde completar cada
// cosa. Incluye el botón para relanzar el tour guiado. Se colapsa cuando todo
// está listo.

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import type { DiagnosticoHotel } from "@/lib/panel/diagnostico";

interface Tarea {
  ok: boolean;
  label: string;
  aviso?: string;
  href: string;
}

export default function PrimerosPasos({
  slug,
  diagnostico,
}: {
  slug: string;
  diagnostico: DiagnosticoHotel;
}) {
  const base = `/panel/${slug}`;
  const sitio = (tab?: string) => `${base}/sitio${tab ? `?tab=${tab}` : ""}`;

  const tareas: Tarea[] = [
    { ...diagnostico.habitaciones, href: sitio("habitaciones") },
    { ...diagnostico.precios, href: sitio("habitaciones") },
    { ...diagnostico.fotos, href: sitio("contenido") },
    { ...diagnostico.amenidades, href: sitio("contenido") },
    { ...diagnostico.experiencias, href: sitio("avanzado") },
    { ...diagnostico.cobros, href: `${base}/pagos` },
    { ...diagnostico.botEntrenado, href: `${base}/camila` },
    { ...diagnostico.reglas, href: sitio("avanzado") },
    { ...diagnostico.publicado, href: sitio() },
  ].map((t) => ({ ok: t.ok, label: t.label, aviso: t.aviso, href: t.href }));

  const hechas = tareas.filter((t) => t.ok).length;
  const total = tareas.length;
  const completo = hechas === total;

  const [abierto, setAbierto] = useState(!completo);

  function verTour() {
    window.dispatchEvent(new Event("kora:iniciar-tour"));
  }

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-kora-text">
            {completo ? "✓ Configuración completa" : "Primeros pasos"}
          </h2>
          <p className="text-sm text-kora-muted">
            {completo
              ? "Tu hotel está listo para recibir reservas."
              : `Termina de configurar tu hotel (${hechas}/${total}).`}
          </p>
        </div>
        <button
          onClick={() => setAbierto((v) => !v)}
          className="shrink-0 text-kora-muted hover:text-kora-text"
          aria-label={abierto ? "Contraer" : "Expandir"}
        >
          {abierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {!completo && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-kora-primary transition-all"
            style={{ width: `${(hechas / total) * 100}%` }}
          />
        </div>
      )}

      {abierto && (
        <ul className="mt-4 space-y-2">
          {tareas.map((t) => (
            <li key={t.label} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    t.ok ? "bg-green-100 text-green-700" : "bg-black/5 text-gray-400"
                  }`}
                >
                  <Check size={13} />
                </span>
                <span className={t.ok ? "text-kora-text" : "text-kora-muted"}>{t.label}</span>
              </span>
              {!t.ok && (
                <a
                  href={t.href}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-kora-primary hover:underline"
                >
                  Completar <ArrowRight size={12} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {diagnostico.temporadas.estado !== "ok" && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-amber-900">Precios de temporada</p>
            <p className="mt-0.5 text-amber-800">{diagnostico.temporadas.mensaje}</p>
            <a
              href={sitio("avanzado")}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
            >
              Cargar temporadas <ArrowRight size={12} />
            </a>
          </div>
        </div>
      )}

      <button
        onClick={verTour}
        className="btn-press mt-4 inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-kora-text hover:border-kora-accent"
      >
        <Sparkles size={15} className="text-kora-primary" /> Ver el tour otra vez
      </button>
    </section>
  );
}
