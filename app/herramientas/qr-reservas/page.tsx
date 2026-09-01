import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { FirmaKora } from "@/components/herramientas/FirmaKora";
import { QrReservas } from "@/components/herramientas/QrReservas";
import { JsonLd } from "@/components/shared/JsonLd";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Generador de QR para reservas de hotel (gratis) | Kora",
  description:
    "Crea gratis un código QR que lleve a tu WhatsApp o a tu página de reservas. Imprímelo para recepción, habitaciones y redes. Sin registro, hecho para hoteles en México.",
  alternates: { canonical: "/herramientas/qr-reservas" },
  openGraph: {
    title: "Generador de QR para reservas de hotel (gratis)",
    description:
      "Crea un QR que lleve a tu WhatsApp o a tu página de reservas, listo para imprimir.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/qr-reservas`,
  },
};

const faqs = [
  {
    q: "¿Cómo hago un código QR para reservar por WhatsApp?",
    a: "Pon tu número de WhatsApp con la lada del país y, si quieres, el mensaje que se escribirá solo. La herramienta genera un QR que, al escanearse, abre WhatsApp con tu chat listo para que el huésped te escriba y reserve.",
  },
  {
    q: "¿Dónde conviene poner el QR?",
    a: "En recepción, en las habitaciones (para reservas futuras o recomendaciones), en tus tarjetas, en el menú, en tus redes y en cualquier impreso. Mientras más visible, más reservas directas capturas.",
  },
  {
    q: "¿El QR caduca o tiene costo?",
    a: "No. El QR es una imagen que apunta a tu enlace; funciona indefinidamente mientras tu número o tu página sigan activos. Generarlo y descargarlo es totalmente gratis.",
  },
];

export default function QrReservasPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de QR para reservas de hotel",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/qr-reservas`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Genera un código QR gratuito que lleve al WhatsApp o a la página de reservas de un hotel.",
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
              Crea tu QR de reservas directas
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Genera un código QR que lleve a tu WhatsApp o a tu página de
              reservas. Imprímelo y capta reservas directas sin comisión.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <QrReservas />
      </section>

      {/* Firma de marca pegada a la herramienta: quien llega de Google la usa
          y se va sin bajar más, así que aquí es donde tiene que ver de quién es. */}
      <FirmaKora />

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Un QR bien puesto es una máquina de reservas directas
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Cada huésped que ya está en tu hotel es un cliente que puede
                regresar — y recomendarte. Un QR visible le da la forma más fácil
                de escribirte o reservar directo la próxima vez, sin pasar por
                Booking ni pagar comisión.
              </p>
              <p>
                Ponlo donde el huésped tiene el teléfono en la mano: la habitación,
                la recepción, el restaurante, tus redes. Es gratis, tarda un minuto
                y trabaja por ti todo el año.
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
