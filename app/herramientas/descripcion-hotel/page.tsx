import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { GeneradorIA, type CampoDef } from "@/components/herramientas/GeneradorIA";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Generador de descripción de hotel con IA para Booking y web (gratis) | Kora",
  description:
    "Crea una descripción atractiva para tu hotel en segundos: para Booking, Airbnb o tu página web. Con IA, en español, honesta y que vende. Gratis, para hoteles en México.",
  alternates: { canonical: "/herramientas/descripcion-hotel" },
  openGraph: {
    title: "Generador de descripción de hotel con IA (gratis)",
    description:
      "Una descripción atractiva para tu hotel en segundos, lista para Booking, Airbnb o tu web.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/descripcion-hotel`,
  },
};

const campos: CampoDef[] = [
  {
    name: "hotel",
    label: "Nombre de tu hotel",
    type: "text",
    required: true,
    placeholder: "Hotel Paraíso Encantado",
  },
  {
    name: "zona",
    label: "Zona y atractivos cercanos",
    type: "textarea",
    required: true,
    placeholder:
      "Ej: A 5 min del centro de Xilitla, cerca del Jardín de Edward James y las cascadas de la Huasteca.",
  },
  {
    name: "amenidades",
    label: "Amenidades y lo que te hace especial",
    type: "textarea",
    required: true,
    placeholder: "Ej: Alberca, wifi, desayuno incluido, terraza con vista a la selva, pet friendly.",
  },
  {
    name: "estilo",
    label: "Estilo de tu hotel",
    type: "select",
    default: "Acogedor y familiar",
    options: [
      "Acogedor y familiar",
      "Romántico",
      "De aventura y naturaleza",
      "Moderno y minimalista",
      "Lujo boutique",
      "Económico y práctico",
    ],
  },
];

const faqs = [
  {
    q: "¿Cómo escribo una buena descripción para mi hotel en Booking?",
    a: "Combina tres cosas: qué hace único a tu hotel, la experiencia que vive el huésped y los atractivos de la zona. Evita frases genéricas como 'cómodas habitaciones' y sé concreto. Esta herramienta lo arma por ti a partir de tus datos.",
  },
  {
    q: "¿Sirve para Booking, Airbnb y mi página web?",
    a: "Sí. La descripción que genera funciona para tu ficha en las OTAs, para tu perfil de Google y para tu propia página. Puedes ajustar el largo y el tono copiando y editando el resultado.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí, es gratis para usarla. La genera una IA; revísala para que refleje fielmente tu hotel antes de publicarla. Solo dejas tus datos si quieres saber más sobre Kora.",
  },
];

export default function DescripcionHotelPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de descripción de hotel con IA",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/descripcion-hotel`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Herramienta con IA para escribir la descripción de un hotel para Booking, Airbnb o web.",
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
              Herramienta gratis con IA
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Una descripción que vende tu hotel
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Cuéntale a la IA lo que tiene tu hotel y obtén una descripción
              atractiva y honesta, lista para Booking, Airbnb o tu página web.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <GeneradorIA
          tipo="descripcion"
          tituloCard="Cuéntanos de tu hotel"
          subtituloCard="Con estos datos, la IA escribe tu descripción."
          campos={campos}
          botonLabel="Generar descripción"
          resultadoLabel="Tu descripción sugerida"
          lead={{
            herramienta: "Generador de descripción de hotel",
            title: "¿Quieres una página propia donde brille esta descripción?",
            subtitle:
              "Te enseñamos por WhatsApp cómo tener tu propia página de reservas directas con la mejor cara de tu hotel.",
            button: "Quiero saber más",
          }}
          kora={{
            badge: "Tu hotel, en su mejor versión",
            titulo: "Una gran descripción merece una página propia",
            texto:
              "Con Kora tienes tu propia página de reservas directas donde tu descripción, tus fotos y tus precios lucen — y donde el huésped reserva sin comisión.",
            utm: "descripcion-hotel",
          }}
        />
      </section>

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              La descripción es tu vendedor que trabaja 24/7
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Antes de reservar, el huésped lee. Una descripción que transmite la
                experiencia —no solo una lista de amenidades— hace que se imagine
                ahí y se decida. Es de lo que más influye en tu tasa de conversión,
                y muchas veces está descuidada.
              </p>
              <p>
                No necesitas ser redactor: cuenta lo que tiene tu hotel y la zona, y
                deja que la herramienta lo convierta en un texto que enamore y, a la
                vez, sea honesto.
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
