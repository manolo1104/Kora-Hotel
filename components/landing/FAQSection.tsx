"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const EASE = [0.23, 1, 0.32, 1] as const;

const faqs = [
  {
    question: "¿Necesito saber de tecnología para usar Kora?",
    answer:
      "No. Nosotros instalamos todo, capacitamos a tu equipo y quedamos disponibles por WhatsApp. Si sabes usar tu celular, sabes usar Kora.",
  },
  {
    question: "¿Qué pasa con mis reservas actuales en Booking o Airbnb?",
    answer:
      "Kora se conecta con tus OTAs existentes. No pierdes reservas, solo empiezas a capturar las que antes perdías.",
  },
  {
    question: "¿Cuánto tiempo tarda la implementación?",
    answer:
      "48 a 72 horas. Tú nos das acceso y nosotros configuramos todo. Tu equipo recibe capacitación antes de arrancar.",
  },
  {
    question: "¿Funciona sin internet estable?",
    answer:
      "Sí. Kora tiene modo offline para operaciones básicas (check-in, check-out) que se sincronizan cuando regresa la conexión.",
  },
  {
    question: "¿Incluye la facturación electrónica (CFDI)?",
    answer:
      "Sí, Kora genera CFDI 4.0 directamente desde cada reserva, integrado con el SAT.",
  },
  {
    question: "¿Puedo exportar todos mis datos si cancelo?",
    answer:
      "Sí. Tus datos son tuyos. Antes de cancelar puedes exportar todo: reservas, huéspedes, historial de pagos e informes en formato CSV y PDF. Nunca quedarás rehén del sistema.",
  },
  {
    question: "¿Cómo funciona el agente de llamadas exactamente?",
    answer:
      "El agente contesta en tu nombre con voz natural en español. Responde preguntas frecuentes, cotiza disponibilidad, y cuando el huésped quiere reservar, captura sus datos y los registra directamente en el PMS. No suena a robot y no requiere que tu equipo esté disponible.",
  },
  {
    question: "¿El agente de WhatsApp puede cerrar reservas por sí solo?",
    answer:
      "Sí. Consulta disponibilidad en tiempo real, informa precios, envía el link de pago directo y confirma la reserva, todo sin intervención humana. Tu equipo solo entra cuando hay algo fuera de lo ordinario.",
  },
  {
    question: "¿Tienen API para conectar otros sistemas que ya uso?",
    answer:
      "Sí. Kora tiene API REST documentada para integrarse con tu channel manager, sistema de facturación o cualquier herramienta externa. Para hoteles en el plan fundador, hacemos la integración nosotros sin costo adicional.",
  },
  {
    question: "¿Qué pasa si necesito ayuda a las 11 de la noche?",
    answer:
      "Tienes acceso directo a nuestro WhatsApp de soporte. Respondemos en menos de 2 horas en horario extendido. Para incidentes críticos del sistema (el motor de reservas caído, por ejemplo) el tiempo de respuesta es de 30 minutos, cualquier hora.",
  },
];

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
              className="border border-gray-200 rounded-2xl overflow-hidden"
              role="listitem"
            >
              <button
                className="w-full flex items-center justify-between p-5 sm:p-6 text-left bg-white hover:bg-gray-50 transition-colors"
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
      </div>
    </section>
  );
}
