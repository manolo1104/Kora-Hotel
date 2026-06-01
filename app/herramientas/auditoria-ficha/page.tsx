import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { AuditoriaFicha } from "@/components/herramientas/AuditoriaFicha";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Auditoría gratis de tu ficha en Booking y Google | Kora",
  description:
    "Revisa gratis qué tan optimizada está la ficha de tu hotel en Booking, Airbnb y Google. Checklist interactivo con puntaje y lista priorizada de mejoras, para México.",
  alternates: {
    canonical: "/herramientas/auditoria-ficha",
  },
  openGraph: {
    title: "Auditoría gratis de tu ficha en Booking y Google",
    description:
      "Checklist interactivo con puntaje y mejoras priorizadas para optimizar tu ficha de hotel en Booking, Airbnb y Google.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/auditoria-ficha`,
  },
};

const faqs = [
  {
    q: "¿Qué hace que mi hotel aparezca más arriba en Booking?",
    a: "Booking y las demás OTAs ponderan varios factores: la calidad y cantidad de fotos, tu calificación, qué tan rápido y completo respondes reseñas, si tu calendario y precios están actualizados, y qué tan completa está tu ficha (amenidades, descripción, ubicación). Esta auditoría revisa los más importantes.",
  },
  {
    q: "¿Cómo mejoro mi perfil de Google Business para mi hotel?",
    a: "Completa todos los datos (teléfono, WhatsApp, horarios), ubica bien el pin en el mapa, sube fotos recientes, responde todas las reseñas y publica novedades con frecuencia. Un perfil completo aparece mucho más en las búsquedas 'hoteles cerca de mí'.",
  },
  {
    q: "¿Optimizar mi ficha reemplaza tener página propia?",
    a: "No. Optimizar Booking y Google te trae más reservas, pero ahí sigues pagando comisión y la plataforma se queda con la relación con el huésped. Lo ideal es tener ambos: una ficha optimizada y tu propio canal de reservas directas.",
  },
  {
    q: "¿Esta auditoría es gratis?",
    a: "Sí, es completamente gratis y no necesitas registrarte para ver tu puntaje. Solo dejas tus datos si quieres que te enviemos el plan de mejora por WhatsApp.",
  },
];

export default function AuditoriaFichaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Auditoría de ficha de hotel (Booking/Google)",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/auditoria-ficha`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Checklist gratuito para auditar y mejorar la ficha de un hotel en Booking, Airbnb y Google.",
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
              Auditoría gratis · 2 minutos
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              ¿Qué tan buena es tu ficha en Booking y Google?
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Marca lo que ya tienes y recibe un puntaje al instante, con la lista
              de mejoras priorizadas para que te encuentren más y reserves más.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Checklist + embudo (3 capas) */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <AuditoriaFicha />
      </section>

      {/* Contenido SEO */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Una ficha completa te trae reservas que ni sabías que perdías
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Las OTAs y Google deciden a quién mostrar primero, y casi siempre
                premian a las fichas más completas y activas. Dos hoteles iguales
                pueden tener resultados muy distintos solo por cómo está armado su
                perfil: fotos, reseñas respondidas, datos completos y calendario al
                día.
              </p>
              <p>
                La buena noticia es que casi todo esto está bajo tu control y no
                cuesta dinero — solo atención. Subir tu puntaje en estas áreas suele
                traer más visibilidad y más reservas sin gastar un peso extra en
                publicidad.
              </p>
              <p>
                Eso sí: por más que optimices Booking y Google, sigues pagando
                comisión y compartiendo a tu huésped. Por eso conviene usarlos como
                vitrina y, en paralelo, construir tu propio canal directo.
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
