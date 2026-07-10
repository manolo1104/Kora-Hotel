"use client";

import { useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { faqs } from "@/lib/faqs";
import { trackCta } from "@/lib/analytics";

const EASE = [0.23, 1, 0.32, 1] as const;

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-12 text-center">
          Preguntas frecuentes
        </h2>

        <div className="space-y-2" role="list">
          {faqs.slice(0, 8).map((faq, i) => (
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

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    key="content"
                    id={`faq-answer-${i}`}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-kora-muted text-sm sm:text-base leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Cierre del embudo: la última duda resuelta merece un CTA a la mano. */}
        <div className="mt-12 text-center">
          <p className="text-kora-muted text-sm">
            ¿Sin más dudas? Pruébalo con tu hotel: hoy no se cobra nada.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/pago/iniciar?plan=kora"
              onClick={() => trackCta("faq_pago")}
              className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Empezar 30 días gratis
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href="/panel/onboarding"
              onClick={() => trackCta("faq_onboarding")}
              className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
            >
              Cargar mi hotel — sin tarjeta
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
