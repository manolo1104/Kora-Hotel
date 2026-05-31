import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { GeneradorIA, type CampoDef } from "@/components/herramientas/GeneradorIA";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Generador de respuestas a reseñas de hotel con IA (gratis) | Kora",
  description:
    "Responde reseñas de Booking, Airbnb y Google en segundos con IA. Pega la reseña y obtén una respuesta profesional y empática en español. Gratis, para hoteles en México.",
  alternates: { canonical: "/herramientas/respuestas-resenas" },
  openGraph: {
    title: "Generador de respuestas a reseñas de hotel con IA (gratis)",
    description:
      "Pega la reseña y obtén una respuesta profesional y empática en español, lista para publicar.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/respuestas-resenas`,
  },
};

const campos: CampoDef[] = [
  {
    name: "resena",
    label: "Reseña del huésped",
    type: "textarea",
    required: true,
    placeholder: "Pega aquí la reseña tal como la escribió el huésped…",
  },
  {
    name: "hotel",
    label: "Nombre de tu hotel",
    type: "text",
    placeholder: "Hotel Paraíso Encantado",
  },
  {
    name: "calificacion",
    label: "Calificación que dejó",
    type: "select",
    options: [
      "Excelente (5/5)",
      "Buena (4/5)",
      "Regular (3/5)",
      "Mala (2/5)",
      "Muy mala (1/5)",
    ],
  },
  {
    name: "tono",
    label: "Tono de la respuesta",
    type: "select",
    default: "Amable y cercano",
    options: ["Amable y cercano", "Profesional", "Cálido y agradecido"],
  },
];

const faqs = [
  {
    q: "¿Por qué debo responder las reseñas de mi hotel?",
    a: "Responder todas las reseñas —buenas y malas— mejora tu posicionamiento en Booking y Google, y le da confianza a quien está decidiendo si reservar. Una respuesta tranquila a una reseña negativa muchas veces convence más que diez reseñas positivas.",
  },
  {
    q: "¿Cómo respondo una reseña negativa sin sonar a la defensiva?",
    a: "Agradece el comentario, reconoce el punto con empatía, evita justificarte de más y ofrece mejorar o resolver. Esta herramienta lo hace por ti: pega la reseña, elige el tono y obtienes una respuesta equilibrada que puedes ajustar.",
  },
  {
    q: "¿La respuesta la puedo editar?",
    a: "Claro. La IA te da un borrador muy bueno en segundos; revísalo, ajústalo a tu voz y publícalo. Tú siempre tienes la última palabra.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí, es gratis para usarla. La genera una inteligencia artificial, así que te pedimos usarla con sensatez. Solo dejas tus datos si quieres que te enseñemos a automatizar esto con Kora.",
  },
];

export default function RespuestasResenasPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de respuestas a reseñas con IA",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/respuestas-resenas`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Herramienta con IA para responder reseñas de hotel en Booking, Airbnb y Google.",
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
              Responde reseñas en segundos, no en días
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Pega la reseña de un huésped y la IA te escribe una respuesta
              profesional, empática y en español — lista para publicar.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <GeneradorIA
          tipo="resena"
          tituloCard="Pega la reseña del huésped"
          subtituloCard="La IA te devuelve una respuesta lista para publicar."
          campos={campos}
          botonLabel="Generar respuesta"
          resultadoLabel="Tu respuesta sugerida"
          lead={{
            herramienta: "Generador de respuestas a reseñas",
            title: "¿Quieres que las reseñas se respondan solas?",
            subtitle:
              "Te enseñamos por WhatsApp cómo Kora ayuda a responder reseñas y a cuidar tu reputación sin que te quite tiempo.",
            button: "Quiero saber más",
          }}
          kora={{
            badge: "Agente de IA en español",
            titulo: "La misma IA que responde reseñas… puede contestar tu WhatsApp",
            texto:
              "Si te gusta cómo escribe, imagina ese mismo agente contestando las dudas y reservas de tus huéspedes 24/7, en automático. Eso es Kora.",
            utm: "respuestas-resenas",
          }}
        />
      </section>

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Tus reseñas son tu reputación — y tu posicionamiento
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Booking, Airbnb y Google premian a los hoteles que responden sus
                reseñas: es una señal de que estás atento. Y para el viajero que
                duda, ver cómo respondes —sobre todo a una crítica— pesa muchísimo
                en su decisión.
              </p>
              <p>
                El problema es el tiempo y, a veces, el enojo: responder una reseña
                injusta en caliente puede salir mal. Tener un borrador equilibrado
                en segundos te quita esa carga y te ayuda a responder siempre con
                la cabeza fría.
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
