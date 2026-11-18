import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Link2, ArrowLeftRight, RefreshCw, ShieldCheck, Home } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { JsonLd } from "@/components/shared/JsonLd";
import { AYUDA_ALTA, GARANTIA, PRECIO_DESDE, RUTA_REGISTRO } from "@/lib/oferta";
import { waLink } from "@/lib/contacto";
import { metaDescripcion, conSocial } from "@/lib/seo";
import { ENLACE_OTA } from "@/lib/integraciones";
import { GUIA_PLATAFORMA } from "@/lib/canales/plataformas";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const RUTA = "/sincronizar-airbnb-booking";
const PRECIO = `$${PRECIO_DESDE.toLocaleString("es-MX")}`;

// Página pilar del enlace con OTAs (18 nov 2026). La función existe desde ese
// día (lib/canales/ical.ts) y no tenía ni una URL propia: sólo se mencionaba en
// la portada y en FAQs sueltas. Apunta a las búsquedas de quien vende en varias
// OTAs y teme la sobreventa: «sincronizar Airbnb y Booking», «calendario iCal
// Airbnb», «channel manager para hotel pequeño».
//
// La honestidad no es opcional (ver lib/integraciones.ts): dice desde la
// primera línea que es iCal y no un channel manager, y repite los límites con
// las MISMAS palabras que el resto del sitio (`ENLACE_OTA`) y que el panel
// (`GUIA_PLATAFORMA`).
const RESPUESTA_CITABLE = `${ENLACE_OTA.corto} Funciona por iCal, un calendario por habitación física, y viene incluido en el plan de ${PRECIO} MXN al mes de Kora, junto con el motor de reservas directas y Camila, el bot de WhatsApp.`;

const WA_DUDAS = waLink("Hola, vi la página de sincronizar Airbnb y Booking con Kora y tengo una duda");

export const metadata: Metadata = conSocial({
  title: "Sincronizar Airbnb, Booking y Expedia por iCal | Kora",
  description: metaDescripcion(
    "Enlaza por iCal Airbnb, Booking y Vrbo con tu motor de reservas: un solo calendario por habitación y aviso si dos reservas chocan. Para hoteles en México.",
  ),
  alternates: { canonical: RUTA },
  openGraph: {
    title: "Sincroniza Airbnb, Booking y Expedia (Vrbo) con tu calendario",
    description:
      "Un solo calendario por habitación: lo que vendes en tus OTAs se bloquea en Kora y lo que vendes directo se cierra en tus OTAs.",
  },
});

const PASOS = [
  {
    Icon: Link2,
    titulo: "Copia el calendario de tu OTA",
    texto:
      "En Airbnb, Booking o Vrbo, cada anuncio tiene un enlace iCal de exportación. Lo pegas en Panel → Canales, en la habitación que corresponde.",
  },
  {
    Icon: ArrowLeftRight,
    titulo: "Pega el de Kora en tu OTA",
    texto:
      "Cada habitación tiene su enlace de Kora. Lo importas en la OTA y ella cierra solas las noches que vendes directo o por WhatsApp.",
  },
  {
    Icon: RefreshCw,
    titulo: "Kora relee antes de cada reserva",
    texto:
      "Antes de apartar una habitación —en tu página o con Camila— Kora vuelve a leer tus OTAs. Si dos reservas llegan a chocar, te avisa por correo.",
  },
];

const VENTAJAS = [
  {
    Icon: Home,
    titulo: "Por habitación física, no por tipo",
    texto:
      "Si tienes dos cabañas iguales, cada una tiene su anuncio y su calendario. Vender una no cierra la otra.",
  },
  {
    Icon: CalendarCheck,
    titulo: "Un solo inventario",
    texto:
      "Tu página de reservas, Camila, el calendario del panel y tus OTAs miran la misma disponibilidad.",
  },
  {
    Icon: ShieldCheck,
    titulo: "Sin pagar otro sistema",
    texto: `Viene incluido en el plan de ${PRECIO} MXN/mes. No es un módulo aparte ni cobra por canal.`,
  },
];

const PLATAFORMAS = [
  { nombre: "Airbnb", guia: GUIA_PLATAFORMA.airbnb },
  { nombre: "Booking.com", guia: GUIA_PLATAFORMA.booking_com },
  { nombre: "Expedia (Vrbo)", guia: GUIA_PLATAFORMA.vrbo },
];

const FAQS = [
  {
    q: "¿Cómo sincronizo Airbnb y Booking para no tener sobreventa?",
    a: "Con el enlace iCal de cada anuncio. En Kora pegas el calendario de exportación de cada OTA en su habitación, y en cada OTA importas el enlace de Kora de esa misma habitación. Así lo que se vende en un lado se bloquea en el otro, y Kora vuelve a leer tus OTAs justo antes de apartar cada reserva.",
  },
  {
    q: "¿Kora es un channel manager?",
    a: `No es un channel manager completo. ${ENLACE_OTA.limites}`,
  },
  {
    q: "¿Funciona con Expedia?",
    a: "Expedia Group sólo ofrece calendario iCal en los anuncios de Vrbo. Expedia Partner Central (el extranet para hoteles) no tiene iCal, así que un hotel listado sólo ahí no se puede enlazar por este medio.",
  },
  {
    q: "¿Por qué no me aparece la opción de sincronizar calendarios en Booking?",
    a: "Booking sólo muestra «Sincronizar calendarios» si cada tipo de habitación tiene una sola unidad y no usas otro channel manager; algunos contratos tampoco la tienen. Si no te aparece, tu cuenta no es elegible para iCal.",
  },
  {
    q: "¿Cada cuánto se actualiza?",
    a: "Kora relee los calendarios de tus OTAs justo antes de apartar cada reserva, mientras hay actividad en tu hotel y una vez al día como respaldo. En sentido contrario, cada OTA lee el calendario de Kora a su propio ritmo, de 30 minutos a 3 horas según la plataforma.",
  },
  {
    q: "¿También pasa los precios?",
    a: "No. iCal sólo mueve fechas ocupadas: las tarifas, las restricciones y los datos del huésped los sigues manejando en cada OTA. Tu precio directo lo pones en Kora.",
  },
];

const RELACIONADOS = [
  { texto: "¿Qué es un channel manager?", href: "/glosario/channel-manager" },
  { texto: "¿Qué es el calendario iCal?", href: "/glosario/ical" },
  { texto: "Cómo evitar el overbooking", href: "/glosario/overbooking" },
  { texto: "PMS para hoteles pequeños", href: "/pms" },
  { texto: "Motor de reservas sin comisión", href: "/motor-de-reservas" },
  { texto: "Airbnb vs. reservas directas", href: "/comparativas/airbnb" },
];

export default function SincronizarOtasPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Kora — sincronización de calendarios con Airbnb, Booking y Vrbo",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${SITE_URL}${RUTA}`,
        description: RESPUESTA_CITABLE,
        inLanguage: "es-MX",
        offers: {
          "@type": "Offer",
          price: String(PRECIO_DESDE),
          priceCurrency: "MXN",
          description: `Incluido en el plan único de Kora, $${PRECIO_DESDE} MXN/mes.`,
        },
        featureList: [...PASOS, ...VENTAJAS].map((p) => p.titulo),
      },
      {
        "@type": "HowTo",
        name: "Cómo sincronizar Airbnb, Booking y Vrbo con Kora",
        step: PASOS.map((p, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: p.titulo,
          text: p.texto,
        })),
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
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-widest text-kora-accent mb-4">
                Airbnb · Booking.com · Expedia (Vrbo)
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                Sincroniza Airbnb, Booking y Expedia con tu motor de reservas
              </h1>
              <p className="mt-5 text-white/75 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
                Un solo calendario por habitación: lo que vendes en tus OTAs se bloquea
                en Kora, y lo que vendes directo —sin comisión— se cierra en tus OTAs.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <CtaLink
                  href={RUTA_REGISTRO}
                  ctaName="sincronizar_otas_onboarding"
                  className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Crear mi cuenta gratis
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
                {GARANTIA.diasPrueba} días gratis, sin tarjeta. Incluido en el plan único de {PRECIO} MXN/mes.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Bloque citable */}
        <section className="py-12 sm:py-14 bg-kora-bg border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Sincronizar Airbnb y Booking", href: RUTA },
              ]}
            />
            <Reveal>
              <p className="mt-6 text-lg sm:text-xl text-kora-text leading-relaxed font-medium">
                {RESPUESTA_CITABLE}
              </p>
            </Reveal>
          </div>
        </section>

        {/* El problema */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Vender en tres lados sin vender dos veces
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
                <p>
                  Un hotel pequeño en México rara vez vende sólo por un canal: Airbnb trae
                  al viajero de fin de semana, Booking al que compara precios y el WhatsApp
                  al que ya te conoce. El problema es que cada uno lleva su propio
                  calendario, y el día que dos personas reservan la misma noche por dos
                  lados distintos, alguien se queda sin cuarto.
                </p>
                <p>
                  Kora junta esos calendarios con el tuyo. Cada habitación física tiene su
                  enlace iCal: Kora lee el de cada anuncio de tus OTAs y bloquea esas noches,
                  y tus OTAs leen el de Kora para cerrar lo que vendes directo. Tu página de
                  reservas y Camila, el bot de WhatsApp, sólo ofrecen lo que de verdad está
                  libre.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Pasos */}
        <section className="py-14 sm:py-20 bg-kora-bg">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight text-center">
                Cómo se enlaza, en tres pasos
              </h2>
            </Reveal>
            <ol className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
              {PASOS.map(({ Icon, titulo, texto }, i) => (
                <Reveal key={titulo} delay={0.05 + i * 0.05}>
                  <li className="h-full bg-white rounded-2xl p-6 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-kora-primary text-white text-sm font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <Icon size={18} className="text-kora-primary" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-bold text-kora-text">{titulo}</h3>
                    <p className="mt-2 text-sm text-kora-muted leading-relaxed">{texto}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
              {VENTAJAS.map(({ Icon, titulo, texto }, i) => (
                <Reveal key={titulo} delay={0.05 + i * 0.05}>
                  <div className="h-full flex gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-kora-accent/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-kora-primary" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-kora-text">{titulo}</p>
                      <p className="text-sm text-kora-muted leading-relaxed">{texto}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Por plataforma */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight text-center">
                Dónde está el enlace en cada OTA
              </h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
              {PLATAFORMAS.map(({ nombre, guia }, i) => (
                <Reveal key={nombre} delay={0.05 + i * 0.05}>
                  <div className="h-full bg-kora-bg rounded-2xl p-6 border border-gray-100">
                    <h3 className="font-bold text-kora-text">{nombre}</h3>
                    <p className="mt-3 text-sm text-kora-muted leading-relaxed">
                      <span className="font-semibold text-kora-text">Para traerlo a Kora: </span>
                      {guia.importar}
                    </p>
                    <p className="mt-2 text-sm text-kora-muted leading-relaxed">
                      <span className="font-semibold text-kora-text">Para llevar Kora allá: </span>
                      {guia.exportar}
                    </p>
                    {guia.ojo && (
                      <p className="mt-3 text-xs text-kora-text bg-amber-50 rounded-lg p-3 leading-relaxed">
                        {guia.ojo}
                      </p>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Lo que no hace */}
        <section className="py-14 sm:py-20 bg-kora-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Lo que esta sincronización no hace
              </h2>
              <p className="mt-4 text-sm sm:text-base text-kora-muted leading-relaxed">
                {ENLACE_OTA.limites} Expedia sólo se enlaza a través de Vrbo. Si vendes la
                mayoría de tus noches en varias OTAs y necesitas cambiar precios en todas
                desde un solo lugar, eso sigue siendo trabajo de un channel manager.
              </p>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-6">
                Preguntas frecuentes
              </h2>
            </Reveal>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <Reveal key={f.q} delay={0.04 + i * 0.04}>
                  <div className="bg-kora-bg rounded-2xl p-5 sm:p-6 border border-gray-100">
                    <h3 className="font-bold text-kora-text text-base mb-2">{f.q}</h3>
                    <p className="text-sm text-kora-muted leading-relaxed">{f.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1}>
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RELACIONADOS.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="group flex items-center justify-between gap-3 bg-kora-bg rounded-2xl px-5 py-4 border border-gray-100 hover:border-kora-accent/50 transition-colors"
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
