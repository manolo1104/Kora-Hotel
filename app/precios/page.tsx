import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CalculadoraROI } from "@/components/landing/CalculadoraROI";
import { PricingSection } from "@/components/landing/PricingSection";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { CtaLink } from "@/components/shared/CtaLink";
import { GARANTIA, PLANES, PRECIO_DESDE, RUTA_REGISTRO } from "@/lib/oferta";
import { JsonLd } from "@/components/shared/JsonLd";

// El precio y los días estaban escritos a mano en el título y la descripción.
// Salen de lib/oferta.ts, que es lo que vigilan las pruebas.
const PRECIO = PRECIO_DESDE.toLocaleString("es-MX");
const DIAS = GARANTIA.diasPrueba;

export const metadata: Metadata = {
  title: `Precios de Kora — $${PRECIO} MXN/mes, todo incluido`,
  description: `Un solo plan: $${PRECIO} MXN al mes, todo incluido y con habitaciones ilimitadas. Crea tu cuenta y pruébalo ${DIAS} días gratis, sin tarjeta.`,
  alternates: {
    canonical: "/precios",
  },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "@id": `${SITE_URL}/precios#producto`,
      name: "Kora",
      image: `${SITE_URL}/opengraph-image`,
      description:
        "Sistema hotelero todo-en-uno con IA para hoteles boutique en México: reservas directas sin comisiones, agente de WhatsApp 24/7, PMS y dashboard con CRM.",
      brand: {
        "@type": "Brand",
        name: "Kora",
      },
      offers: PLANES.map((p) => ({
        "@type": "Offer",
        name: `Kora ${p.nombre}`,
        price: String(p.precio),
        priceCurrency: "MXN",
        url: `${SITE_URL}/precios`,
        availability: "https://schema.org/InStock",
        description: `Todo Kora con habitaciones ilimitadas: motor de reservas (0% de comisión), Camila (WhatsApp con IA), PMS, dashboard y CRM. Plan mes a mes, sin permanencia. Empiezas con ${DIAS} días gratis, sin tarjeta.`,
      })),
    },
    // La prueba gratis va como oferta APARTE, enlazada al producto por @id, y
    // no dentro de `offers`: ahí Google podría tomar el precio más bajo (0) y
    // anunciar Kora como gratis. Gratis es la prueba, no el plan.
    {
      "@type": "Offer",
      "@id": `${SITE_URL}/precios#prueba-gratis`,
      name: `Prueba gratis de Kora, ${DIAS} días`,
      itemOffered: { "@id": `${SITE_URL}/precios#producto` },
      offeredBy: { "@id": `${SITE_URL}/#organization` },
      price: "0",
      priceCurrency: "MXN",
      eligibleDuration: { "@type": "QuantitativeValue", value: DIAS, unitCode: "DAY" },
      url: `${SITE_URL}/como-funciona`,
      description: `Crea tu cuenta, carga tu hotel y prueba Kora completo ${DIAS} días gratis, sin tarjeta. Activas tu plan solo si te convence.`,
    },
    {
      "@type": "Service",
      name: "Página web a la medida para hoteles",
      serviceType: "Diseño y desarrollo de sitio web con motor de reservas",
      provider: { "@id": `${SITE_URL}/#organization` },
      areaServed: { "@type": "Country", name: "México" },
      // Es un servicio de PAGO aparte (un sitio a la medida), no el alta de
      // Kora: ahí sí lo hacemos nosotros. Pero decía «llave en mano», la frase
      // que el resto del sitio retiró el 15 sep 2026, y este texto va en el
      // JSON-LD: quien lea la ficha del negocio no sabe que habla de otra cosa.
      description:
        "Sitio 100% personalizado con motor de reservas propio, diseñado y publicado por el equipo de Kora. Servicio de pago aparte, cotizado según cada hotel, además de tu suscripción a Kora.",
    },
  ],
};

export default function PreciosPage() {
  return (
    <main className="pt-16">
      <JsonLd data={jsonLd} />
      <section className="py-16 sm:py-20 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Precios", href: "/precios" },
              ]}
            />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text">
              Precios
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 text-kora-muted text-lg leading-relaxed">
              Un solo plan, todo incluido y con habitaciones ilimitadas. Mes a
              mes, sin permanencia. Sin sorpresas.
            </p>
          </Reveal>
          {/* El registro arriba del todo: aquí se llega a decidir, y la
              calculadora y el plan quedan debajo del pliegue. */}
          <Reveal delay={0.16}>
            <div className="mt-7 flex flex-col items-center gap-2">
              <CtaLink
                href={RUTA_REGISTRO}
                ctaName="precios_hero_onboarding"
                className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Crear mi cuenta gratis
                <ArrowRight size={16} aria-hidden="true" />
              </CtaLink>
              <p className="text-xs text-kora-muted">
                Pruébalo por dentro {DIAS} días gratis, sin tarjeta.{" "}
                <Link href="/como-funciona" className="font-semibold text-kora-primary underline hover:text-kora-primary-dark">
                  Cómo funciona
                </Link>
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-5 text-sm text-kora-muted">
              ¿Cuánto te cuestan hoy las OTAs?{" "}
              <Link
                href="/herramientas/calculadora-comisiones"
                className="font-semibold text-kora-primary underline hover:text-kora-primary-dark"
              >
                Calcúlalo gratis
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <CalculadoraROI />

      <PricingSection />

      <BarraCTA />
    </main>
  );
}
