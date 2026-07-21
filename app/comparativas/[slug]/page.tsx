import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { comparativas, getComparativa } from "@/lib/comparativas";
import { metaDescripcion } from "@/lib/seo";
import { Reveal } from "@/components/shared/Reveal";
import { BarraCTA } from "@/components/shared/BarraCTA";

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export function generateStaticParams() {
  return comparativas.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = getComparativa(slug);
  if (!c) return { title: "Comparativa no encontrada — Kora" };
  return {
    title: `${c.titulo} | Kora`,
    description: metaDescripcion(c.intro),
    alternates: { canonical: `/comparativas/${c.slug}` },
    openGraph: {
      title: c.titulo,
      description: c.resumen,
      type: "article",
      locale: "es_MX",
    },
  };
}

export default async function ComparativaPage({ params }: Props) {
  const { slug } = await params;
  const c = getComparativa(slug);
  if (!c) notFound();

  const url = `${SITE_URL}/comparativas/${c.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Comparativas", item: `${SITE_URL}/comparativas` },
          { "@type": "ListItem", position: 3, name: c.competidor, item: url },
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
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-kora-muted">
            <ol className="flex items-center gap-2 flex-wrap">
              <li>
                <Link href="/" className="hover:text-kora-primary transition-colors">Inicio</Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li>
                <Link href="/comparativas" className="hover:text-kora-primary transition-colors">Comparativas</Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li className="text-kora-text font-medium">{c.competidor}</li>
            </ol>
          </nav>

          <Reveal>
            <p className="text-xs font-bold text-kora-accent uppercase tracking-widest mb-3">
              Comparativa
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text leading-tight">
              {c.titulo}
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-6 bg-kora-bg border-l-4 border-kora-accent rounded-r-2xl p-5 sm:p-6">
              <p className="text-lg text-kora-text leading-relaxed">{c.intro}</p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 space-y-5">
              {c.cuerpo.map((p, i) => (
                <p key={i} className="text-kora-text leading-relaxed">{p}</p>
              ))}
            </div>
          </Reveal>

          {/* Tabla comparativa */}
          <Reveal delay={0.15}>
            <div className="mt-10 overflow-hidden rounded-2xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-kora-bg">
                    <th className="text-left font-bold text-kora-text px-4 py-3"> </th>
                    <th className="text-left font-bold text-kora-muted px-4 py-3">{c.competidor}</th>
                    <th className="text-left font-bold text-kora-primary px-4 py-3">Directo con Kora</th>
                  </tr>
                </thead>
                <tbody>
                  {c.tabla.map((row, i) => (
                    <tr key={i} className={i % 2 ? "bg-white" : "bg-kora-bg/40"}>
                      <td className="px-4 py-3 font-semibold text-kora-text align-top">{row.aspecto}</td>
                      <td className="px-4 py-3 text-kora-muted align-top">{row.ota}</td>
                      <td className="px-4 py-3 text-kora-text align-top">{row.kora}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          {/* Cuándo conviene cada una */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Reveal delay={0.1}>
              <div className="bg-kora-bg rounded-2xl p-6 border border-gray-100 h-full">
                <h2 className="font-bold text-kora-text mb-3">Cuándo te conviene {c.competidor}</h2>
                <ul className="space-y-2">
                  {c.cuandoOta.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm text-kora-muted">
                      <Check size={15} className="flex-shrink-0 text-kora-muted mt-0.5" aria-hidden="true" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="bg-kora-primary rounded-2xl p-6 h-full">
                <h2 className="font-bold text-white mb-3">Cuándo te conviene el directo (Kora)</h2>
                <ul className="space-y-2">
                  {c.cuandoKora.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm text-white/90">
                      <Check size={15} className="flex-shrink-0 text-kora-accent mt-0.5" aria-hidden="true" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* FAQ */}
          {c.faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold text-kora-text mb-4">Preguntas frecuentes</h2>
              <div className="space-y-3">
                {c.faqs.map((f) => (
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

          <p className="mt-10 text-sm text-kora-muted">
            <X size={14} className="inline mb-0.5 text-kora-muted" aria-hidden="true" /> Nota: las
            comisiones de OTAs (≈15%–20%) son rangos típicos del sector; tu acuerdo
            puede variar.{" "}
            <Link href="/herramientas/calculadora-comisiones" className="font-semibold text-kora-primary underline">
              Calcula lo que pagas hoy
            </Link>.
          </p>
        </div>

        <BarraCTA />
      </main>
    </>
  );
}
