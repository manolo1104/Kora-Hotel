import type { Metadata } from "next";
import { faqs } from "@/lib/faqs";
import { Hero } from "@/components/landing/Hero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { IntegracionesSection } from "@/components/landing/IntegracionesSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { VideoDemoSection } from "@/components/landing/VideoDemoSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { ContactForm } from "@/components/landing/ContactForm";

export const metadata: Metadata = {
  title: "Kora — Sistema hotelero con IA para hoteles boutique en México",
  description:
    "Gestiona tu hotel, responde WhatsApps 24/7 y toma reservas directo. Todo en español. Desde $2,990 MXN/mes.",
  openGraph: {
    title: "Kora — Sistema hotelero con IA para hoteles boutique en México",
    description:
      "Gestiona tu hotel, responde WhatsApps 24/7 y toma reservas directo. Todo en español. Desde $2,990 MXN/mes.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kora — Sistema hotelero con IA para hoteles boutique en México",
    description:
      "Gestiona tu hotel, responde WhatsApps 24/7 y toma reservas directo. Todo en español. Desde $2,990 MXN/mes.",
  },
  alternates: {
    canonical: "/",
  },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kora",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/opengraph-image`,
      },
      description:
        "Sistema hotelero todo-en-uno con IA para hoteles boutique en México.",
      email: "hola@korahotel.mx",
      areaServed: {
        "@type": "Country",
        name: "México",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Kora",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "es-MX",
      url: SITE_URL,
      description:
        "Sistema hotelero todo-en-uno con IA: motor de reservas directas sin comisiones, agente de WhatsApp y llamadas 24/7, PMS, pricing dinámico y CFDI 4.0. Para hoteles boutique en México.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        price: "2990",
        priceCurrency: "MXN",
        description: "Plan Completo Fundador, todo incluido.",
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
      <PricingSection />
      <FAQSection />
      <ContactForm />
    </main>
  );
}
