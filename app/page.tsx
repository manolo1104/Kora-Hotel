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
import { FORECAST_DIAS } from "@/lib/oferta";

export const metadata: Metadata = {
  title: "Kora — Sistema hotelero con IA para hoteles en México",
  description:
    "WhatsApp contestado 24/7 con IA que cotiza con disponibilidad real y cobra, más reservas directas 0% comisión y todo tu hotel en una pantalla. $550 MXN/mes, habitaciones ilimitadas, sin permanencia.",
  openGraph: {
    title: "Kora — Sistema hotelero con IA para hoteles en México",
    description:
      "WhatsApp contestado 24/7 con IA que cotiza con disponibilidad real y cobra, más reservas directas 0% comisión y todo tu hotel en una pantalla. $550 MXN/mes, habitaciones ilimitadas, sin permanencia.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kora — Sistema hotelero con IA para hoteles en México",
    description:
      "WhatsApp contestado 24/7 con IA que cotiza con disponibilidad real y cobra, más reservas directas 0% comisión y todo tu hotel en una pantalla. $550 MXN/mes, habitaciones ilimitadas, sin permanencia.",
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
        priceCurrency: "MXN",
        price: "550",
        description:
          "Plan único de $550 MXN/mes, todo incluido y con habitaciones ilimitadas: motor de reservas, PMS, Camila (WhatsApp con IA), dashboard y CRM. Mes a mes, sin permanencia. Sitio web profesional opcional, como servicio aparte.",
      },
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
