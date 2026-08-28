import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { FirmaKora } from "@/components/herramientas/FirmaKora";
import { CalculadoraPuntoEquilibrio } from "@/components/herramientas/CalculadoraPuntoEquilibrio";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Calculadora de punto de equilibrio para hoteles (gratis) | Kora",
  description:
    "Calcula gratis cuántas noches necesitas vender al mes para no perder dinero en tu hotel. Punto de equilibrio y ocupación mínima rentable, hecho para México.",
  alternates: {
    canonical: "/herramientas/punto-de-equilibrio",
  },
  openGraph: {
    title: "Calculadora de punto de equilibrio para hoteles (gratis)",
    description:
      "Calcula cuántas noches necesitas vender al mes para no perder dinero en tu hotel.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/punto-de-equilibrio`,
  },
};

const faqs = [
  {
    q: "¿Qué es el punto de equilibrio de un hotel?",
    a: "Es el número de noches (o el porcentaje de ocupación) que necesitas vender para que tus ingresos cubran exactamente tus gastos: ni ganas ni pierdes. Todo lo que vendas por encima de ese punto es ganancia; todo lo que vendas por debajo es pérdida.",
  },
  {
    q: "¿Cómo se calcula?",
    a: "Punto de equilibrio (en noches) = gastos fijos del mes ÷ (tarifa promedio − costo por noche ocupada). El costo por noche incluye limpieza, amenidades, lavandería y las comisiones que pagas a las OTAs por esa reserva.",
  },
  {
    q: "¿Por qué las comisiones suben mi punto de equilibrio?",
    a: "Porque la comisión es un costo por cada reserva: reduce lo que realmente ganas por noche. Mientras más alto sea tu costo por noche, más noches necesitas vender para no perder. Cada reserva directa, sin comisión, baja tu punto de equilibrio.",
  },
  {
    q: "¿Esta calculadora es gratis?",
    a: "Sí, es completamente gratis y no necesitas registrarte para ver tu resultado. Solo dejas tus datos si quieres que te enviemos el reporte de rentabilidad por WhatsApp.",
  },
];

export default function PuntoEquilibrioPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora de punto de equilibrio para hoteles",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/punto-de-equilibrio`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Calculadora gratuita para saber cuántas noches necesita vender un hotel al mes para no perder dinero.",
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
              ¿Cuántas noches necesitas vender para no perder?
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Calcula tu punto de equilibrio en 30 segundos y sabe exactamente
              cuántas reservas al mes te separan de las pérdidas… y de la ganancia.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calculadora + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <CalculadoraPuntoEquilibrio />
      </section>

      {/* Firma de marca pegada a la herramienta: quien llega de Google la usa
          y se va sin bajar más, así que aquí es donde tiene que ver de quién es. */}
      <FirmaKora />

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              El número que todo hotelero debería conocer de memoria
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Muchos dueños de hotel sienten si el mes fue bueno o malo, pero
                pocos saben exactamente a partir de qué reserva empiezan a ganar.
                El punto de equilibrio te da ese número: la línea que separa perder
                de ganar.
              </p>
              <p>
                Conocerlo cambia cómo decides. Sabes hasta dónde puedes bajar una
                tarifa sin trabajar a pérdida, cuántas habitaciones necesitas
                mover en un puente, y qué tanto te aprieta cada gasto fijo nuevo.
              </p>
              <p>
                Y revela algo incómodo: las comisiones de las OTAs suben tu punto
                de equilibrio, porque encarecen cada reserva. Mientras más dependas
                de Booking y Airbnb, más noches necesitas vender solo para quedar
                a mano. Las reservas directas hacen exactamente lo contrario.
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
