"use client";

import { useState } from "react";
import { ArrowRight, Copy, Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

export interface CampoDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  required?: boolean;
  default?: string;
}

interface GeneradorIAProps {
  tipo: string;
  tituloCard: string;
  subtituloCard: string;
  campos: CampoDef[];
  botonLabel: string;
  resultadoLabel: string;
  // lead/kora son los bloques de captación y CTA de registro (solo para la página
  // pública). En el panel se ocultan con ocultarLead/ocultarCta.
  lead?: { herramienta: string; title: string; subtitle: string; button: string };
  kora?: { badge: string; titulo: string; texto: string; utm: string };
  ocultarLead?: boolean;
  ocultarCta?: boolean;
}

export function GeneradorIA({
  tipo,
  tituloCard,
  subtituloCard,
  campos,
  botonLabel,
  resultadoLabel,
  lead,
  kora,
  ocultarLead = false,
  ocultarCta = false,
}: GeneradorIAProps) {
  const inicial: Record<string, string> = {};
  for (const c of campos) inicial[c.name] = c.default ?? "";

  const [datos, setDatos] = useState<Record<string, string>>(inicial);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  function set(name: string, value: string) {
    setDatos((d) => ({ ...d, [name]: value }));
  }

  const faltanRequeridos = campos.some(
    (c) => c.required && !datos[c.name]?.trim()
  );

  async function generar() {
    if (faltanRequeridos || loading) return;
    setLoading(true);
    setError("");
    setResultado("");
    try {
      const res = await fetch("/api/herramientas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, datos }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No pudimos generar el texto.");
      } else {
        setResultado(json.texto || "");
      }
    } catch {
      setError("Hubo un problema de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Formulario */}
        <Reveal>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-kora-text">{tituloCard}</h2>
            <p className="text-sm text-kora-muted mt-0.5 mb-4">{subtituloCard}</p>

            <div className="space-y-4">
              {campos.map((c) => (
                <div key={c.name}>
                  <label
                    htmlFor={c.name}
                    className="block text-sm font-semibold text-kora-text mb-1.5"
                  >
                    {c.label}
                    {!c.required && (
                      <span className="font-normal text-kora-muted"> (opcional)</span>
                    )}
                  </label>
                  {c.type === "textarea" ? (
                    <textarea
                      id={c.name}
                      className={inputCls}
                      rows={4}
                      value={datos[c.name]}
                      onChange={(e) => set(c.name, e.target.value)}
                      placeholder={c.placeholder}
                    />
                  ) : c.type === "select" ? (
                    <select
                      id={c.name}
                      className={inputCls}
                      value={datos[c.name]}
                      onChange={(e) => set(c.name, e.target.value)}
                    >
                      <option value="" disabled>
                        Selecciona…
                      </option>
                      {c.options?.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={c.name}
                      className={inputCls}
                      value={datos[c.name]}
                      onChange={(e) => set(c.name, e.target.value)}
                      placeholder={c.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={generar}
              disabled={faltanRequeridos || loading}
              className="btn-press btn-fill w-full mt-5 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Generando…
                </>
              ) : (
                <>
                  <Wand2 size={16} aria-hidden="true" />
                  {botonLabel}
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-kora-muted text-center">
              Lo genera una IA. Revísalo y ajústalo antes de enviarlo.
            </p>
          </div>
        </Reveal>

        {/* Resultado */}
        <Reveal delay={0.1}>
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm min-h-[260px] flex flex-col">
            <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-3">
              {resultadoLabel}
            </p>

            {error ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-red-600 text-center px-4">{error}</p>
              </div>
            ) : resultado ? (
              <>
                <div className="flex-1 rounded-xl bg-kora-bg p-4 text-sm text-kora-text leading-relaxed whitespace-pre-line">
                  {resultado}
                </div>
                <button
                  type="button"
                  onClick={copiar}
                  className="btn-press mt-4 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
                >
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                  {copiado ? "¡Copiado!" : "Copiar texto"}
                </button>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-kora-muted px-4">
                <Wand2 size={28} className="mb-3 opacity-40" aria-hidden="true" />
                <p className="text-sm">
                  Llena los datos y tu texto aparecerá aquí en segundos.
                </p>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* CAPA 2 */}
      {!ocultarLead && lead && (
        <Reveal>
          <div className="mt-10">
            <LeadCaptureTool
              herramienta={lead.herramienta}
              title={lead.title}
              subtitle={lead.subtitle}
              buttonText={lead.button}
            />
          </div>
        </Reveal>
      )}

      {/* CAPA 3 */}
      {!ocultarCta && kora && (
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              {kora.badge}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            {kora.titulo}
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            {kora.texto}
          </p>
          <a
            href={`/#contacto?utm_source=${kora.utm}`}
            className="btn-press btn-arrow btn-fill mt-6 inline-flex items-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Ver cómo funciona Kora
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </Reveal>
      )}
    </div>
  );
}
