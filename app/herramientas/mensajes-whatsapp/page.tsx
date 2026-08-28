import type { Metadata } from "next";
import Link from "next/link";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { FirmaKora } from "@/components/herramientas/FirmaKora";
import { GeneradorIA, type CampoDef } from "@/components/herramientas/GeneradorIA";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "Generador de mensajes de WhatsApp para hoteles con IA (gratis) | Kora",
  description:
    "Crea mensajes de WhatsApp profesionales para tu hotel en segundos: confirmar reservas, cotizar, pedir anticipo o responder dudas. Con IA, en español, gratis, para México.",
  alternates: { canonical: "/herramientas/mensajes-whatsapp" },
  openGraph: {
    title: "Generador de mensajes de WhatsApp para hoteles con IA (gratis)",
    description:
      "Mensajes de WhatsApp profesionales para tu hotel en segundos: confirmar, cotizar, pedir anticipo y más.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/mensajes-whatsapp`,
  },
};

const campos: CampoDef[] = [
  {
    name: "situacion",
    label: "¿Qué necesitas decir?",
    type: "select",
    required: true,
    options: [
      "Confirmar una reserva",
      "Cotizar / responder por precio",
      "Responder una duda",
      "Pedir el anticipo",
      "Mensaje de bienvenida",
      "Responder fuera de horario",
      "Recordatorio de llegada",
    ],
  },
  {
    name: "detalle",
    label: "Detalles (lo que sepas: fechas, precio, nombre, dudas…)",
    type: "textarea",
    required: true,
    placeholder:
      "Ej: El Sr. López pregunta por una habitación doble para el 14 y 15 de junio, 2 personas.",
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
    q: "¿Cómo respondo más rápido los WhatsApp de mi hotel?",
    a: "Tener respuestas listas para las situaciones más comunes (confirmar, cotizar, pedir anticipo, responder fuera de horario) te ahorra muchísimo tiempo. Esta herramienta te genera el mensaje en segundos; solo lo revisas y lo envías.",
  },
  {
    q: "¿Los mensajes suenan naturales?",
    a: "Sí. Están escritos en español de México, cálidos y breves, con emojis moderados. Donde falte un dato, la herramienta deja un espacio entre corchetes para que lo completes.",
  },
  {
    q: "¿Es gratis?",
    a: "Sí, es gratis para usarla. La genera una IA, así que úsala con sensatez. Solo dejas tus datos si quieres ver cómo automatizar tu WhatsApp con Kora.",
  },
];

export default function MensajesWhatsappPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Generador de mensajes de WhatsApp para hoteles",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${BASE_URL}/herramientas/mensajes-whatsapp`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
        description:
          "Herramienta con IA para crear mensajes de WhatsApp profesionales para un hotel.",
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
              Herramienta gratis de Kora · con IA
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Mensajes de WhatsApp para tu hotel, en segundos
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Elige la situación, escribe los detalles y la IA te arma el mensaje
              perfecto para confirmar, cotizar, pedir anticipo o responder dudas.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <GeneradorIA
          tipo="whatsapp"
          tituloCard="¿Qué mensaje necesitas?"
          subtituloCard="Dinos la situación y los detalles, y la IA lo escribe."
          campos={campos}
          botonLabel="Generar mensaje"
          resultadoLabel="Tu mensaje de WhatsApp"
          lead={{
            herramienta: "Generador de mensajes de WhatsApp",
            title: "¿Y si tu WhatsApp se contestara solo?",
            subtitle:
              "Te enseñamos por WhatsApp cómo el agente de IA de Kora responde, cotiza y confirma reservas 24/7 por ti.",
            button: "Quiero saber más",
          }}
          kora={{
            badge: "Agente de WhatsApp 24/7",
            titulo: "Deja de escribir cada mensaje a mano",
            texto:
              "Con Kora, un agente de IA contesta tu WhatsApp las 24 horas: responde dudas, cotiza, pide el anticipo y confirma la reserva — en español y sin que muevas un dedo.",
            utm: "mensajes-whatsapp",
          }}
        />
      </section>

      {/* Firma de marca pegada a la herramienta: quien llega de Google la usa
          y se va sin bajar más, así que aquí es donde tiene que ver de quién es. */}
      <FirmaKora />

      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              El WhatsApp es donde se ganan (y se pierden) las reservas
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
              <p>
                En México, casi todo se cierra por WhatsApp. Un mensaje claro,
                rápido y profesional transmite confianza y acelera la decisión;
                uno improvisado o tardío hace que el huésped se vaya a otro lado.
              </p>
              <p>
                Tener los mensajes correctos a la mano —y poder generarlos al
                instante— te ayuda a contestar mejor y más rápido, aunque estés
                ocupado atendiendo el hotel.
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
