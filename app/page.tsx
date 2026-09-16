import type { Metadata } from "next";
import { faqs } from "@/lib/faqs";
import { Hero } from "@/components/landing/Hero";
import { TrustStrip } from "@/components/landing/TrustStrip";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { AgenteSection } from "@/components/landing/AgenteSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { IntegracionesSection } from "@/components/landing/IntegracionesSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { CalculadoraROI } from "@/components/landing/CalculadoraROI";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { MotorReservasSection } from "@/components/landing/MotorReservasSection";
import { DemoMotorSection } from "@/components/landing/DemoMotorSection";
import { DiferenciadoresSection } from "@/components/landing/DiferenciadoresSection";
import { HerramientasSection } from "@/components/landing/HerramientasSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FundadorSection } from "@/components/landing/FundadorSection";
import { ContactForm } from "@/components/landing/ContactForm";
import { JsonLd } from "@/components/shared/JsonLd";
import { FORECAST_DIAS, GARANTIA, PRECIO_DESDE } from "@/lib/oferta";

const PRECIO = PRECIO_DESDE.toLocaleString("es-MX");

// La descripción que ven Google y WhatsApp. Estaba escrita tres veces a mano con
// el precio dentro; ahora sale de las constantes y dice cómo se empieza: creando
// la cuenta y probando Kora por dentro (decisión de Manolo, 15 sep 2026).
const DESCRIPCION = `WhatsApp contestado 24/7 con IA que cotiza con disponibilidad real y cobra, más reservas directas 0% comisión y todo tu hotel en una pantalla. Crea tu cuenta y pruébalo gratis ${GARANTIA.diasPrueba} días, sin tarjeta. Después, $${PRECIO} MXN/mes, sin permanencia.`;

export const metadata: Metadata = {
  title: "Kora — Sistema hotelero con IA para hoteles en México",
  description: DESCRIPCION,
  openGraph: {
    title: "Kora — Sistema hotelero con IA para hoteles en México",
    description: DESCRIPCION,
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kora — Sistema hotelero con IA para hoteles en México",
    description: DESCRIPCION,
  },
  alternates: {
    canonical: "/",
  },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    // La Organization vive globalmente en app/layout.tsx (#organization);
    // aquí solo se referencia por @id desde SoftwareApplication.
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Kora",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "es-MX",
      url: SITE_URL,
      description:
        "Agente de WhatsApp con IA que contesta 24/7, cotiza con disponibilidad real y cierra la reserva con link de pago, dentro de un sistema hotelero completo: motor de reservas sin comisión, PMS, dashboard y CRM. Para hoteles boutique en México.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      featureList: [
        "Motor de reservas directas sin comisiones",
        "Agente de WhatsApp con IA 24/7",
        "PMS: habitaciones, check-in/out y housekeeping",
        "Habitaciones ilimitadas",
        `Dashboard con métricas, RevPAR y forecast de ${FORECAST_DIAS} días`,
        "CRM de huéspedes y emails automáticos",
      ],
      offers: {
        "@type": "Offer",
        name: "Plan Kora",
        priceCurrency: "MXN",
        price: String(PRECIO_DESDE),
        url: `${SITE_URL}/precios`,
        description: `Plan único de $${PRECIO} MXN/mes, todo incluido y con habitaciones ilimitadas: motor de reservas, PMS, Camila (WhatsApp con IA), dashboard y CRM. Mes a mes, sin permanencia. Empiezas con ${GARANTIA.diasPrueba} días gratis, sin tarjeta. Sitio web profesional opcional, como servicio aparte.`,
      },
    },
    // La prueba gratis, como oferta APARTE y no dentro de `offers` del
    // SoftwareApplication. Si fuera ahí, Google puede tomar el precio más bajo
    // (0) para el resultado enriquecido y pintar Kora como «Gratis», que es
    // falso: gratis es la prueba, no el producto. Aquí la leen igual los
    // buscadores y los motores de IA, enlazada al software por @id.
    // `eligibleDuration` es la propiedad de schema.org para «cuánto dura».
    {
      "@type": "Offer",
      "@id": `${SITE_URL}/#prueba-gratis`,
      name: `Prueba gratis de Kora, ${GARANTIA.diasPrueba} días`,
      itemOffered: { "@id": `${SITE_URL}/#software` },
      offeredBy: { "@id": `${SITE_URL}/#organization` },
      priceCurrency: "MXN",
      price: "0",
      eligibleDuration: {
        "@type": "QuantitativeValue",
        value: GARANTIA.diasPrueba,
        unitCode: "DAY",
      },
      // La página que explica la prueba, no la del alta: /panel está en
      // `disallow` de robots.ts y un buscador no puede abrir esa URL.
      url: `${SITE_URL}/como-funciona`,
      description: `Crea tu cuenta, carga tu hotel y prueba Kora completo ${GARANTIA.diasPrueba} días gratis, sin tarjeta. Activas tu plan solo si te convence.`,
    },
    {
      "@type": "Service",
      "@id": `${SITE_URL}/#servicio`,
      name: "Sistema de reservas directas para hoteles independientes en México",
      serviceType: "Software de reservas y gestión hotelera con IA",
      provider: { "@id": `${SITE_URL}/#organization` },
      areaServed: { "@type": "Country", name: "México" },
      url: SITE_URL,
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <main>
      <JsonLd data={jsonLd} />
      <Hero />
      <TrustStrip />
      {/* Demo + prueba real JUSTO bajo el hero: el "ajá" en 90 seg, el caso de
          Paraíso y los negocios en línea mientras hay máxima atención. */}
      <SocialProofSection />
      <ProblemSection />
      {/* El agente de WhatsApp va PRIMERO entre los productos: es la razón por
          la que llegan los prospectos (dos de las últimas reuniones entraron
          por ahí). Antes vivía cuatro bloques más abajo. */}
      <AgenteSection />
      {/* Después el motor de reservas directas y su demo INTERACTIVO (el motor
          real, hotel de demostración): es lo que sostiene el precio. */}
      <MotorReservasSection />
      <DemoMotorSection />
      <SolutionSection />
      <DiferenciadoresSection />
      <FundadorSection />
      <IntegracionesSection />
      {/* Secuencia de valor → precio: el ROI de las OTAs, luego el stack de
          herramientas que reemplazas, y pegado a eso el precio. */}
      <CalculadoraROI />
      <ComparisonSection />
      <PricingSection />
      <FAQSection />
      <ContactForm />
      {/* Herramientas gratis: fuera del flujo de cierre, al final de la página. */}
      <HerramientasSection />
    </main>
  );
}
