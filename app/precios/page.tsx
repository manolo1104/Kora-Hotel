import type { Metadata } from "next";
import Link from "next/link";
import { CalculadoraROI } from "@/components/landing/CalculadoraROI";
import { PricingSection } from "@/components/landing/PricingSection";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export const metadata: Metadata = {
  title: "Precios de Kora: sistema hotelero desde $2,990 MXN",
  description:
    "Plan fundador $2,990 MXN/mes. Todo incluido: motor de reservas, agente WhatsApp, PMS, IA y más. Sin contrato anual.",
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
      name: "Kora",
      description:
        "Sistema hotelero todo-en-uno con IA para hoteles boutique en México: reservas directas sin comisiones, agente de WhatsApp 24/7, PMS, dashboard con CRM, pricing dinámico y CFDI 4.0.",
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
            "Todo incluido: IA en WhatsApp, PMS, pricing dinámico, dashboard con CRM, CFDI 4.0 y setup gratis.",
        },
      ],
    },
    {
      "@type": "Service",
      name: "Página web a la medida para hoteles",
      serviceType: "Diseño y desarrollo de sitio web con motor de reservas",
      provider: { "@type": "Organization", name: "Kora", url: SITE_URL },
      areaServed: { "@type": "Country", name: "México" },
      description:
        "Servicio hecho a tu medida: sitio 100% personalizado con motor de reservas propio y dashboard completo. Lo diseñamos, publicamos y capacitamos llave en mano.",
      offers: {
        "@type": "Offer",
        price: "10000",
        priceCurrency: "MXN",
        url: `${SITE_URL}/precios`,
        availability: "https://schema.org/InStock",
        description:
          "Desde $10,000 MXN pago único más $700 MXN/mes de mantenimiento (incluye dominio).",
      },
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
              Un solo plan. Todo incluido. Sin sorpresas.
            </p>
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
