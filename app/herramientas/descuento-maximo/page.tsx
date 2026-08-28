import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { FirmaKora } from "@/components/herramientas/FirmaKora";
import { DescuentoMaximo } from "@/components/herramientas/DescuentoMaximo";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "¿Hasta cuánto puedo descontar en mi hotel sin perder? (gratis) | Kora",
  description:
    "Calcula gratis el descuento máximo que puedes dar en tu hotel sin trabajar a pérdida. Ideal para negociar grupos, convenios y tarifas de last-minute en México.",
  alternates: {
    canonical: "/herramientas/descuento-maximo",
  },
  openGraph: {
    title: "¿Hasta cuánto puedo descontar en mi hotel sin perder?",
    description:
      "Calcula el descuento máximo seguro para negociar grupos y last-minute sin trabajar a pérdida.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/descuento-maximo`,
  },
};

const faqs = [
  {
    q: "¿Cómo sé cuánto puedo descontar sin perder dinero?",
    a: "El límite es tu costo por noche ocupada (limpieza, amenidades, lavandería y comisiones). El descuento máximo sin pérdida = (tarifa − costo por noche) ÷ tarifa. Por debajo de tu costo, cada reserva te cuesta dinero en lugar de dejarte ganancia.",
  },
  {
    q: "¿Qué incluye el costo por noche?",
    a: "Los gastos que solo ocurren cuando la habitación se ocupa: limpieza, amenidades, lavandería, comisión de la OTA si aplica, y comisión de pago con tarjeta. No incluye gastos fijos como renta o nómina (esos los cubres con tu punto de equilibrio).",
  },
  {
    q: "¿Conviene descontar para llenar el hotel?",
    a: "A veces sí: una habitación vacía no genera nada, así que venderla con descuento (pero por encima de tu costo) siempre deja algo. La clave es no bajar del precio piso y usar los descuentos en fechas flojas o reservas de último minuto, no de forma permanente.",
  },
  {
    q: "¿Esta calculadora es gratis?",
    a: "Sí, es completamente gratis y no necesitas registrarte para ver tu resultado. Solo dejas tus datos si quieres que te enviemos la tabla de descuentos por WhatsApp.",
  },
];

export default function DescuentoMaximoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora de descuento máximo para hoteles",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/descuento-maximo`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Calculadora gratuita para saber hasta cuánto puede descontar un hotel sin trabajar a pérdida.",
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
              ¿Hasta cuánto puedes descontar sin perder?
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Antes de negociar un grupo o soltar una tarifa de last-minute, sabe
              exactamente cuál es tu precio piso — y cuánto te queda en cada
              escenario.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calculadora + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <DescuentoMaximo />
      </section>

      {/* Firma de marca pegada a la herramienta: quien llega de Google la usa
          y se va sin bajar más, así que aquí es donde tiene que ver de quién es. */}
      <FirmaKora />

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Descontar está bien — descontar a ciegas, no
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Llega un grupo, una agencia o alguien pidiendo tarifa para hoy
                mismo, y te presionan por un descuento. Si no sabes tu precio piso,
                terminas regalando margen — o peor, vendiendo por debajo de lo que
                te cuesta la habitación.
              </p>
              <p>
                La regla es simple: mientras vendas por encima de tu costo por
                noche, una habitación que iba a quedarse vacía siempre deja algo.
                El error es bajar del piso o convertir el descuento en tu precio de
                todos los días.
              </p>
              <p>
                Y un detalle clave: las comisiones de las OTAs forman parte de ese
                costo. Cuando la reserva es directa, tu costo por noche baja y tu
                margen para negociar crece — puedes ofrecer mejor precio y aun así
                ganar.
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
