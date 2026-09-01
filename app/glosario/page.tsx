import type { Metadata } from "next";
import Link from "next/link";
import { glosario } from "@/lib/glosario";
import { Reveal } from "@/components/shared/Reveal";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { JsonLd } from "@/components/shared/JsonLd";

export const metadata: Metadata = {
  title: "Glosario hotelero: términos que todo hotelero debe conocer | Kora",
  description:
    "Qué es un PMS, un motor de reservas, el RevPAR, el overbooking y más. Glosario claro y en español para hoteles boutique en México.",
  alternates: { canonical: "/glosario" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export default function GlosarioPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Glosario hotelero de Kora",
    url: `${SITE_URL}/glosario`,
    hasDefinedTerm: glosario.map((t) => ({
      "@type": "DefinedTerm",
      name: t.termino,
      description: t.definicion,
      url: `${SITE_URL}/glosario/${t.slug}`,
    })),
  };

  return (
    <main className="pt-16">
      <JsonLd data={jsonLd} />
      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Glosario hotelero
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Los términos del hotel, explicados claro
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Sin tecnicismos en inglés. Lo que significan los conceptos clave para
              operar tu hotel boutique en México.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-kora-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Glosario", href: "/glosario" },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {glosario.map((t, i) => (
              <Reveal key={t.slug} delay={0.04 + i * 0.04}>
                <Link
                  href={`/glosario/${t.slug}`}
                  className="group block h-full bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-kora-primary/20 transition-colors"
                >
                  <h2 className="font-bold text-kora-text text-lg group-hover:text-kora-primary transition-colors">
                    {t.pregunta}
                  </h2>
                  <p className="mt-2 text-sm text-kora-muted leading-relaxed">{t.resumen}</p>
                  <span className="mt-3 inline-block text-sm font-semibold text-kora-primary">
                    Leer →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
