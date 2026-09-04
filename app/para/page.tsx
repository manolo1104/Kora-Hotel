import type { Metadata } from "next";
import Link from "next/link";
import { personas } from "@/lib/personas";
import { Reveal } from "@/components/shared/Reveal";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { JsonLd } from "@/components/shared/JsonLd";

// Índice de la sección. NO existía: las 9 páginas `/para/{slug}` vivían sólo en
// el sitemap, y el pie enlazaba a mano sólo dos de ellas. Medido el 4 sep 2026,
// la correlación era exacta — las 2 enlazadas eran las 2 únicas indexadas por
// Google, y las otras 7 no existían para nadie. Esta página es la puerta que le
// faltaba a la sección.
export const metadata: Metadata = {
  title: "Kora para tu tipo de hotel | Sistema hotelero en México",
  description:
    "Hotel boutique, cabañas, glamping, hostal o hotel de ciudad: lo que cambia en cada tipo de alojamiento y cómo lo resuelve Kora.",
  alternates: { canonical: "/para" },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Kora por tipo de hotel",
  itemListElement: personas.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: p.titulo,
    url: `${SITE_URL}/para/${p.slug}`,
  })),
};

export default function ParaIndexPage() {
  return (
    <main className="pt-16">
      <JsonLd data={itemListJsonLd} />
      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Por tipo de hotel
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Kora para tu tipo de hotel
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Un hostal no tiene los mismos problemas que un hotel de playa ni que
              unas cabañas. Elige el tuyo y verás lo que cambia — y lo que Kora
              hace distinto en cada caso.
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
                { name: "Por tipo de hotel", href: "/para" },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {personas.map((p, i) => (
              <Reveal key={p.slug} delay={0.05 + i * 0.06}>
                <Link
                  href={`/para/${p.slug}`}
                  className="group block h-full bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-kora-primary/20 transition-colors"
                >
                  <h2 className="font-bold text-kora-text text-lg group-hover:text-kora-primary transition-colors">
                    {p.titulo}
                  </h2>
                  <p className="mt-2 text-sm text-kora-muted leading-relaxed">{p.resumen}</p>
                  <span className="mt-3 inline-block text-sm font-semibold text-kora-primary">
                    Ver cómo aplica →
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
