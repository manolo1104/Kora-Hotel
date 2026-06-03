import type { Metadata } from "next";
import { faqs } from "@/lib/faqs";
import { Hero } from "@/components/landing/Hero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { IntegracionesSection } from "@/components/landing/IntegracionesSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { VideoDemoSection } from "@/components/landing/VideoDemoSection";
import { HerramientasSection } from "@/components/landing/HerramientasSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FundadorSection } from "@/components/landing/FundadorSection";
import { ContactForm } from "@/components/landing/ContactForm";

export const metadata: Metadata = {
  title: "Kora — Sistema hotelero con IA para hoteles boutique en México",
  description:
    "Te construimos tu sitio web profesional gratis (para los primeros 10 hoteles), gestionamos tu hotel, respondemos WhatsApps 24/7 y tomas reservas directo. Todo en español. Desde $1,990 MXN/mes.",
  openGraph: {
    title: "Kora — Sistema hotelero con IA para hoteles boutique en México",
    description:
      "Te construimos tu sitio web profesional gratis (para los primeros 10 hoteles), gestionamos tu hotel, respondemos WhatsApps 24/7 y tomas reservas directo. Todo en español. Desde $1,990 MXN/mes.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kora — Sistema hotelero con IA para hoteles boutique en México",
    description:
      "Te construimos tu sitio web profesional gratis (para los primeros 10 hoteles), gestionamos tu hotel, respondemos WhatsApps 24/7 y tomas reservas directo. Todo en español. Desde $1,990 MXN/mes.",
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
        "Sistema hotelero todo-en-uno con IA: motor de reservas directas sin comisiones, agente de WhatsApp 24/7, PMS, dashboard con CRM, pricing dinámico y CFDI 4.0. Para hoteles boutique en México.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      featureList: [
        "Motor de reservas directas sin comisiones",
        "Agente de WhatsApp con IA 24/7",
        "PMS: habitaciones, check-in/out y housekeeping",
        "Pricing dinámico con IA",
        "Dashboard con métricas, RevPAR y forecast de 30 días",
        "CRM de huéspedes y emails automáticos",
        "Facturación CFDI 4.0 integrada con el SAT",
      ],
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "MXN",
        lowPrice: "1990",
        highPrice: "4490",
        offerCount: 3,
        description:
          "Precio fundador desde $1,990 MXN/mes según el tamaño del hotel (3 planes: 1–8, 9–20 y 21+ habitaciones), con sitio web profesional gratis para los primeros 10 hoteles.",
      },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <IntegracionesSection />
      <ComparisonSection />
      <SocialProofSection />
      <VideoDemoSection />
      <HerramientasSection />
      <PricingSection />
      <FAQSection />
      <FundadorSection />
      <ContactForm />
    </main>
  );
}
