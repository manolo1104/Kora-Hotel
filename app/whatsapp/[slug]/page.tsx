import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { paginasWhatsApp, getPaginaWhatsApp } from "@/lib/whatsapp";
import { metaDescripcion } from "@/lib/seo";
import { Reveal } from "@/components/shared/Reveal";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { JsonLd } from "@/components/shared/JsonLd";

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export function generateStaticParams() {
  return paginasWhatsApp.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = getPaginaWhatsApp(slug);
  if (!p) return { title: "Página no encontrada — Kora" };
  return {
    title: `${p.titulo} | Kora`,
    description: metaDescripcion(p.respuesta),
    alternates: { canonical: `/whatsapp/${p.slug}` },
    openGraph: {
      title: p.titulo,
      description: p.resumen,
      type: "article",
      locale: "es_MX",
      siteName: "Kora",
      url: `${SITE_URL}/whatsapp/${p.slug}`,
    },
  };
}

// Los párrafos del cuerpo admiten **negritas** al inicio (se usan para nombrar
// cada opción en las páginas que enumeran alternativas). Se resuelve aquí y no
// con una librería de markdown: es el único formato que necesitan.
function Parrafo({ texto }: { texto: string }) {
  // [\s\S] en vez del flag /s: el target de TS del proyecto no lo admite.
  const m = texto.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
  if (!m) return <p>{texto}</p>;
  return (
    <p>
      <strong className="text-kora-text font-semibold">{m[1]}</strong>{" "}
      {m[2]}
    </p>
  );
}

export default async function PaginaWhatsApp({ params }: Props) {
  const { slug } = await params;
  const p = getPaginaWhatsApp(slug);
  if (!p) notFound();

  const url = `${SITE_URL}/whatsapp/${p.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: p.titulo,
        description: p.respuesta,
        inLanguage: "es-MX",
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: "Kora", url: SITE_URL },
        publisher: { "@type": "Organization", name: "Kora", url: SITE_URL },
      },
      ...(p.faqs.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: p.faqs.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ]
        : []),
      ...(p.pasos?.length
        ? [
            {
              "@type": "HowTo",
              name: p.titulo,
              step: p.pasos.map((s, i) => ({
                "@type": "HowToStep",
                position: i + 1,
                name: s.titulo,
                text: s.texto,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <main className="pt-16">
        {/* Hero */}
        <section className="py-14 sm:py-20 bg-kora-primary text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-widest text-kora-accent mb-4">
                Agente de WhatsApp
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                {p.titulo}
              </h1>
            </Reveal>
          </div>
        </section>

        {/* Respuesta citable + migas */}
        <section className="py-10 sm:py-12 bg-kora-bg border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Agente de WhatsApp", href: "/whatsapp" },
                { name: p.titulo, href: `/whatsapp/${p.slug}` },
              ]}
            />
            <Reveal>
              <p className="mt-6 text-lg text-kora-text leading-relaxed font-medium">
                {p.respuesta}
              </p>
            </Reveal>
          </div>
        </section>

        {/* Cuerpo */}
        <section className="py-14 sm:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="space-y-4 text-kora-muted text-sm sm:text-base leading-relaxed">
                {p.cuerpo.map((t, i) => (
                  <Parrafo key={i} texto={t} />
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Pasos */}
        {p.pasos && p.pasos.length > 0 && (
          <section className="py-14 sm:py-16 bg-kora-bg">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <Reveal>
                <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-8">
                  Paso a paso
                </h2>
              </Reveal>
              <div className="space-y-4">
                {p.pasos.map((s, i) => (
                  <Reveal key={s.titulo} delay={0.04 + i * 0.05}>
                    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100">
                      <h3 className="font-bold text-kora-text">{s.titulo}</h3>
                      <p className="mt-1.5 text-sm text-kora-muted leading-relaxed">
                        {s.texto}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Puntos */}
        {p.puntos && p.puntos.length > 0 && (
          <section className="py-14 sm:py-16 bg-kora-bg">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="space-y-5">
                {p.puntos.map((b, i) => (
                  <Reveal key={b.titulo} delay={0.04 + i * 0.05}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-kora-accent/15 flex items-center justify-center flex-shrink-0">
                        <Check size={17} className="text-kora-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="font-bold text-kora-text">{b.titulo}</h3>
                        <p className="mt-1 text-sm text-kora-muted leading-relaxed">
                          {b.texto}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Tabla */}
        {p.tabla && (
          <section className="py-14 sm:py-16 bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <Reveal>
                <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-8">
                  {p.tabla.encabezado}
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-sm min-w-[34rem]">
                    <thead>
                      <tr className="bg-kora-bg text-left">
                        <th className="py-3 px-4 font-semibold text-kora-text"> </th>
                        <th className="py-3 px-4 font-semibold text-kora-muted">
                          La otra opción
                        </th>
                        <th className="py-3 px-4 font-semibold text-kora-primary">
                          Con Kora
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.tabla.filas.map((f) => (
                        <tr key={f.aspecto} className="border-t border-gray-100 align-top">
                          <td className="py-3 px-4 font-semibold text-kora-text">
                            {f.aspecto}
                          </td>
                          <td className="py-3 px-4 text-kora-muted">{f.otro}</td>
                          <td className="py-3 px-4 text-kora-text">{f.kora}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </div>
          </section>
        )}

        {/* FAQ */}
        {p.faqs.length > 0 && (
          <section className="py-14 sm:py-20 bg-kora-bg">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <Reveal>
                <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-6">
                  Preguntas frecuentes
                </h2>
              </Reveal>
              <div className="space-y-3">
                {p.faqs.map((f, i) => (
                  <Reveal key={f.q} delay={0.04 + i * 0.05}>
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

        {/* Enlaces internos del cluster */}
        <section className="py-12 sm:py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-lg font-bold text-kora-text tracking-tight">
              Sigue leyendo
            </h2>
            <ul className="mt-4 space-y-2">
              {(p.relacionados ?? []).map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary underline underline-offset-4 hover:text-kora-primary-dark transition-colors"
                  >
                    {r.texto}
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/whatsapp"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary underline underline-offset-4 hover:text-kora-primary-dark transition-colors"
                >
                  Todo sobre el agente de WhatsApp de Kora
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </div>
        </section>

        <BarraCTA />
      </main>
    </>
  );
}
