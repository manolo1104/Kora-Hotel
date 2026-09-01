import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { FirmaKora } from "@/components/herramientas/FirmaKora";
import { Anticipo } from "@/components/herramientas/Anticipo";
import { JsonLd } from "@/components/shared/JsonLd";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Generador de mensaje de anticipo para reservas de hotel (gratis) | Kora",
  description:
    "Crea gratis el mensaje de WhatsApp para pedir el anticipo de una reserva, con el desglose y tus datos de pago. Listo para copiar y enviar. Hecho para hoteles en México.",
  alternates: { canonical: "/herramientas/anticipo" },
  openGraph: {
    title: "Generador de mensaje de anticipo para reservas (gratis)",
    description:
      "Crea el mensaje de WhatsApp para pedir el anticipo de una reserva, con desglose y datos de pago.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/anticipo`,
  },
};

const faqs = [
  {
    q: "¿Cómo le pido el anticipo a un huésped por WhatsApp?",
    a: "Lo ideal es un mensaje claro con el total, el monto del anticipo, lo que queda por pagar, tus datos de transferencia y una fecha límite. Esta herramienta arma ese mensaje por ti, listo para copiar o abrir directo en WhatsApp.",
  },
  {
    q: "¿Cuánto anticipo debo pedir?",
    a: "Lo más común es entre 30% y 50% del total para apartar, aunque en temporada alta o reservas grandes algunos hoteles piden más. Lo importante es que el anticipo compense una posible cancelación de último momento.",
  },
  {
    q: "¿Por qué conviene pedir anticipo?",
    a: "El anticipo reduce los no-shows y las cancelaciones de último minuto: el huésped que ya pagó algo, llega. Además te da flujo y compromete la reserva. Sin anticipo, una habitación apartada puede quedarse vacía y sin compensación.",
  },
];

export default function AnticipoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de mensaje de anticipo para hoteles",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/anticipo`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Genera el mensaje de WhatsApp para solicitar el anticipo de una reserva de hotel.",
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
      <JsonLd data={jsonLd} />

      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Herramienta gratis de Kora
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Pide el anticipo sin que se te caiga la reserva
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Arma en segundos el mensaje de WhatsApp para pedir el anticipo, con el
              desglose y tus datos de pago. Listo para copiar y enviar.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <Anticipo />
      </section>

      {/* Firma de marca pegada a la herramienta: quien llega de Google la usa
          y se va sin bajar más, así que aquí es donde tiene que ver de quién es. */}
      <FirmaKora />

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              El anticipo es lo que separa una reserva real de una promesa
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Apartar sin anticipo es apostar: el huésped puede no llegar y te
                quedas con la habitación vacía y sin nada. Un anticipo bien pedido,
                claro y con fecha límite, compromete la reserva y reduce los
                no-shows.
              </p>
              <p>
                La clave es pedirlo de forma profesional: con el total, el monto a
                apartar, lo que queda y tus datos de pago. Un mensaje ordenado da
                confianza y hace que el huésped pague más rápido.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <h2 className="mt-14 text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Preguntas frecuentes
            </h2>
          </Reveal>
          <div className="mt-6 space-y-4">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={0.05 + i * 0.06}>
                <div className="bg-kora-bg rounded-2xl p-5 sm:p-6 border border-gray-100">
                  <h3 className="font-bold text-kora-text text-base mb-2">{f.q}</h3>
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
