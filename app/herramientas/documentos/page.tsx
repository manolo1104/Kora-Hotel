import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { FirmaKora } from "@/components/herramientas/FirmaKora";
import { DocumentosLegales } from "@/components/herramientas/DocumentosLegales";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Política de cancelación, aviso de privacidad y reglamento para hotel (gratis) | Kora",
  description:
    "Genera gratis la política de cancelación, el aviso de privacidad y el reglamento interno de tu hotel. Plantillas editables listas para copiar o imprimir, para México.",
  alternates: { canonical: "/herramientas/documentos" },
  openGraph: {
    title: "Documentos legales para tu hotel (gratis)",
    description:
      "Política de cancelación, aviso de privacidad y reglamento interno listos para tu hotel.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/documentos`,
  },
};

const faqs = [
  {
    q: "¿Qué documentos legales necesita un hotel pequeño en México?",
    a: "Los más comunes son: una política de cancelación clara, un aviso de privacidad (obligatorio si recabas datos personales, según la LFPDPPP) y un reglamento interno para los huéspedes. Esta herramienta genera los tres a partir de tus datos.",
  },
  {
    q: "¿El aviso de privacidad es obligatorio?",
    a: "Sí. Si recabas datos de tus huéspedes (nombre, contacto, datos de facturación), la ley mexicana te obliga a tener y poner a disposición un aviso de privacidad. Esta plantilla cubre lo esencial; para casos complejos, confírmalo con un abogado.",
  },
  {
    q: "¿Estas plantillas sustituyen a un abogado?",
    a: "No. Son plantillas orientativas pensadas para hoteles pequeños, muy útiles como punto de partida. Para situaciones específicas o temas legales formales, conviene que las revise un profesional.",
  },
];

export default function DocumentosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de documentos legales para hoteles",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/documentos`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Genera política de cancelación, aviso de privacidad y reglamento interno para un hotel.",
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

      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Herramienta gratis de Kora
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Documentos legales para tu hotel, en minutos
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Genera tu política de cancelación, tu aviso de privacidad y tu
              reglamento interno. Listos para copiar, imprimir o poner en tu página.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <DocumentosLegales />
      </section>

      {/* Firma de marca pegada a la herramienta: quien llega de Google la usa
          y se va sin bajar más, así que aquí es donde tiene que ver de quién es. */}
      <FirmaKora />

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Reglas claras evitan problemas y dan confianza
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Una política de cancelación clara reduce disputas y te protege de
                los no-shows. Un aviso de privacidad te pone en regla con la ley. Y
                un reglamento interno bien comunicado evita malentendidos con los
                huéspedes.
              </p>
              <p>
                No necesitas un despacho para tener lo básico bien puesto. Llena tus
                datos, genera el documento y tenlo listo para tu página, tu recepción
                o tu confirmación de reserva.
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
