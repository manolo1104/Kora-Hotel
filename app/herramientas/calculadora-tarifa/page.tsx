import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { FirmaKora } from "@/components/herramientas/FirmaKora";
import { CalculadoraTarifa } from "@/components/herramientas/CalculadoraTarifa";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Calculadora de RevPAR y tarifa de hotel (gratis) | Kora",
  description:
    "Calcula gratis tu RevPAR y descubre si estás cobrando de más o de menos por tus habitaciones. Herramienta de pricing para hoteles boutique en México.",
  alternates: {
    canonical: "/herramientas/calculadora-tarifa",
  },
  openGraph: {
    title: "Calculadora de RevPAR y tarifa de hotel (gratis)",
    description:
      "Calcula tu RevPAR y descubre si estás cobrando de más o de menos por tus habitaciones.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/calculadora-tarifa`,
  },
};

const faqs = [
  {
    q: "¿Qué es el RevPAR de un hotel?",
    a: "RevPAR (Revenue Per Available Room) es el ingreso por habitación disponible. Se calcula multiplicando tu tarifa promedio por noche (ADR) por tu porcentaje de ocupación. Es la métrica más usada en hotelería porque combina precio y ocupación en un solo número: mide qué tan bien estás aprovechando tu hotel.",
  },
  {
    q: "¿Cómo sé si estoy cobrando de más o de menos?",
    a: "Una pista rápida: si tu ocupación es muy alta (arriba del 85%) de forma constante, casi siempre estás cobrando de menos y podrías subir la tarifa. Si la ocupación es muy baja, bajar el precio rara vez es la solución completa; el problema suele ser visibilidad y reservas que se pierden.",
  },
  {
    q: "¿Qué es el precio dinámico?",
    a: "Es ajustar la tarifa según la demanda: subir en puentes, fines de semana y eventos locales, y bajar en fechas flojas para llenar. Hacerlo a mano es difícil; un sistema con precio dinámico lo hace automáticamente y suele aumentar el RevPAR sin perder ocupación.",
  },
  {
    q: "¿Esta calculadora es gratis?",
    a: "Sí, es totalmente gratis y no necesitas registrarte para ver tu resultado. Solo dejas tus datos si quieres que te enviemos el reporte de pricing por WhatsApp.",
  },
];

export default function CalculadoraTarifaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora de RevPAR y tarifa de hotel",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/calculadora-tarifa`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Calculadora gratuita de RevPAR para saber si un hotel está cobrando de más o de menos por sus habitaciones.",
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
              Herramienta gratis de Kora
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              ¿Estás cobrando bien por tus habitaciones?
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Calcula tu RevPAR en 30 segundos y descubre si estás dejando dinero
              en la mesa — o si puedes subir tu tarifa sin perder huéspedes.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calculadora + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <CalculadoraTarifa />
      </section>

      {/* Firma de marca pegada a la herramienta: quien llega de Google la usa
          y se va sin bajar más, así que aquí es donde tiene que ver de quién es. */}
      <FirmaKora />

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              El precio de tu habitación no debería ser el mismo todo el año
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                La mayoría de los hoteles pequeños cobran la misma tarifa un
                martes de febrero que un sábado de Semana Santa. El resultado:
                dejas dinero en la mesa en los días de alta demanda y te quedas
                con habitaciones vacías en los flojos.
              </p>
              <p>
                El RevPAR te ayuda a verlo claro porque junta precio y ocupación
                en un solo número. Subir la tarifa baja un poco la ocupación, pero
                muchas veces tu RevPAR sube — ganas más con menos huéspedes. El
                arte está en encontrar ese punto para cada fecha.
              </p>
              <p>
                Hacer ese ajuste a mano, día por día, es prácticamente imposible
                cuando además atiendes el hotel. Por eso el precio dinámico
                automático es de las palancas que más mueven la rentabilidad de un
                hotel boutique.
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
