import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { Cotizacion } from "@/components/herramientas/Cotizacion";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Generador de cotización para hotel en PDF (gratis) | Kora",
  description:
    "Crea gratis una cotización profesional para tu hotel en PDF: fechas, habitaciones, tarifa y total, lista para enviar por WhatsApp. Sin registro, hecha para México.",
  alternates: { canonical: "/herramientas/cotizacion" },
  openGraph: {
    title: "Generador de cotización para hotel en PDF (gratis)",
    description:
      "Crea una cotización profesional para tu hotel en PDF, lista para enviar por WhatsApp.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/cotizacion`,
  },
};

const faqs = [
  {
    q: "¿Cómo hago una cotización para mi hotel?",
    a: "Necesitas los datos básicos: nombre y contacto de tu hotel, nombre del cliente, fechas de entrada y salida, tipo y número de habitaciones, tarifa por noche y qué incluye. Con eso armas un documento claro con el total. Esta herramienta lo genera por ti y lo descargas en PDF.",
  },
  {
    q: "¿Cómo la descargo en PDF?",
    a: "Llena los datos, presiona “Descargar / Imprimir PDF” y en el diálogo de impresión elige “Guardar como PDF”. Así obtienes el archivo para mandarlo por WhatsApp o correo.",
  },
  {
    q: "¿Es gratis y sin registro?",
    a: "Sí, es totalmente gratis y no necesitas crear cuenta. Solo dejas tus datos si quieres que te enseñemos a automatizar tus cotizaciones con Kora.",
  },
];

export default function CotizacionPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de cotización para hotel",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/cotizacion`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Herramienta gratuita para generar cotizaciones de hotel en PDF listas para enviar.",
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
              Herramienta gratis
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Cotización profesional para tu hotel en 1 minuto
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Llena los datos y descarga una cotización lista para enviar por
              WhatsApp. Se ve profesional y la haces en segundos.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <Cotizacion />
      </section>

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Una cotización clara cierra más reservas
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Cuando alguien pide precio para un grupo o un evento, la rapidez y
                la claridad deciden. Mandar un mensaje de WhatsApp suelto con el
                total se ve improvisado; una cotización ordenada, con fechas,
                desglose y lo que incluye, transmite seriedad y ayuda a cerrar.
              </p>
              <p>
                El problema es el tiempo: armar cada cotización a mano, una por una,
                cuando además atiendes el hotel. Esta herramienta te quita esa parte
                — y si quieres dar el siguiente paso, Kora la hace sola.
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
