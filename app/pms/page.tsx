import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  CalendarRange,
  DoorOpen,
  Sparkles,
  Users,
  UserCog,
} from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { JsonLd } from "@/components/shared/JsonLd";
import { PMSMockup } from "@/components/caracteristicas/Mockups";
import {
  AYUDA_ALTA,
  FORECAST_DIAS,
  GARANTIA,
  PRECIO_DESDE,
  RUTA_REGISTRO,
} from "@/lib/oferta";
import { waLink } from "@/lib/contacto";
import { metaDescripcion } from "@/lib/seo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const PRECIO = `$${PRECIO_DESDE.toLocaleString("es-MX")}`;

// Página pilar del PMS (21 oct 2026). En 90 días Search Console no registró ni
// una impresión para una búsqueda con «pms»: el PMS sólo existía como el
// módulo 3 de /caracteristicas y como definición en /glosario/pms.
//
// «PMS hotelero» a secas lo dominan Mews, Cloudbeds y los comparadores; esta
// página apunta a la cola larga donde Kora sí compite: hoteles pequeños, en
// México, en español y con el WhatsApp conectado. Y dice sin rodeos que no hay
// channel manager: quien busca un PMS suele darlo por hecho, y descubrirlo al
// tercer mes cuesta más que la venta (ver lib/integraciones.ts).
const RESPUESTA_CITABLE = `El PMS de Kora es el sistema con el que operas tu hotel desde una sola pantalla: calendario de reservas, check-in y check-out, limpieza y mantenimiento por cuarto, huéspedes y equipo. Está en español, pensado para hoteles pequeños en México y viene incluido en el plan de ${PRECIO} MXN al mes, junto con el motor de reservas y el bot de WhatsApp.`;

const WA_DUDAS = waLink("Hola, vi la página del PMS de Kora y tengo una duda");

export const metadata: Metadata = {
  title: "PMS para hoteles pequeños en México | Kora",
  description: metaDescripcion(
    `PMS hotelero en español para hoteles pequeños: calendario, check-in y check-out, limpieza, huéspedes y equipo en una pantalla, conectado a tu motor de reservas y a tu WhatsApp. ${PRECIO} MXN/mes.`,
  ),
  alternates: { canonical: "/pms" },
  openGraph: {
    title: "PMS para hoteles pequeños, en español y conectado a tu WhatsApp",
    description:
      "Calendario, check-in, limpieza, huéspedes y equipo en una sola pantalla. Incluido con el motor de reservas y el bot de WhatsApp.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${SITE_URL}/pms`,
  },
};

// Cada módulo existe hoy en el panel (app/panel/[slug]/(operativo)/): calendario,
// reservas con registro de llegada, operaciones (limpieza y mantenimiento),
// clientes, equipo con permisos por puesto, e insights.
const CAPACIDADES = [
  {
    Icon: CalendarRange,
    titulo: "Todas tus reservas en un calendario",
    texto:
      "Cuarto por cuarto y noche por noche: lo que llegó por tu web, por WhatsApp o lo que capturas tú. Das de alta o mueves una reserva en segundos.",
  },
  {
    Icon: DoorOpen,
    titulo: "Check-in y check-out",
    texto:
      "Registras la llegada con los datos del huésped y haces el check-out desde la misma reserva. Sin hojas sueltas en recepción.",
  },
  {
    Icon: Sparkles,
    titulo: "Limpieza y mantenimiento por cuarto",
    texto:
      "Cada cuarto con su lista de limpieza, quién la hizo y sus observaciones. Las tareas de mantenimiento llevan prioridad y no se pierden en un chat.",
  },
  {
    Icon: Users,
    titulo: "Tus huéspedes, con su historial",
    texto:
      "Cada huésped con sus estancias, su correo y su teléfono: los datos que Booking se queda, aquí son tuyos para volverle a vender.",
  },
  {
    Icon: UserCog,
    titulo: "Tu equipo, cada quien con su pantalla",
    texto:
      "Dueño, encargada, recepción y limpieza entran con su propio acceso y ven sólo lo que les toca. Tú decides quién ve los ingresos.",
  },
  {
    Icon: BarChart2,
    titulo: "Los números que importan",
    texto: `Ocupación, RevPAR y pronóstico de los próximos ${FORECAST_DIAS} días, sin armar una hoja de Excel.`,
  },
];

const FAQS = [
  {
    q: "¿Qué es un PMS hotelero?",
    a: "Es el software con el que un hotel opera su día a día: habitaciones, reservas, llegadas y salidas, limpieza y cobros. Sustituye al cuaderno de recepción y al Excel, y evita vender dos veces el mismo cuarto.",
  },
  {
    q: "¿Cuánto cuesta el PMS de Kora?",
    a: `Viene incluido en el plan único de ${PRECIO} MXN al mes, con habitaciones ilimitadas, el motor de reservas, el bot de WhatsApp y el CRM. Sin costo de implementación y sin permanencia. Antes de pagar tienes ${GARANTIA.diasPrueba} días gratis, sin tarjeta.`,
  },
  {
    q: "¿Tiene channel manager?",
    a: "No, todavía no. Kora no se sincroniza con Booking, Airbnb ni Expedia: esas reservas las registras en el calendario del panel. Si hoy vendes la mayoría de tus noches por varias OTAs a la vez, necesitas un channel manager y Kora no te lo resuelve.",
  },
  {
    q: "¿Para qué tamaño de hotel es?",
    a: "Para hoteles independientes y boutique de entre 5 y 30 habitaciones, operados por su dueño y sin equipo de sistemas. No está pensado para cadenas.",
  },
  {
    q: "¿Funciona desde el celular?",
    a: "Sí. El panel funciona en el navegador del celular, así que puedes ver el calendario o registrar una llegada sin estar en recepción.",
  },
  {
    q: "¿Puedo pasar mis reservas desde Excel u otro sistema?",
    a: "Kora no importa reservas de otro sistema. Cargas tus cuartos y tarifas desde el panel con un asistente paso a paso, y las reservas que ya tienes las das de alta en el calendario.",
  },
];

const NO_HACE = [
  "No tiene channel manager: no se sincroniza con Booking, Airbnb ni Expedia.",
  "No importa reservas de tu sistema anterior.",
  "No abre cerraduras electrónicas ni se conecta al punto de venta del restaurante.",
];

const RELACIONADOS = [
  { texto: "Motor de reservas sin comisión", href: "/motor-de-reservas" },
  { texto: "Bot de WhatsApp para hoteles", href: "/whatsapp" },
  { texto: "Excel y cuaderno vs. Kora", href: "/comparativas/excel-y-cuaderno" },
  { texto: "Todas las características", href: "/caracteristicas" },
  { texto: "¿Qué es un PMS hotelero?", href: "/glosario/pms" },
  { texto: "Precios", href: "/precios" },
];

export default function PmsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "PMS de Kora",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Property Management System",
        operatingSystem: "Web",
        url: `${SITE_URL}/pms`,
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
                    PMS hotelero
                  </p>
                  <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                    PMS para hoteles pequeños: todo tu hotel en una pantalla
                  </h1>
                  <p className="mt-5 text-white/75 text-base sm:text-lg leading-relaxed max-w-xl">
                    Calendario, llegadas y salidas, limpieza, huéspedes y equipo, en
                    español y desde el celular. Conectado a tu motor de reservas y a
                    tu WhatsApp, así que nada se captura dos veces.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <CtaLink
                      href={RUTA_REGISTRO}
                      ctaName="pms_pilar_onboarding"
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
                    {GARANTIA.diasPrueba} días gratis, sin tarjeta. Después, incluido
                    en el plan único de {PRECIO} MXN/mes con habitaciones ilimitadas.
                  </p>
                </div>
              </Reveal>

              <Reveal direction="right" delay={0.1}>
                <div className="max-w-sm mx-auto w-full">
                  <PMSMockup />
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
                { name: "PMS hotelero", href: "/pms" },
              ]}
            />
            <Reveal>
              <p className="mt-6 text-lg sm:text-xl text-kora-text leading-relaxed font-medium">
                {RESPUESTA_CITABLE}
              </p>
            </Reveal>
          </div>
        </section>

        {/* Por qué un PMS conectado */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                El cuaderno no falla por falta de orden. Falla porque está solo.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-6 space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
                <p>
                  En un hotel pequeño la operación vive repartida: las reservas en
                  una libreta, los pagos en un Excel, las dudas de los huéspedes en
                  tres WhatsApps y la limpieza en la memoria de quien está de turno.
                  Cada traspaso entre uno y otro es una oportunidad de vender dos
                  veces el mismo cuarto.
                </p>
                <p>
                  La mayoría de los PMS resuelven la parte de adentro y dejan la de
                  afuera para otro sistema. En Kora el PMS comparte inventario con el
                  motor de reservas de tu web y con Camila, tu bot de WhatsApp: la
                  reserva que se paga en línea o se cierra por WhatsApp ya está en tu
                  calendario, y ese cuarto deja de ofrecerse.
                </p>
                <p>
                  Y está hecho para quien opera el hotel, no para un departamento de
                  sistemas: en español, sin capacitación y con lo que de verdad usa
                  un hotel de 5 a 30 cuartos.
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
                Qué hace el PMS de Kora
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

        {/* Qué NO hace */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Y lo que el PMS de Kora no hace
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
