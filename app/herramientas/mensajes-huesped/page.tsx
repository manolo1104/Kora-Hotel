import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { GeneradorIA, type CampoDef } from "@/components/herramientas/GeneradorIA";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Generador de mensajes para huéspedes con IA (pre-llegada, check-out, reseña) | Kora",
  description:
    "Crea con IA los mensajes para tus huéspedes en cada etapa: pre-llegada, bienvenida, check-out y pedir reseña. En español, listos para WhatsApp. Gratis, para hoteles en México.",
  alternates: { canonical: "/herramientas/mensajes-huesped" },
  openGraph: {
    title: "Generador de mensajes para huéspedes con IA (gratis)",
    description:
      "Mensajes para tus huéspedes en cada etapa: pre-llegada, bienvenida, check-out y pedir reseña.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/mensajes-huesped`,
  },
};

const campos: CampoDef[] = [
  {
    name: "etapa",
    label: "¿En qué momento de la estancia?",
    type: "select",
    required: true,
    options: [
      "Antes de llegar (pre-llegada)",
      "Bienvenida / check-in",
      "Durante la estancia",
      "Check-out / despedida",
      "Pedir una reseña",
    ],
  },
  {
    name: "detalle",
    label: "Detalles (horarios, indicaciones, nombre del huésped…)",
    type: "textarea",
    required: true,
    placeholder:
      "Ej: Check-in 3pm, dar indicaciones de cómo llegar, mencionar que hay estacionamiento gratis.",
  },
  {
    name: "hotel",
    label: "Nombre de tu hotel",
    type: "text",
    placeholder: "Hotel Paraíso Encantado",
  },
];

const faqs = [
  {
    q: "¿Qué mensajes debería mandarle a mis huéspedes?",
    a: "Los que más impacto tienen: uno antes de llegar (con indicaciones y para generar emoción), uno de bienvenida, y uno al final para despedirte y pedir una reseña. Esos pequeños detalles mejoran la experiencia y tus calificaciones.",
  },
  {
    q: "¿Cómo le pido una reseña a un huésped sin sonar insistente?",
    a: "Justo después del check-out, agradeciendo su visita y facilitándole el enlace. Un mensaje cálido y breve funciona mejor que insistir. Esta herramienta te lo redacta en el tono correcto.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí, es gratis para usarla. La genera una IA; revísala y ajústala a tu estilo. Solo dejas tus datos si quieres ver cómo automatizar estos mensajes con Kora.",
  },
];

export default function MensajesHuespedPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de mensajes para huéspedes con IA",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/mensajes-huesped`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Herramienta con IA para crear mensajes a huéspedes en cada etapa de su estancia.",
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
              Mensajes para tus huéspedes en cada momento
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Pre-llegada, bienvenida, check-out o pedir reseña: elige la etapa y la
              IA te escribe el mensaje perfecto para cuidar la experiencia y subir
              tus calificaciones.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <GeneradorIA
          tipo="huesped"
          tituloCard="¿Qué momento quieres cubrir?"
          subtituloCard="Elige la etapa y dinos los detalles."
          campos={campos}
          botonLabel="Generar mensaje"
          resultadoLabel="Tu mensaje para el huésped"
          lead={{
            herramienta: "Generador de mensajes para huéspedes",
            title: "¿Y si estos mensajes se enviaran solos?",
            subtitle:
              "Te enseñamos por WhatsApp cómo Kora automatiza los mensajes a tus huéspedes en cada etapa, sin que tú estés pendiente.",
            button: "Quiero saber más",
          }}
          kora={{
            badge: "Experiencia que sube reseñas",
            titulo: "Cuida a cada huésped, en automático",
            texto:
              "Con Kora, los mensajes de pre-llegada, bienvenida y post-estancia se mandan solos en el momento justo — mejor experiencia, más reseñas y más huéspedes que regresan.",
            utm: "mensajes-huesped",
          }}
        />
      </section>

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Los detalles antes y después de la estancia valen oro
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                Un mensaje de pre-llegada con buenas indicaciones evita confusiones
                y arranca la estancia con buen pie. Una despedida cálida que pide
                reseña en el momento justo es de las formas más baratas y efectivas
                de subir tus calificaciones.
              </p>
              <p>
                Son detalles pequeños que la mayoría de los hoteles no hace por
                falta de tiempo. Tenerlos listos —o automatizados— te distingue y se
                nota en las reseñas y en los huéspedes que regresan.
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
