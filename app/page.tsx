import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SolutionSection } from "@/components/landing/SolutionSection";
import { IntegracionesSection } from "@/components/landing/IntegracionesSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
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
};

export default function HomePage() {
  return (
    <main>
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <IntegracionesSection />
      <ComparisonSection />
      <SocialProofSection />
      <PricingSection />
      <FAQSection />
      <ContactForm />
    </main>
  );
}
