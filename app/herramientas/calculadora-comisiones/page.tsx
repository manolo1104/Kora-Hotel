import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { CalculadoraComisiones } from "@/components/herramientas/CalculadoraComisiones";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Calculadora de comisiones de Booking y OTAs (gratis) | Kora",
  description:
    "¿Cuánto te quita Booking, Airbnb y Expedia al año? Calcula gratis lo que pagas en comisiones de OTAs y cuánto te ahorrarías con reservas directas. Hecha para hoteles en México.",
  alternates: {
    canonical: "/herramientas/calculadora-comisiones",
  },
  openGraph: {
    title: "Calculadora de comisiones de Booking y OTAs (gratis)",
    description:
      "Calcula gratis cuánto pagas al año en comisiones de Booking, Airbnb y Expedia, y cuánto te quedarías con reservas directas.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/calculadora-comisiones`,
  },
};

const faqs = [
  {
    q: "¿Cuánto cobra Booking de comisión a un hotel?",
    a: "Booking.com cobra normalmente entre 15% y 18% de comisión por cada reserva, y puede subir si participas en programas como Preferente o Genius. Airbnb y Expedia manejan rangos similares (15% a 20%).",
  },
  {
    q: "¿Cómo se calculan las comisiones de las OTAs?",
    a: "Se aplican como un porcentaje sobre el valor total de cada reserva. Si recibes 40 reservas al mes de $2,200 con una comisión del 16%, pagas alrededor de $14,080 al mes (más de $168,000 al año) solo en comisiones.",
  },
  {
    q: "¿Cómo puedo reducir o dejar de pagar comisiones?",
    a: "La forma más directa es impulsar tus reservas directas: una página propia donde el huésped reserve sin intermediarios y atención inmediata por WhatsApp para no perder a quien escribe fuera de horario. Cada reserva directa es una comisión que no pagas.",
  },
  {
    q: "¿Esta calculadora es gratis?",
    a: "Sí, es completamente gratis y no necesitas registrarte para ver tu resultado. Solo dejas tus datos si quieres que te enviemos el reporte completo por WhatsApp.",
  },
];

export default function CalculadoraComisionesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora de comisiones de OTAs",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/calculadora-comisiones`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Calculadora gratuita para saber cuánto paga un hotel en comisiones a Booking, Airbnb y Expedia al año.",
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
              ¿Cuánto te quita Booking al año?
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Descubre en 30 segundos cuánto pagas en comisiones a Booking, Airbnb
              y Expedia — y cuánto te quedarías con reservas directas.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calculadora + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <CalculadoraComisiones />
      </section>

      {/* Contenido SEO: cómo funcionan las comisiones */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Por qué las comisiones de las OTAs te cuestan más de lo que crees
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Booking.com, Airbnb y Expedia llenan habitaciones, pero se quedan
                con una comisión de entre 15% y 20% de cada reserva. Para un hotel
                boutique, eso se traduce en decenas de miles de pesos al año que
                salen directo de tu utilidad.
              </p>
              <p>
                Además de la comisión, las OTAs se quedan con la relación con tu
                huésped: su correo, su WhatsApp y la posibilidad de que regrese
                contigo directo la próxima vez. Cada reserva que llega por una OTA
                es una reserva por la que pagas dos veces — en comisión y en
                dependencia.
              </p>
              <p>
                La salida no es pelearte con las OTAs, sino balancear: capturar
                tú las reservas directas que hoy se te escapan (las de quien te
                escribe a las 11 PM y nadie contesta) para que cada vez dependas
                menos de la comisión.
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

          {/* Enlace a más herramientas */}
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
