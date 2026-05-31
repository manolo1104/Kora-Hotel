import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { TarifaNeta } from "@/components/herramientas/TarifaNeta";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Calculadora de tarifa neta: ¿a qué precio publicar en Booking? | Kora",
  description:
    "Calcula gratis a qué precio publicar en Booking o Airbnb para recibir lo que quieres después de la comisión, y cuánto más te deja cada reserva directa. Para hoteles en México.",
  alternates: {
    canonical: "/herramientas/tarifa-neta",
  },
  openGraph: {
    title: "Calculadora de tarifa neta: ¿a qué precio publicar en Booking?",
    description:
      "A qué precio publicar en la OTA para recibir lo que quieres tras la comisión, y cuánto más te deja el directo.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/tarifa-neta`,
  },
};

const faqs = [
  {
    q: "¿Cómo calculo el precio que debo publicar en Booking?",
    a: "Toma el precio neto que quieres recibir y divídelo entre (1 − comisión). Por ejemplo, si quieres recibir $1,500 y Booking te cobra 16%, debes publicar a $1,500 ÷ 0.84 = $1,786 para que después de la comisión te queden tus $1,500.",
  },
  {
    q: "¿Qué es la paridad de tarifas (rate parity)?",
    a: "Es la práctica (a veces exigida por las OTAs) de mostrar el mismo precio en todos los canales. El punto clave: aunque el precio sea el mismo, lo que TÚ recibes no lo es — en la OTA pierdes la comisión, y en directo te quedas con todo. Por eso conviene incentivar la reserva directa.",
  },
  {
    q: "¿Puedo cobrar más barato directo que en Booking?",
    a: "Las OTAs suelen pedir paridad en el precio público, pero casi siempre puedes ofrecer ventajas directas que no cuentan como romper paridad: descuento para clientes que regresan, late check-out, una bebida de bienvenida, o tarifas para reservas por WhatsApp. Así el huésped gana y tú no pagas comisión.",
  },
  {
    q: "¿Esta calculadora es gratis?",
    a: "Sí, es completamente gratis y no necesitas registrarte para ver tu resultado. Solo dejas tus datos si quieres que te enviemos la estrategia de precios por WhatsApp.",
  },
];

export default function TarifaNetaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Calculadora de tarifa neta por canal",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/tarifa-neta`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Calculadora gratuita para saber a qué precio publicar en las OTAs y cuánto más deja una reserva directa.",
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
              ¿A qué precio publicar en Booking?
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Descubre a qué precio publicar en las OTAs para recibir lo que
              quieres tras la comisión — y cuánto más te deja cada reserva directa.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calculadora + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <TarifaNeta />
      </section>

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              El precio que ves no es el dinero que recibes
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Cuando publicas una habitación en Booking o Airbnb, el precio que
                aparece no es lo que te llega al bolsillo. La comisión se descuenta
                de ahí, así que para recibir lo que de verdad necesitas tienes que
                publicar más caro — y volverte menos competitivo.
              </p>
              <p>
                Esta es la trampa silenciosa de depender de las OTAs: o subes el
                precio (y vendes menos) o aceptas quedarte con menos por cada
                reserva. En ambos casos pierdes.
              </p>
              <p>
                La reserva directa rompe esa disyuntiva: puedes ofrecerle al
                huésped un precio igual o mejor que en Booking y aun así quedarte
                con más, porque no hay comisión de por medio. Es la forma más sana
                de bajar tu dependencia de las OTAs sin renunciar a la ocupación.
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
