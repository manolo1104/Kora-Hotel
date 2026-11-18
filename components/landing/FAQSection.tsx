"use client";

import { useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { faqs } from "@/lib/faqs";
import { CtaLink } from "@/components/shared/CtaLink";
import { GARANTIA, PRECIO_DESDE, RUTA_ACTIVAR, RUTA_REGISTRO } from "@/lib/oferta";

const EASE = [0.23, 1, 0.32, 1] as const;

// SEO (18 nov 2026): el FAQPage de la portada (app/page.tsx) marca TODAS las
// preguntas de lib/faqs.ts, así que aquí se pintan todas — antes se veían 8 de
// 13 — y las respuestas viven SIEMPRE en el HTML, plegadas con CSS. Antes se
// montaban sólo al abrir: Google no las veía y el marcado no casaba con la
// página. `tests/seo-contrato.test.ts` vigila las dos cosas.
export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-12 text-center">
          Preguntas frecuentes
        </h2>

        <div className="space-y-2" role="list">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`border rounded-2xl overflow-hidden transition-colors duration-200 ${
                open === i
                  ? "border-kora-accent/30 bg-kora-bg/40"
                  : "border-gray-200"
              }`}
              role="listitem"
            >
              <button
                className={`w-full flex items-center justify-between p-5 sm:p-6 text-left transition-colors ${
                  open === i ? "bg-transparent" : "bg-white hover:bg-gray-50"
                }`}
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
              >
                <span className="font-semibold text-kora-text pr-4 text-sm sm:text-base">
                  {faq.question}
                </span>
                <motion.span
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="flex-shrink-0"
                >
                  <ChevronDown size={18} className="text-kora-muted" aria-hidden="true" />
                </motion.span>
              </button>

              {/* Plegado con grid-rows (0fr ↔ 1fr): anima la altura sin
                  sacar el texto del DOM. */}
              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                  open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden" inert={open !== i}>
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-kora-muted text-sm sm:text-base leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cierre del embudo: la última duda resuelta merece un CTA a la mano. */}
        <div className="mt-12 text-center">
          <p className="text-kora-muted text-sm">
            ¿Sin más dudas? Crea tu cuenta y pruébalo con tu hotel:{" "}
            {GARANTIA.diasPrueba} días gratis, sin tarjeta.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <CtaLink
              href={RUTA_REGISTRO}
              ctaName="faq_onboarding"
              className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Crear mi cuenta gratis
              <ArrowRight size={16} aria-hidden="true" />
            </CtaLink>
            <CtaLink
              href={RUTA_ACTIVAR}
              ctaName="faq_pago"
              className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
            >
              Activar mi plan — ${PRECIO_DESDE.toLocaleString("es-MX")}/mes
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  );
}
