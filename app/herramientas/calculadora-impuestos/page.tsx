import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { CalculadoraImpuestos } from "@/components/herramientas/CalculadoraImpuestos";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Calculadora de IVA e Impuesto al Hospedaje para hoteles (gratis) | Kora",
  description:
    "Calcula gratis el IVA y el Impuesto al Hospedaje (ISH) de tus reservas y desglosa cualquier monto. Hecha para hoteles en México.",
  alternates: {
    canonical: "/herramientas/calculadora-impuestos",
  },
  openGraph: {
    title: "Calculadora de IVA e Impuesto al Hospedaje para hoteles (gratis)",
    description:
      "Calcula el IVA y el Impuesto al Hospedaje de tus reservas y desglosa cualquier monto en segundos.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/calculadora-impuestos`,
  },
};

const faqs = [
  {
    q: "¿Qué impuestos paga un hotel en México?",
    a: "Principalmente dos sobre el hospedaje: el IVA (16% general, u 8% en la franja fronteriza) y el Impuesto al Hospedaje (ISH), que es un impuesto estatal que va del 2% al 5% según el estado. Ambos se calculan sobre la tarifa de hospedaje (la base, antes de impuestos).",
  },
  {
    q: "¿Cuánto es el Impuesto al Hospedaje en mi estado?",
    a: "Varía por estado: suele estar entre 2% y 4%. Por ejemplo, San Luis Potosí maneja 2%, Ciudad de México 3.5% y otros estados 3%. Como las tasas se actualizan, confirma la vigente con tu contador o la tesorería de tu estado.",
  },
  {
    q: "¿El Impuesto al Hospedaje lo paga el huésped o el hotel?",
    a: "El ISH lo paga el huésped, pero el hotel es responsable de cobrarlo, desglosarlo y enterarlo (pagarlo) a la tesorería del estado. Por eso conviene que aparezca claro en tu cotización y en tu factura.",
  },
  {
    q: "¿Esta calculadora es gratis?",
    a: "Sí, es completamente gratis y no necesitas registrarte. Es una herramienta orientativa, no asesoría fiscal: para tus declaraciones apóyate siempre en tu contador.",
  },
];

export default function CalculadoraImpuestosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora de IVA e Impuesto al Hospedaje",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/calculadora-impuestos`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Calculadora gratuita para desglosar el IVA y el Impuesto al Hospedaje de las reservas de un hotel en México.",
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main className="pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Herramienta gratis
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              IVA e Impuesto al Hospedaje, sin dolores de cabeza
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Desglosa cualquier monto de tu hotel en segundos: cuánto es tarifa,
              cuánto IVA, cuánto Impuesto al Hospedaje y cuánto cobrarle al huésped.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calculadora + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <CalculadoraImpuestos />
      </section>

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Cobrar bien los impuestos también es cuidar tu utilidad
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Muchos hoteles pequeños cotizan “precios cerrados” sin separar los
                impuestos, y al final terminan absorbiendo el IVA o el Impuesto al
                Hospedaje de su propia utilidad. Otros los cobran de más por no
                tener claro el desglose y generan confusión con el huésped.
              </p>
              <p>
                Tener el desglose claro te sirve para dos cosas: cotizar con
                transparencia y cobrar lo correcto. El IVA y el ISH se calculan
                sobre la tarifa de hospedaje (la base) y conviene mostrarlos
                separados en tu cotización.
              </p>
              <p>
                El reto no es la fórmula —es hacerlo en cada reserva, todos los
                días, sin equivocarse. Ahí es donde tener el desglose automático en
                cada reserva deja de ser un lujo y se vuelve un alivio.
              </p>
            </div>
          </Reveal>

          {/* FAQ */}
          <Reveal>
            <h2 className="mt-14 text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Preguntas frecuentes
            </h2>
          </Reveal>
          <div className="mt-6 space-y-4">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={0.05 + i * 0.06}>
                <div className="bg-kora-bg rounded-2xl p-5 sm:p-6 border border-gray-100">
                  <h3 className="font-bold text-kora-text text-base mb-2">
                    {f.q}
                  </h3>
                  <p className="text-sm text-kora-muted leading-relaxed">{f.a}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="mt-12 text-center text-sm text-kora-muted">
              Ver todas las{" "}
              <Link
                href="/herramientas"
                className="font-semibold text-kora-primary underline hover:text-kora-primary-dark"
              >
                herramientas gratis para hoteles
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
