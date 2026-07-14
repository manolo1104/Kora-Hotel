import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { DiagnosticoHotel } from "@/components/herramientas/DiagnosticoHotel";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Diagnóstico: ¿qué tan dependiente eres de Booking? (gratis) | Kora",
  description:
    "Responde 6 preguntas y descubre qué tan dependiente es tu hotel de Booking y las OTAs. Recibe un puntaje de salud y un plan de acción gratis, hecho para México.",
  alternates: {
    canonical: "/herramientas/diagnostico",
  },
  openGraph: {
    title: "Diagnóstico: ¿qué tan dependiente eres de Booking? (gratis)",
    description:
      "Responde 6 preguntas y descubre qué tan dependiente es tu hotel de las OTAs, con un puntaje y un plan de acción.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/diagnostico`,
  },
};

const faqs = [
  {
    q: "¿Qué mide este diagnóstico?",
    a: "Mide qué tan dependiente es tu hotel de las OTAs (Booking, Airbnb, Expedia) y qué tan sano es su control en 6 áreas clave: dependencia de OTAs, reservas directas, respuesta 24/7, precio dinámico, control financiero y gestión de reservas. Al final recibes un puntaje del 0 al 100 y un plan de qué atacar primero.",
  },
  {
    q: "¿Por qué importa no depender tanto de Booking?",
    a: "Porque cada reserva por una OTA te cuesta entre 15% y 20% de comisión, y además la OTA se queda con la relación con tu huésped. Mientras más dependas de ellas, menos margen y menos control tienes sobre tu propio hotel.",
  },
  {
    q: "¿Cuánto tarda y es gratis?",
    a: "Toma menos de 2 minutos y es completamente gratis. No necesitas registrarte para ver tu resultado; solo dejas tus datos si quieres que te enviemos el plan de acción por WhatsApp.",
  },
];

export default function DiagnosticoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Diagnóstico de dependencia de Booking para hoteles",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/diagnostico`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Test gratuito de 6 preguntas para medir qué tan dependiente es un hotel de las OTAs y dónde mejorar.",
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
              Diagnóstico gratis · 2 minutos
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              ¿Qué tan dependiente eres de Booking?
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Responde 6 preguntas y descubre el puntaje de salud de tu hotel — y
              exactamente por dónde empezar a depender menos de las OTAs.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Quiz + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <DiagnosticoHotel />
      </section>

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Depender de Booking no es malo — depender solo de Booking, sí
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Las OTAs son una gran vitrina: te dan visibilidad y huéspedes que
                de otra forma no llegarían. El problema empieza cuando son tu único
                canal. Ahí pagas comisión por cada reserva, pierdes la relación con
                el huésped y quedas a merced de sus reglas y su algoritmo.
              </p>
              <p>
                Un hotel sano combina canales: usa las OTAs para llenar huecos,
                pero captura por su cuenta las reservas directas — las de quien ya
                te conoce, te recomienda o te escribe por WhatsApp. Cada reserva
                directa es margen que se queda contigo.
              </p>
              <p>
                Este diagnóstico te ayuda a ver, sin maquillaje, dónde está hoy tu
                hotel y qué palanca mover primero para ganar independencia.
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
