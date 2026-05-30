import type { Metadata } from "next";
import { CalculadoraROI } from "@/components/landing/CalculadoraROI";
import { PricingSection } from "@/components/landing/PricingSection";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";

export const metadata: Metadata = {
  title: "Precios de Kora: sistema hotelero desde $2,990 MXN",
  description:
    "Plan fundador $2,990 MXN/mes. Todo incluido: motor de reservas, agente WhatsApp, PMS, IA y más. Sin contrato anual.",
  alternates: {
    canonical: "/precios",
  },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Kora",
  description:
    "Sistema hotelero todo-en-uno con IA para hoteles boutique en México: reservas directas sin comisiones, agente de WhatsApp y llamadas, PMS, pricing dinámico y CFDI 4.0.",
  brand: {
    "@type": "Brand",
    name: "Kora",
  },
  offers: [
    {
      "@type": "Offer",
      name: "Kora Esencial",
      price: "2490",
      priceCurrency: "MXN",
      url: `${SITE_URL}/precios`,
      availability: "https://schema.org/InStock",
      description: "Funciones básicas: motor de reservas, PMS básico y CFDI.",
    },
    {
      "@type": "Offer",
      name: "Kora Completo Fundador",
      price: "2990",
      priceCurrency: "MXN",
      url: `${SITE_URL}/precios`,
      availability: "https://schema.org/InStock",
      description:
        "Todo incluido: IA en WhatsApp y llamadas, pricing dinámico, dashboard, CFDI 4.0 y setup gratis.",
    },
  ],
};

export default function PreciosPage() {
  return (
    <main className="pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="py-16 sm:py-20 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text">
              Precios
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 text-kora-muted text-lg leading-relaxed">
              Un solo plan. Todo incluido. Sin sorpresas.
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
