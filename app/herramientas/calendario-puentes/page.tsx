import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { CalendarioPuentes } from "@/components/herramientas/CalendarioPuentes";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Calendario de puentes y temporada alta para hoteles (gratis) | Kora",
  description:
    "Calendario de puentes, vacaciones y temporada alta en México con el porcentaje de alza sugerido para tu hotel. Pon tu tarifa y ve el precio recomendado en cada fecha.",
  alternates: {
    canonical: "/herramientas/calendario-puentes",
  },
  openGraph: {
    title: "Calendario de puentes y temporada alta para hoteles (gratis)",
    description:
      "Los puentes y temporadas altas de México con el precio sugerido para tu hotel en cada fecha.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/calendario-puentes`,
  },
};

const faqs = [
  {
    q: "¿Cuáles son las temporadas altas para los hoteles en México?",
    a: "Las de mayor demanda suelen ser Semana Santa y Pascua, el periodo de Navidad y Fin de Año (Guadalupe-Reyes), Día de Muertos y las vacaciones de verano. A eso se suman los puentes oficiales: Constitución (febrero), Benito Juárez (marzo), Revolución (noviembre), más Independencia y Año Nuevo.",
  },
  {
    q: "¿Cuánto debo subir mi tarifa en temporada alta?",
    a: "Depende de tu destino y tu ocupación, pero como referencia: en puentes suele subirse entre 15% y 25%, y en las fechas pico (Semana Santa, Día de Muertos, Navidad) entre 30% y 40%. Si tu hotel se llena con anticipación en esas fechas, es señal de que puedes subir más.",
  },
  {
    q: "¿Por qué cambian las fechas de los puentes cada año?",
    a: "Varios feriados se recorren al lunes más cercano (Constitución, Benito Juárez, Revolución), así que el puente cae en fechas distintas cada año. Semana Santa también se mueve porque depende del calendario lunar. Por eso conviene revisar el calendario oficial de cada año.",
  },
  {
    q: "¿Esta herramienta es gratis?",
    a: "Sí, es completamente gratis y no necesitas registrarte para ver los precios sugeridos. Solo dejas tus datos si quieres que te enviemos el calendario completo por WhatsApp.",
  },
];

export default function CalendarioPuentesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calendario de tarifas por puentes para hoteles",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/calendario-puentes`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Calendario gratuito de puentes y temporada alta en México con el precio sugerido por noche para tu hotel.",
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
              Calendario de puentes y temporada alta
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Pon tu tarifa normal y descubre cuánto podrías cobrar en cada puente
              y temporada alta de México — para dejar de regalar los días de mayor
              demanda.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calendario + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <CalendarioPuentes />
      </section>

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Los días de mayor demanda son donde más dinero se deja ir
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                En un puente o en Semana Santa, los huéspedes buscan con
                anticipación y están dispuestos a pagar más. Si mantienes tu tarifa
                de siempre, te llenas rápido… pero dejas dinero sobre la mesa que no
                vuelve.
              </p>
              <p>
                La idea no es abusar, sino cobrar lo que la fecha vale. Si tu hotel
                se llena semanas antes de un puente, es la señal más clara de que tu
                precio para esa fecha está bajo.
              </p>
              <p>
                El problema práctico es acordarse de subir (y luego bajar) los
                precios fecha por fecha, todo el año, mientras atiendes el hotel.
                Por eso el precio dinámico automático es de las herramientas que más
                impacto tienen en la rentabilidad de un hotel boutique.
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
