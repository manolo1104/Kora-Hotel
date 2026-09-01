import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  CalendarCheck,
  CreditCard,
  Languages,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { WhatsAppDemoChat } from "@/components/landing/WhatsAppDemoChat";
import { paginasWhatsApp } from "@/lib/whatsapp";
import { PRECIO_DESDE } from "@/lib/oferta";
import { metaDescripcion } from "@/lib/seo";
import { JsonLd } from "@/components/shared/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// Página pilar del agente de WhatsApp. Existe porque es la razón por la que
// entran los prospectos y hasta ahora sólo vivía como una sección de la home:
// sin URL propia no puede rankear ni ser citada por una IA.
const RESPUESTA_CITABLE =
  "Camila es el agente de WhatsApp con IA de Kora para hoteles en México. Contesta los mensajes de tus huéspedes en segundos las 24 horas, consulta la disponibilidad y el precio reales de tu hotel, y cierra la reserva generando el link de pago. Viene incluida en el plan de $550 MXN al mes.";

export const metadata: Metadata = {
  title: "Agente de WhatsApp con IA para hoteles | Kora",
  description: metaDescripcion(
    "Camila contesta el WhatsApp de tu hotel 24/7, cotiza con disponibilidad real y cierra la reserva con link de pago. En español, incluido en el plan de $550 MXN/mes.",
  ),
  keywords: [
    "agente de whatsapp para hoteles",
    "bot de whatsapp hotel",
    "chatbot hotel mexico",
    "contestar whatsapp hotel 24/7",
    "reservas por whatsapp",
  ],
  alternates: { canonical: "/whatsapp" },
  openGraph: {
    title: "Camila: el agente de WhatsApp con IA para tu hotel",
    description:
      "Contesta en segundos las 24 horas, cotiza con disponibilidad real y cierra la reserva con link de pago.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${SITE_URL}/whatsapp`,
  },
};

const CAPACIDADES = [
  {
    Icon: Clock,
    titulo: "Contesta en segundos, a cualquier hora",
    texto:
      "El mensaje de las 2 de la mañana recibe respuesta a las 2 de la mañana. Sin horario de atención y sin turnos de guardia.",
  },
  {
    Icon: CalendarCheck,
    titulo: "Cotiza con tu disponibilidad real",
    texto:
      "Antes de dar un precio consulta tu inventario: qué tipos de cuarto quedan libres esas noches y cuánto suma la estancia para ese número de personas.",
  },
  {
    Icon: CreditCard,
    titulo: "Cierra con link de pago",
    texto:
      "Aparta el cuarto y genera el link de Stripe por el mismo total que cotizó. Al pagarse, la confirmación sale sola y la reserva queda registrada.",
  },
  {
    Icon: Languages,
    titulo: "Responde en el idioma del huésped",
    texto:
      "Si le escriben en inglés, contesta en inglés. Misma información, mismos precios, sin que nadie del equipo traduzca.",
  },
  {
    Icon: ShieldCheck,
    titulo: "Tiene prohibido inventar",
    texto:
      "Nunca da un precio, una disponibilidad ni una política que la herramienta no confirme. Si el dato no existe, no lo improvisa.",
  },
  {
    Icon: UserRoundCheck,
    titulo: "Sabe cuándo pasártela",
    texto:
      "Grupos grandes, quejas o casos delicados: ofrece pasar la conversación con una persona del hotel en lugar de resolverlo mal.",
  },
];

const PASOS = [
  {
    n: "01",
    titulo: "El huésped escribe a tu WhatsApp",
    texto:
      "El número de siempre, el que ya está en tu Instagram y en tu ficha de Google. No tiene que aprender nada nuevo.",
  },
  {
    n: "02",
    titulo: "Camila resuelve con la información de tu hotel",
    texto:
      "Conoce tus cuartos, capacidades, amenidades, políticas, cómo llegar y tus preguntas frecuentes, porque los cargamos en el arranque.",
  },
  {
    n: "03",
    titulo: "Consulta disponibilidad y da el total real",
    texto:
      "No responde de memoria: pregunta a tu sistema qué hay libre esas fechas y devuelve el total de la estancia, no un rango.",
  },
  {
    n: "04",
    titulo: "Aparta el cuarto y manda el link de pago",
    texto:
      "Con nombre, correo y teléfono cierra la reserva. Tú lo ves por la mañana con el anticipo ya cobrado.",
  },
];

const FAQS = [
  {
    q: "¿Qué diferencia hay entre Camila y un chatbot normal?",
    a: "Un chatbot repite respuestas escritas de antemano. Camila usa herramientas: consulta la disponibilidad y el precio reales de tu hotel y crea la reserva con su link de pago. La prueba rápida para distinguirlos es preguntar por unas fechas concretas: un chatbot da un precio genérico, Camila da el total real de esa estancia.",
  },
  {
    q: "¿Puede inventar un precio o prometer un cuarto que no tengo?",
    a: "No. Su regla base es no dar precio ni confirmar lugar sin consultar antes la disponibilidad real. Si la consulta falla, ofrece coordinar directo con el hotel en lugar de improvisar.",
  },
  {
    q: "¿Tengo que cambiar mi número de WhatsApp?",
    a: "Puedes usar el número que ya tienes. La conexión la montamos nosotros durante el arranque llave en mano; no necesitas configurar nada por tu cuenta.",
  },
  {
    q: "¿Puedo entrar yo a la conversación?",
    a: "Sí, cuando quieras. Muchos hoteles dejan a Camila como turno de noche y fines de semana y toman ellos el chat en horario de oficina. Todas las conversaciones quedan en tu panel.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: `Camila viene incluida en el plan único de Kora: $${PRECIO_DESDE.toLocaleString("es-MX")} MXN al mes, con el motor de reservas, el PMS, el dashboard y el CRM. Sin costo por conversación, sin costo de implementación y sin permanencia.`,
  },
  {
    q: "¿En qué idiomas responde?",
    a: "Responde en el idioma en que le escriba el huésped. En hoteles mexicanos los que más se usan son español e inglés.",
  },
];

export default function WhatsAppPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Camila — Agente de WhatsApp con IA de Kora",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, WhatsApp",
        url: `${SITE_URL}/whatsapp`,
        description: RESPUESTA_CITABLE,
        inLanguage: "es-MX",
        offers: {
          "@type": "Offer",
          price: String(PRECIO_DESDE),
          priceCurrency: "MXN",
          description: `Incluido en el plan único de Kora, $${PRECIO_DESDE} MXN/mes.`,
        },
        featureList: CAPACIDADES.map((c) => c.titulo),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "HowTo",
        name: "Cómo funciona el agente de WhatsApp de un hotel",
        step: PASOS.map((p, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: p.titulo,
          text: p.texto,
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="pt-16">
        {/* Hero */}
        <section className="py-16 sm:py-24 bg-kora-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <Reveal direction="left">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-kora-accent mb-4">
                    Agente de WhatsApp con IA
                  </p>
                  <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                    El WhatsApp de tu hotel, contestado en segundos. Las 24 horas.
                  </h1>
                  <p className="mt-5 text-white/75 text-base sm:text-lg leading-relaxed max-w-xl">
                    Camila no es un chatbot de menús. Consulta la disponibilidad y
                    el precio reales de tu hotel, resuelve las dudas del huésped y
                    cierra la reserva con su link de pago —mientras tú duermes.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <CtaLink
                      href="/panel/onboarding"
                      ctaName="whatsapp_pilar_onboarding"
                      className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
                    >
                      Probar gratis 30 días — sin tarjeta
                      <ArrowRight size={16} aria-hidden="true" />
                    </CtaLink>
                    <Link
                      href="/precios"
                      className="text-sm font-semibold text-white/80 underline underline-offset-4 hover:text-white transition-colors"
                    >
                      Ver precios
                    </Link>
                  </div>
                  <p className="mt-4 text-xs text-white/50">
                    Incluida en el plan único de ${PRECIO_DESDE.toLocaleString("es-MX")} MXN/mes,
                    junto con el motor de reservas, el PMS y el CRM.
                  </p>
                </div>
              </Reveal>

              {/* Demo real */}
              <Reveal direction="right" delay={0.1}>
                <div className="max-w-sm mx-auto w-full">
                  <WhatsAppDemoChat />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Bloque citable por IA: la respuesta de 40-60 palabras */}
        <section className="py-12 sm:py-14 bg-kora-bg border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Agente de WhatsApp", href: "/whatsapp" },
              ]}
            />
            <Reveal>
              <p className="mt-6 text-lg sm:text-xl text-kora-text leading-relaxed font-medium">
                {RESPUESTA_CITABLE}
              </p>
            </Reveal>
          </div>
        </section>

        {/* La diferencia que sostiene el precio */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                La diferencia no es que conteste. Es que sabe.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
                <p>
                  Casi todos los bots del mercado son árboles de decisión: alguien
                  escribió las respuestas y el bot las repite. Contestan rápido y
                  mal, y el huésped se da cuenta a los dos mensajes, porque en
                  cuanto pregunta algo concreto —¿hay lugar el 14 de febrero para
                  cuatro personas?— el bot no tiene forma de saberlo.
                </p>
                <p>
                  Camila sí tiene forma de saberlo. Está conectada al mismo
                  inventario que opera tus reservas, así que antes de hablar de
                  precio consulta qué hay libre esas noches y cuánto suma la
                  estancia. Y cuando el huésped se decide, no te manda un resumen
                  para que lo captures: aparta el cuarto y genera el link de pago.
                </p>
                <p>
                  Ese es el motivo por el que un agente conectado y un chatbot
                  suelto no son la misma categoría de producto. Uno te deja un
                  mensaje pendiente; el otro te deja un anticipo cobrado.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Capacidades */}
        <section className="py-14 sm:py-20 bg-kora-bg">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight text-center">
                Qué hace Camila exactamente
              </h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CAPACIDADES.map(({ Icon, titulo, texto }, i) => (
                <Reveal key={titulo} delay={0.05 + i * 0.05}>
                  <div className="h-full bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="w-10 h-10 rounded-xl bg-kora-accent/15 flex items-center justify-center">
                      <Icon size={18} className="text-kora-primary" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-bold text-kora-text">{titulo}</h3>
                    <p className="mt-2 text-sm text-kora-muted leading-relaxed">{texto}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Cómo funciona, paso a paso
              </h2>
            </Reveal>
            <div className="mt-10 space-y-8">
              {PASOS.map((p, i) => (
                <Reveal key={p.n} delay={0.05 + i * 0.06}>
                  <div className="flex gap-5">
                    <span className="flex-shrink-0 text-sm font-bold text-kora-accent tabular-nums pt-1">
                      {p.n}
                    </span>
                    <div>
                      <h3 className="font-bold text-kora-text">{p.titulo}</h3>
                      <p className="mt-1.5 text-sm text-kora-muted leading-relaxed">
                        {p.texto}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Qué NO hace — honestidad, y filtra al prospecto equivocado */}
        <section className="py-14 sm:py-20 bg-kora-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Y lo que Camila no hace
              </h2>
              <p className="mt-3 text-sm text-kora-muted leading-relaxed">
                Preferimos decírtelo antes de que lo descubras tú.
              </p>
            </Reveal>
            <ul className="mt-8 space-y-3">
              {[
                "No sustituye a una persona en recepción: no recibe llegadas tarde ni resuelve lo que pasa dentro del hotel.",
                "No negocia tarifas de grupo ni condiciones especiales. Esos casos te los pasa a ti.",
                "No maneja quejas ni conversaciones delicadas. Ahí el huésped necesita que le contestes tú.",
                "No corrige tus datos: si una tarifa está mal cargada, la cotizará mal. Por eso el arranque lo hacemos nosotros contigo.",
              ].map((t, i) => (
                <Reveal key={t} delay={0.05 + i * 0.05}>
                  <li className="flex gap-3 bg-white rounded-2xl p-5 border border-gray-100">
                    <span className="text-kora-muted select-none" aria-hidden="true">
                      —
                    </span>
                    <p className="text-sm text-kora-text leading-relaxed">{t}</p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Cluster: guías del agente */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Guías del WhatsApp de tu hotel
              </h2>
              <p className="mt-3 text-sm text-kora-muted leading-relaxed max-w-2xl">
                Todo lo que hay que resolver para que el WhatsApp deje de ser una
                fuga y se vuelva tu canal más rentable.
              </p>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paginasWhatsApp.map((p, i) => (
                <Reveal key={p.slug} delay={0.04 + i * 0.03}>
                  <Link
                    href={`/whatsapp/${p.slug}`}
                    className="group block h-full bg-kora-bg rounded-2xl p-5 border border-gray-100 hover:border-kora-accent/50 transition-colors"
                  >
                    <h3 className="font-bold text-kora-text text-base leading-snug group-hover:text-kora-primary transition-colors">
                      {p.titulo}
                    </h3>
                    <p className="mt-2 text-sm text-kora-muted leading-relaxed">
                      {p.resumen}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary">
                      Leer
                      <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14 sm:py-20 bg-kora-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-6">
                Preguntas frecuentes
              </h2>
            </Reveal>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <Reveal key={f.q} delay={0.04 + i * 0.04}>
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100">
                    <h3 className="font-bold text-kora-text text-base mb-2">{f.q}</h3>
                    <p className="text-sm text-kora-muted leading-relaxed">{f.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1}>
              <p className="mt-10 text-center text-sm text-kora-muted">
                ¿Quieres verlo con un hotel real?{" "}
                <Link
                  href="/casos/paraiso-encantado"
                  className="font-semibold text-kora-primary underline"
                >
                  Mira el caso del Hotel Paraíso Encantado
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </section>

        <BarraCTA />
      </main>
    </>
  );
}
