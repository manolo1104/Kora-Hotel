import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AlertCircle, Check } from "lucide-react";
import { personas, getPersona } from "@/lib/personas";
import { metaDescripcion } from "@/lib/seo";
import { Reveal } from "@/components/shared/Reveal";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { JsonLd } from "@/components/shared/JsonLd";

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export function generateStaticParams() {
  return personas.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getPersona(slug);
  if (!p) return { title: "Página no encontrada — Kora" };
  return {
    title: `${p.titulo} | Kora`,
    description: metaDescripcion(p.intro),
    alternates: { canonical: `/para/${p.slug}` },
    openGraph: {
      title: p.titulo,
      description: p.resumen,
      type: "website",
      locale: "es_MX",
    },
  };
}

export default async function PersonaPage({ params }: Props) {
  const { slug } = await params;
  const p = getPersona(slug);
  if (!p) notFound();

  const url = `${SITE_URL}/para/${p.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: p.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: p.titulo, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="pt-16">
        {/* Hero */}
        <section className="py-16 sm:py-20 bg-kora-primary text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Reveal>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                {p.titulo}
              </h1>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-5 text-white/75 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
                {p.intro}
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <Link
                href="/contacto"
                className="btn-press btn-arrow btn-fill mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Solicitar una demo
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* Dolor */}
        <section className="py-14 sm:py-20 bg-kora-bg">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-8">
              Lo que más duele
            </h2>
            <div className="space-y-3">
              {p.dolor.map((d, i) => (
                <Reveal key={i} delay={0.05 + i * 0.06}>
                  <div className="flex items-start gap-3 bg-white rounded-2xl p-5 border border-gray-100">
                    <AlertCircle size={18} className="flex-shrink-0 text-kora-primary mt-0.5" aria-hidden="true" />
                    <p className="text-kora-text leading-relaxed text-sm sm:text-base">{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Solución */}
        <section className="py-14 sm:py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-8">
              Cómo lo resuelve Kora
            </h2>
            <div className="space-y-4">
              {p.solucion.map((s, i) => (
                <Reveal key={i} delay={0.05 + i * 0.06}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-kora-accent/15 flex items-center justify-center flex-shrink-0">
                      <Check size={18} className="text-kora-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-bold text-kora-text">{s.titulo}</h3>
                      <p className="mt-1 text-sm text-kora-muted leading-relaxed">{s.texto}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1}>
              <p className="mt-8 text-sm text-kora-muted">
                ¿Quieres verlo con un caso real?{" "}
                <Link href="/casos/paraiso-encantado" className="font-semibold text-kora-primary underline">
                  Mira cómo opera el Hotel Paraíso Encantado
                </Link>.
              </p>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        {p.faqs.length > 0 && (
          <section className="py-14 sm:py-20 bg-kora-bg">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-6">
                Preguntas frecuentes
              </h2>
              <div className="space-y-3">
                {p.faqs.map((f) => (
                  <Reveal key={f.q} delay={0.05}>
                    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100">
                      <h3 className="font-bold text-kora-text text-base mb-2">{f.q}</h3>
                      <p className="text-sm text-kora-muted leading-relaxed">{f.a}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        <BarraCTA />
      </main>
    </>
  );
}
