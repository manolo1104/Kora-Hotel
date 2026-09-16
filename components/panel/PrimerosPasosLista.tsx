"use client";

// La parte interactiva de «Primeros pasos» (abrir/cerrar y relanzar el tour).
// Las tareas llegan YA calculadas desde el servidor (`PrimerosPasos.tsx`):
// saber si los cobros de verdad cobran o si el motor está en modo prueba
// necesita la service-role, y eso no puede vivir en el navegador.

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { TareaPrimerosPasos } from "@/lib/panel/primeros-pasos";

export default function PrimerosPasosLista({
  tareas,
  hechas,
  total,
  completo,
  sinPublicar,
  editorHref,
  temporadas,
}: {
  tareas: TareaPrimerosPasos[];
  hechas: number;
  total: number;
  completo: boolean;
  /** El dueño despublicó su sitio: su página y su motor no reciben reservas. */
  sinPublicar: boolean;
  editorHref: string;
  /** Aviso de precios de temporada, o null si están bien. */
  temporadas: { mensaje: string; href: string } | null;
}) {
  const [abierto, setAbierto] = useState(!completo);

  function verTour() {
    window.dispatchEvent(new Event("kora:iniciar-tour"));
  }

  const probar = tareas.filter((t) => t.grupo === "probar");
  const configurar = tareas.filter((t) => t.grupo === "configurar");

  return (
    <section className="rounded-2xl border border-panel-contrast/10 bg-panel-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-kora-text">
            {completo ? "✓ Configuración completa" : "Primeros pasos"}
          </h2>
          <p className="text-sm text-kora-muted">
            {completo
              ? "Tu hotel está listo para recibir reservas."
              : `Pruébalo por dentro y termina de configurar tu hotel (${hechas}/${total}).`}
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

      {!completo && total > 0 && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-panel-contrast/5">
          <div
            className="h-full rounded-full bg-kora-primary transition-all"
            style={{ width: `${(hechas / total) * 100}%` }}
          />
        </div>
      )}

      {sinPublicar && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-amber-900">Tu sitio está sin publicar</p>
            <p className="mt-0.5 text-amber-800">
              Mientras siga así, tu página y tu motor no reciben reservas.
            </p>
            <a
              href={editorHref}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
            >
              Publicarlo <ArrowRight size={12} aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {abierto && (
        <div className="mt-4 space-y-4">
          {probar.length > 0 && <Grupo titulo="Pruébalo" tareas={probar} />}
          {configurar.length > 0 && <Grupo titulo="Configúralo" tareas={configurar} />}
        </div>
      )}

      {temporadas && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-amber-900">Precios de temporada</p>
            <p className="mt-0.5 text-amber-800">{temporadas.mensaje}</p>
            <a
              href={temporadas.href}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline"
            >
              Cargar temporadas <ArrowRight size={12} aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      <button
        onClick={verTour}
        className="btn-press mt-4 inline-flex items-center gap-2 rounded-full border border-panel-border px-4 py-2 text-sm font-semibold text-kora-text hover:border-kora-accent"
      >
        <Sparkles size={15} className="text-kora-primary" /> Ver el tour otra vez
      </button>
    </section>
  );
}

function Grupo({ titulo, tareas }: { titulo: string; tareas: TareaPrimerosPasos[] }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-kora-muted">{titulo}</p>
      <ul className="mt-2 space-y-2">
        {tareas.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              {/* Sin estado medible → no hay palomita que ganar: un ícono neutro
                  en vez de un círculo vacío que parece «pendiente». */}
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                  t.ok === true
                    ? "bg-green-100 text-green-700"
                    : t.ok === null
                      ? "bg-kora-primary/10 text-kora-primary"
                      : "bg-panel-contrast/5 text-panel-faint"
                }`}
                aria-hidden="true"
              >
                {t.ok === null ? <ArrowRight size={12} /> : <Check size={13} />}
              </span>
              <span className="min-w-0">
                <span className={`block ${t.ok === true ? "text-kora-text" : "text-kora-muted"}`}>
                  <span className="sr-only">{t.ok === true ? "Hecho: " : t.ok === false ? "Pendiente: " : ""}</span>
                  {t.label}
                </span>
                {t.detalle && t.ok !== true && (
                  <span className="block text-xs text-panel-faint">{t.detalle}</span>
                )}
              </span>
            </span>
            {t.ok !== true && t.href && (
              <a
                href={t.href}
                {...(t.nuevaPestana ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-kora-primary hover:underline"
              >
                {t.accion}{" "}
                {t.nuevaPestana ? (
                  <ExternalLink size={12} aria-hidden="true" />
                ) : (
                  <ArrowRight size={12} aria-hidden="true" />
                )}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
