import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CreditCard,
  Code2,
  MailCheck,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { JsonLd } from "@/components/shared/JsonLd";
import { ReservaMockup } from "@/components/caracteristicas/Mockups";
import { VsBooking } from "@/components/caracteristicas/VsBooking";
import { DemoMotorSection } from "@/components/landing/DemoMotorSection";
import { AYUDA_ALTA, GARANTIA, PRECIO_DESDE, RUTA_REGISTRO } from "@/lib/oferta";
import { waLink } from "@/lib/contacto";
import { metaDescripcion } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const PRECIO = `$${PRECIO_DESDE.toLocaleString("es-MX")}`;

// Página pilar del motor de reservas (21 oct 2026). Hasta hoy el motor sólo
// vivía como una sección de la portada y de /caracteristicas, y la única URL
// con «motor de reservas» en el título era la definición del glosario: en 90
// días Search Console registró 3 impresiones para cualquier búsqueda con
// «motor». Sin una página comercial propia no hay nada que Google pueda poner
// delante de quien busca «motor de reservas para hoteles».
//
// Las búsquedas de cabeza las tienen SiteMinder, Mews y Cloudbeds; esta página
// apunta primero a la cola larga donde Kora sí se distingue: sin comisión, para
// hoteles pequeños, en México.
const RESPUESTA_CITABLE = `El motor de reservas de Kora es la herramienta que pones en la página web de tu hotel para que el huésped vea la disponibilidad real, elija su cuarto y pague en línea, sin pasar por Booking ni Airbnb. Kora no cobra comisión por reserva: el motor viene incluido en el plan de ${PRECIO} MXN al mes.`;

const WA_DUDAS = waLink("Hola, vi la página del motor de reservas de Kora y tengo una duda");

export const metadata: Metadata = {
  title: "Motor de reservas para hoteles sin comisión | Kora",
  // Cabe en 158 con el precio: la versión anterior se cortaba justo antes de él.
  description: metaDescripcion(
    `Motor de reservas para hoteles pequeños en México: el huésped paga directo en tu web, con tarjeta u OXXO, y Kora no cobra comisión. ${PRECIO} MXN/mes.`,
  ),
  alternates: { canonical: "/motor-de-reservas" },
  openGraph: {
    title: "Motor de reservas para hoteles, sin comisión por reserva",
    description:
      "Tus huéspedes reservan y pagan directo en tu web. La reserva cae confirmada en tu panel y el dinero en tu cuenta.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${SITE_URL}/motor-de-reservas`,
  },
};

// Cada capacidad sale de lo que el motor hace hoy (ver /caracteristicas,
// MotorReservasSection y lib/integraciones.ts). Nada de «próximamente».
const CAPACIDADES = [
  {
    Icon: CalendarCheck,
    titulo: "Disponibilidad y precio reales",
    texto:
      "El huésped elige fechas y ve sólo los cuartos que te quedan libres esas noches, con el total de la estancia. No hay tarifas viejas ni cuartos fantasma.",
  },
  {
    Icon: CreditCard,
    titulo: "Cobra con tarjeta u OXXO",
    texto:
      "El pago pasa por Stripe y cae en tu cuenta. El huésped paga el anticipo al reservar y la reserva queda confirmada en ese momento.",
  },
  {
    Icon: MailCheck,
    titulo: "Confirma solo",
    texto:
      "Al pagarse, el huésped recibe su confirmación por correo y WhatsApp, y la reserva aparece en tu calendario. Nadie tiene que capturarla.",
  },
  {
    Icon: Code2,
    titulo: "En tu web, con una línea",
    texto:
      "Lo pegas en tu sitio con una sola línea de código. Si aún no tienes web, compartes la página de reservas que Kora le hace a tu hotel al registrarlo.",
  },
  {
    Icon: MessageCircle,
    titulo: "El mismo inventario que tu WhatsApp",
    texto:
      "El motor, Camila (tu bot de WhatsApp) y tu panel leen el mismo calendario: un cuarto vendido por un lado deja de ofrecerse por el otro.",
  },
  {
    Icon: Wallet,
    titulo: "Sin comisión por reserva",
    texto:
      "Kora cobra una mensualidad fija, no un porcentaje: te cuesta lo mismo vender una reserva que cien. Cada una es tuya completa, menos la tarifa del cobro con tarjeta.",
  },
];

const FAQS = [
  {
    q: "¿Cuánto cuesta el motor de reservas de Kora?",
    a: `Viene incluido en el plan único de ${PRECIO} MXN al mes, junto con el PMS, el bot de WhatsApp y el CRM. Sin costo de implementación y sin permanencia. Antes de pagar tienes ${GARANTIA.diasPrueba} días gratis, sin tarjeta, para cargar tu hotel y probarlo.`,
  },
  {
    q: "¿Kora cobra comisión por cada reserva?",
    a: "No. Kora no se queda con ningún porcentaje de tus reservas. Lo único que se descuenta de cada cobro con tarjeta es la tarifa de Stripe, el procesador de pagos, como pasaría con cualquier terminal.",
  },
  {
    q: "¿Necesito tener página web?",
    a: "No. Al registrar tu hotel queda lista su página pública de reservas, con tu logo, tus fotos y tus cuartos. Si ya tienes web, pegas el motor en ella con una sola línea.",
  },
  {
    q: "¿Se sincroniza con Booking, Airbnb o Expedia?",
    a: "Todavía no. Kora no tiene channel manager: las reservas que te lleguen por Booking, Airbnb o Expedia las registras tú en el calendario del panel para que el motor no vuelva a vender esas noches. Preferimos decírtelo antes de que lo descubras.",
  },
  {
    q: "¿Puedo probarlo sin cobrarle a nadie?",
    a: `Sí. Durante tus ${GARANTIA.diasPrueba} días de prueba, y mientras no conectes tus cobros, las reservas que hagas en tu motor son de prueba y no cobran nada.`,
  },
  {
    q: "¿Qué diferencia hay entre un motor de reservas y un PMS?",
    a: "El motor de reservas es la parte que ve el huésped: donde elige fechas y paga. El PMS es la parte que ves tú: el calendario, los check-in, la limpieza y los pagos. En Kora son el mismo sistema, así que una reserva del motor ya está en tu PMS sin capturarla.",
  },
];

const NO_HACE = [
  "No se sincroniza con Booking, Airbnb ni Expedia: esas reservas se registran en el panel.",
  "No publica tu hotel en Google Hotels ni en metabuscadores.",
  "No importa las reservas que ya tengas en otro sistema: cargas tus cuartos y tarifas, y empiezas desde ahí.",
];

const RELACIONADOS = [
  { texto: "PMS para hoteles pequeños", href: "/pms" },
  { texto: "Bot de WhatsApp para hoteles", href: "/whatsapp" },
  { texto: "Calculadora: cuánto pierdes en comisiones", href: "/herramientas/calculadora-comisiones" },
  { texto: "Booking vs. reservas directas", href: "/comparativas/booking" },
  { texto: "Crea tu página de reservas gratis", href: "/herramientas/mini-pagina" },
  { texto: "¿Qué es un motor de reservas?", href: "/glosario/motor-de-reservas" },
];

export default function MotorDeReservasPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Motor de reservas de Kora",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${SITE_URL}/motor-de-reservas`,
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
                    Motor de reservas directas
                  </p>
                  <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                    Motor de reservas para hoteles, sin comisión por reserva
                  </h1>
                  <p className="mt-5 text-white/75 text-base sm:text-lg leading-relaxed max-w-xl">
                    El huésped elige fechas, ve tus cuartos libres y paga directo
                    en tu web —sin pasar por Booking ni Airbnb—. La reserva cae
                    confirmada en tu panel y el dinero, en tu cuenta.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <CtaLink
                      href={RUTA_REGISTRO}
                      ctaName="motor_pilar_onboarding"
                      className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
                    >
                      Crear mi cuenta gratis
                      <ArrowRight size={16} aria-hidden="true" />
                    </CtaLink>
                    <a
                      href="#demo-motor"
                      className="text-sm font-semibold text-white/80 underline underline-offset-4 hover:text-white transition-colors"
                    >
                      Probarlo en vivo
                    </a>
                  </div>
                  <p className="mt-4 text-xs text-white/50">
                    {GARANTIA.diasPrueba} días gratis, sin tarjeta. Después, incluido
                    en el plan único de {PRECIO} MXN/mes con el PMS, el bot de
                    WhatsApp y el CRM.
                  </p>
                </div>
              </Reveal>

              <Reveal direction="right" delay={0.1}>
                <div className="max-w-sm mx-auto w-full">
                  <ReservaMockup />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Bloque citable por IA */}
        <section className="py-12 sm:py-14 bg-kora-bg border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Motor de reservas", href: "/motor-de-reservas" },
              ]}
            />
            <Reveal>
              <p className="mt-6 text-lg sm:text-xl text-kora-text leading-relaxed font-medium">
                {RESPUESTA_CITABLE}
              </p>
            </Reveal>
          </div>
        </section>

        {/* Por qué importa */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                La segunda reserva de cada huésped debería ser tuya
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
                <p>
                  Booking y Airbnb te dan visibilidad, y eso tiene un precio: entre
                  el 15% y el 20% de cada reserva. El problema no es pagarlo la
                  primera vez. Es seguir pagándolo cuando el huésped ya te conoce,
                  te busca por tu nombre y termina reservando en la OTA porque tu
                  hotel no tiene dónde cobrarle.
                </p>
                <p>
                  Un motor de reservas propio cierra esa fuga. El huésped que llega
                  desde tu Instagram, tu ficha de Google o una recomendación reserva
                  en tu web, paga el anticipo en ese momento y te deja su correo y
                  su teléfono —no los de la OTA—.
                </p>
                <p>
                  En la mayoría de los motores eso es un sistema aparte que hay que
                  conectar con el resto. En Kora el motor, el PMS y el bot de
                  WhatsApp son el mismo sistema: una reserva hecha en tu web ya está
                  en tu calendario, y Camila ya no ofrece ese cuarto.
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
                Qué hace el motor de reservas de Kora
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

        {/* La misma reserva, directa vs. por Booking */}
        <VsBooking />

        {/* El motor real, en un hotel real */}
        <DemoMotorSection />

        {/* Qué NO hace */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Y lo que el motor de Kora no hace
              </h2>
              <p className="mt-3 text-sm text-kora-muted leading-relaxed">
                Preferimos decírtelo antes de que lo descubras tú.
              </p>
            </Reveal>
            <ul className="mt-8 space-y-3">
              {NO_HACE.map((t, i) => (
                <Reveal key={t} delay={0.05 + i * 0.05}>
                  <li className="flex gap-3 bg-kora-bg rounded-2xl p-5 border border-gray-100">
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

            {/* Enlaces internos: el motor es el centro del grupo comercial */}
            <Reveal delay={0.1}>
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RELACIONADOS.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="group flex items-center justify-between gap-3 bg-white rounded-2xl px-5 py-4 border border-gray-100 hover:border-kora-accent/50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-kora-text group-hover:text-kora-primary transition-colors">
                      {r.texto}
                    </span>
                    <ArrowRight size={14} className="text-kora-primary flex-shrink-0" aria-hidden="true" />
                  </Link>
                ))}
              </div>
              {WA_DUDAS && (
                <p className="mt-8 text-center text-sm text-kora-muted">
                  <a
                    href={WA_DUDAS}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-kora-primary transition-colors"
                  >
                    {AYUDA_ALTA}
                  </a>
                </p>
              )}
            </Reveal>
          </div>
        </section>

        <BarraCTA />
      </main>
    </>
  );
}
