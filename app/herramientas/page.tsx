import type { Metadata } from "next";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { HerramientasExplorador } from "@/components/herramientas/HerramientasExplorador";
import { herramientasDisponibles } from "@/lib/herramientas";
import { JsonLd } from "@/components/shared/JsonLd";

export const metadata: Metadata = {
  title: "Herramientas gratis para hoteles | Kora",
  description:
    "Calculadoras y herramientas gratuitas para dueños de hoteles boutique en México: comisiones de OTAs, tarifas, punto de equilibrio, impuestos y más.",
  alternates: {
    canonical: "/herramientas",
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Herramientas gratis para hoteles",
  itemListElement: herramientasDisponibles.map((h, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: h.titulo,
    url: `${SITE_URL}/herramientas/${h.slug}`,
  })),
};

export default function HerramientasPage() {
  return (
    <main className="pt-16">
      <JsonLd data={itemListJsonLd} />
      {/* Hero */}
      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Gratis para hoteleros
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Herramientas gratis para tu hotel
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Calculadoras simples y honestas para tomar mejores decisiones en tu
              hotel. Sin registro para usarlas.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Explorador: destacado + búsqueda + categorías */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <Breadcrumbs
            items={[
              { name: "Inicio", href: "/" },
              { name: "Herramientas", href: "/herramientas" },
            ]}
          />
        </div>
        <HerramientasExplorador />
      </section>

      <BarraCTA />
    </main>
  );
}
