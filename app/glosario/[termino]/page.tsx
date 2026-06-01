import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { glosario, getTermino } from "@/lib/glosario";
import { Reveal } from "@/components/shared/Reveal";
import { BarraCTA } from "@/components/shared/BarraCTA";

interface Props {
  params: Promise<{ termino: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export function generateStaticParams() {
  return glosario.map((t) => ({ termino: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { termino } = await params;
  const t = getTermino(termino);
  if (!t) return { title: "Término no encontrado — Kora" };
  return {
    title: `${t.pregunta} | Glosario hotelero Kora`,
    description: t.definicion.slice(0, 155),
    alternates: { canonical: `/glosario/${t.slug}` },
    openGraph: {
      title: t.pregunta,
      description: t.resumen,
      type: "article",
      locale: "es_MX",
    },
  };
}

export default async function TerminoPage({ params }: Props) {
  const { termino } = await params;
  const t = getTermino(termino);
  if (!t) notFound();

  const url = `${SITE_URL}/glosario/${t.slug}`;
  const otros = glosario.filter((g) => g.slug !== t.slug).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "DefinedTerm",
        name: t.termino,
        description: t.definicion,
        inDefinedTermSet: `${SITE_URL}/glosario`,
        url,
      },
      {
        "@type": "FAQPage",
        mainEntity: t.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Glosario", item: `${SITE_URL}/glosario` },
          { "@type": "ListItem", position: 3, name: t.termino, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="pt-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-kora-muted">
            <ol className="flex items-center gap-2 flex-wrap">
              <li>
                <Link href="/" className="hover:text-kora-primary transition-colors">
                  Inicio
                </Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li>
                <Link href="/glosario" className="hover:text-kora-primary transition-colors">
                  Glosario
                </Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li className="text-kora-text font-medium">{t.termino}</li>
            </ol>
          </nav>

          <Reveal>
            <p className="text-xs font-bold text-kora-accent uppercase tracking-widest mb-3">
              Glosario hotelero
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text leading-tight">
              {t.pregunta}
            </h1>
          </Reveal>

          {/* Bloque de definición (citable por IA) */}
          <Reveal delay={0.1}>
            <div className="mt-6 bg-kora-bg border-l-4 border-kora-accent rounded-r-2xl p-5 sm:p-6">
              <p className="text-lg text-kora-text leading-relaxed">{t.definicion}</p>
            </div>
          </Reveal>

          {/* Cuerpo */}
          <Reveal delay={0.15}>
            <div className="mt-8 space-y-5">
              {t.cuerpo.map((p, i) => (
                <p key={i} className="text-kora-text leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>

          {/* Relacionado */}
          {t.relacionado && (
            <Reveal delay={0.2}>
              <Link
                href={t.relacionado.href}
                className="btn-press btn-arrow mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                {t.relacionado.texto}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Reveal>
          )}

          {/* FAQ */}
          {t.faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold text-kora-text mb-4">Preguntas frecuentes</h2>
              <div className="space-y-3">
                {t.faqs.map((f) => (
                  <Reveal key={f.q} delay={0.05}>
                    <div className="bg-kora-bg rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-bold text-kora-text text-base mb-1.5">{f.q}</h3>
                      <p className="text-sm text-kora-muted leading-relaxed">{f.a}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          {/* Otros términos */}
          <section className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="text-lg font-bold text-kora-text mb-4">Más términos del glosario</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otros.map((o) => (
                <Link
                  key={o.slug}
                  href={`/glosario/${o.slug}`}
                  className="group block bg-kora-bg rounded-2xl p-4 border border-gray-100 hover:border-kora-primary/20 transition-colors"
                >
                  <p className="font-semibold text-kora-text text-sm group-hover:text-kora-primary transition-colors">
                    {o.pregunta}
                  </p>
                  <p className="mt-1 text-xs text-kora-muted leading-snug">{o.resumen}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <BarraCTA />
      </main>
    </>
  );
}
