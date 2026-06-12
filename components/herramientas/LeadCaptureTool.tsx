"use client";

import { useState } from "react";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const WA_FALLBACK_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20us%C3%A9%20una%20calculadora%20de%20Kora%20y%20quiero%20mi%20reporte`;

interface LeadCaptureToolProps {
  /** Título dentro del recuadro de captura */
  title: string;
  /** Texto de apoyo bajo el título */
  subtitle: string;
  /** Texto del botón */
  buttonText: string;
  /** Identifica de qué herramienta viene el lead (campo oculto en Formspree) */
  herramienta: string;
  /**
   * Campos ocultos extra que viajan con el lead (ej. el resultado calculado),
   * para que llegue ya con el dolor cuantificado.
   */
  hiddenFields?: Record<string, string>;
}

/**
 * Captura de lead ligera para las herramientas gratuitas.
 * Misma lógica que ContactForm (Formspree + honeypot + fallback WhatsApp),
 * pero con menos campos para no frenar al usuario dentro de la herramienta.
 */
export function LeadCaptureTool({
  title,
  subtitle,
  buttonText,
  herramienta,
  hiddenFields = {},
}: LeadCaptureToolProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);

    const data = new FormData(e.currentTarget);

    // Honeypot: si trae texto, es un bot. Fingimos éxito sin enviar nada.
    if (data.get("_gotcha")) {
      setSent(true);
      return;
    }

    setLoading(true);
    try {
      // El lead cae directo al CRM de Kora (y de ahí se avisa al fundador).
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      if (res.ok) {
        setSent(true);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-100 shadow-sm">
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="text-center py-6"
          >
            <div className="w-14 h-14 rounded-full bg-kora-accent/15 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-kora-primary" />
            </div>
            <h3 className="text-xl font-bold text-kora-text mb-2">¡Recibido!</h3>
            <p className="text-kora-muted text-sm leading-relaxed">
              Te enviamos tu reporte por WhatsApp en menos de 24 horas.
              <br />
              Revisa que tu número esté correcto.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-kora-text">
                {title}
              </h3>
              <p className="mt-1 text-sm text-kora-muted leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Honeypot anti-spam */}
            <input
              type="text"
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            {/* Campos ocultos de contexto (herramienta + resultado calculado) */}
            <input type="hidden" name="herramienta" value={herramienta} />
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lead-name"
                  className="block text-sm font-semibold text-kora-text mb-1.5"
                >
                  Tu nombre
                </label>
                <input
                  id="lead-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Manolo Covarrubias"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                />
              </div>
              <div>
                <label
                  htmlFor="lead-whatsapp"
                  className="block text-sm font-semibold text-kora-text mb-1.5"
                >
                  WhatsApp
                </label>
                <input
                  id="lead-whatsapp"
                  name="whatsapp"
                  type="tel"
                  required
                  placeholder="+52 489 123 4567"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="lead-hotel"
                className="block text-sm font-semibold text-kora-text mb-1.5"
              >
                Nombre de tu hotel{" "}
                <span className="font-normal text-kora-muted">(opcional)</span>
              </label>
              <input
                id="lead-hotel"
                name="hotel"
                type="text"
                placeholder="Hotel Paraíso Encantado"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 leading-relaxed"
              >
                No pudimos enviar tu solicitud. Escríbenos directo por{" "}
                <a
                  href={WA_FALLBACK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-red-900"
                >
                  WhatsApp
                </a>{" "}
                y te mandamos tu reporte.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-press btn-fill w-full py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-base hover:bg-kora-accent-dark transition-colors disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Enviando...
                </>
              ) : (
                <>
                  {buttonText}
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>

            <p className="text-xs text-kora-muted text-center leading-relaxed">
              Te escribimos por WhatsApp. Sin llamadas en frío. Sin spam.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
