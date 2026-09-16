"use client";

import { useState } from "react";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { trackLead } from "@/lib/analytics";
import { waLink } from "@/lib/contacto";
import { GARANTIA, RUTA_REGISTRO } from "@/lib/oferta";
import { CtaLink } from "@/components/shared/CtaLink";

const WA_FALLBACK_URL = waLink("Hola, usé una calculadora de Kora y quiero mi reporte");

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

    // La trampa anti-robots la resuelve el SERVIDOR (app/api/leads: responde
    // éxito falso y no guarda nada). Aquí se quitó a propósito el 15 sep 2026:
    // el campo es un <input type="text"> oculto, y hay gestores de contraseñas
    // que rellenan campos ocultos. Cuando eso pasaba, a una persona real se le
    // pintaba «¡Recibido!» y su mensaje no salía de su navegador: ni una línea
    // en los registros, imposible de detectar. Dejándoselo al servidor, por lo
    // menos queda el intento.

    setLoading(true);
    try {
      // El lead cae directo al CRM de Kora (y de ahí se avisa al fundador).
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      if (res.ok) {
        // Sin esto, los leads de las 18 herramientas gratis salían con CERO
        // conversiones en GA4 y en Google Ads, y las campañas se optimizaban
        // como si esas palabras clave no convirtieran. El formulario hermano de
        // la landing sí lo hacía (components/landing/ContactForm.tsx).
        trackLead("herramienta");
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
              {/* Decía «en menos de 24 horas». El reporte lo manda una persona
                  y nadie mide ese plazo: no se promete (mismo criterio que
                  ContactForm desde el 15 sep 2026). */}
              Te enviamos tu reporte por WhatsApp.
              <br />
              Revisa que tu número esté correcto.
            </p>

            {/* Quien acaba de dejar sus datos es el prospecto más caliente de
                la página, y hasta el 15 sep 2026 aquí sólo se le decía que
                esperara nuestro WhatsApp. Mientras llega, lo más útil que puede
                hacer es probar Kora con su propio hotel: el registro es el
                camino principal del sitio (decisión de Manolo). */}
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-sm font-semibold text-kora-text">
                Mientras tanto, pruébalo con tu hotel
              </p>
              <p className="mt-1 text-xs text-kora-muted leading-relaxed">
                Crea tu cuenta y tienes {GARANTIA.diasPrueba} días gratis, sin
                tarjeta.
              </p>
              <CtaLink
                href={RUTA_REGISTRO}
                ctaName={`lead_herramienta_registro:${herramienta}`}
                className="btn-press btn-arrow btn-fill mt-4 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-kora-primary text-white font-bold text-sm hover:bg-kora-primary-dark transition-colors"
              >
                Crear mi cuenta gratis
                <ArrowRight size={16} aria-hidden="true" />
              </CtaLink>
            </div>
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
                  WhatsApp{" "}
                  <span className="font-normal text-kora-muted">(opcional)</span>
                </label>
                <input
                  id="lead-whatsapp"
                  name="whatsapp"
                  type="tel"
                  placeholder="+52 489 123 4567"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="lead-email"
                className="block text-sm font-semibold text-kora-text mb-1.5"
              >
                Tu correo
              </label>
              <input
                id="lead-email"
                name="email"
                type="email"
                required
                placeholder="tu@hotel.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
              />
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
