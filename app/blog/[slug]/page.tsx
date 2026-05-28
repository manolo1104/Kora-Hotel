import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, articles, extractHeadings } from "@/lib/articles";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { CoverImage } from "@/components/blog/CoverImage";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Artículo no encontrado — Kora" };

  return {
    title: `${article.title} — Blog Kora`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      locale: "es_MX",
      publishedTime: article.publishedIso,
      images: [{ url: article.image, alt: article.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [article.image],
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const headings = extractHeadings(article.content);
  const related = articles.filter((a) => a.slug !== slug).slice(0, 2);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://korahotel.mx";
  const articleUrl = `${siteUrl}/blog/${article.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        image: article.image,
        datePublished: article.publishedIso,
        author: {
          "@type": "Organization",
          name: "Kora",
          url: siteUrl,
        },
        publisher: {
          "@type": "Organization",
          name: "Kora",
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/opengraph-image`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": articleUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` },
          { "@type": "ListItem", position: 3, name: article.title, item: articleUrl },
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
        {/* Cover image */}
        <CoverImage src={article.image} alt={article.imageAlt} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
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
                <Link href="/blog" className="hover:text-kora-primary transition-colors">
                  Blog
                </Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li className="text-kora-text font-medium truncate max-w-[220px] sm:max-w-xs">
                {article.title}
              </li>
            </ol>
          </nav>

          <div className="flex flex-col lg:flex-row gap-12 xl:gap-16">
            {/* ── Article ─────────────────────────────────────────── */}
            <article className="min-w-0 flex-1">
              {/* Category + tags */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
                  {article.category}
                </span>
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-kora-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-bold tracking-tight text-kora-text leading-[1.15] mb-5">
                {article.title}
              </h1>

              {/* Excerpt */}
              <p className="text-lg text-kora-muted leading-relaxed mb-6 max-w-[68ch]">
                {article.excerpt}
              </p>

              {/* Meta bar */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-kora-muted border-t border-b border-gray-100 py-3 mb-10">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-kora-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[8px] font-bold">MC</span>
                  </div>
                  <strong className="text-kora-text font-semibold">{article.author}</strong>
                </div>
                <span aria-hidden="true" className="text-gray-300">·</span>
                <time dateTime={article.publishedIso}>{article.date}</time>
                {article.updatedDate && (
                  <>
                    <span aria-hidden="true" className="text-gray-300">·</span>
                    <span>Actualizado: {article.updatedDate}</span>
                  </>
                )}
                <span aria-hidden="true" className="text-gray-300">·</span>
                <span>{article.readTime} de lectura</span>
              </div>

              {/* Mobile ToC */}
              {headings.length > 0 && (
                <details className="lg:hidden mb-8 bg-kora-bg border border-gray-200 rounded-2xl overflow-hidden">
                  <summary className="px-5 py-4 font-semibold text-sm text-kora-text cursor-pointer select-none">
                    Índice del artículo
                  </summary>
                  <nav className="px-5 pb-5">
                    <ol className="space-y-2.5 mt-2">
                      {headings.map((h, i) => (
                        <li key={h.id} className="flex items-start gap-2.5">
                          <span className="text-[10px] font-bold text-kora-accent mt-[3px] flex-shrink-0 tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <a
                            href={`#${h.id}`}
                            className="text-sm text-kora-muted hover:text-kora-primary transition-colors leading-snug"
                          >
                            {h.text}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </details>
              )}

              {/* Prose body */}
              <div
                className="
                  prose prose-lg max-w-none
                  prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-kora-text
                  prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
                  prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                  prose-p:text-[#1A1A1A] prose-p:leading-[1.8] prose-p:mb-5
                  prose-ul:my-4 prose-ul:space-y-2 prose-li:text-[#1A1A1A] prose-li:leading-relaxed
                  prose-ol:my-4 prose-ol:space-y-2
                  prose-strong:text-kora-text prose-strong:font-semibold
                  prose-a:text-kora-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                  [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24
                "
                dangerouslySetInnerHTML={{ __html: article.content }}
              />

              {/* Author card */}
              <div className="mt-14 pt-10 border-t border-gray-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-kora-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">MC</span>
                </div>
                <div>
                  <p className="font-semibold text-kora-text text-sm">{article.author}</p>
                  <p className="text-xs text-kora-text font-medium mt-0.5">Fundador de Kora · Hotel Paraíso Encantado, Xilitla SLP</p>
                  <p className="text-xs text-kora-muted mt-1.5 leading-relaxed max-w-sm">
                    Creé Kora porque no encontré un sistema que realmente funcionara para mi hotel boutique. Escribo sobre lo que aprendo operando un hotel en México y construyendo tecnología para hoteleros independientes.
                  </p>
                </div>
              </div>

              {/* CTA block */}
              <div className="mt-10 bg-kora-primary rounded-2xl p-7 sm:p-9 text-center">
                <h2 className="font-bold text-white text-xl sm:text-2xl tracking-tight mb-3">
                  ¿Quieres aplicarlo en tu hotel?
                </h2>
                <p className="text-white/70 text-sm leading-relaxed mb-7 max-w-md mx-auto">
                  Te mostramos el sistema completo en 20 minutos, con tus números reales y configurado para tu tipo de hotel.
                </p>
                <Link
                  href="/#contacto"
                  className="btn-press btn-arrow btn-fill inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Solicitar mi lugar como hotel fundador →
                </Link>
              </div>

              {/* Related articles */}
              {related.length > 0 && (
                <div className="mt-12">
                  <h3 className="font-bold text-kora-text text-lg mb-6">Más artículos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {related.map((r) => (
                      <Link
                        key={r.slug}
                        href={`/blog/${r.slug}`}
                        className="group block bg-kora-bg rounded-2xl p-5 border border-gray-100 hover:border-kora-primary/20 transition-colors"
                      >
                        <span className="text-[10px] font-bold text-kora-accent uppercase tracking-widest">
                          {r.category}
                        </span>
                        <p className="mt-1.5 font-semibold text-kora-text text-sm leading-snug group-hover:text-kora-primary transition-colors">
                          {r.title}
                        </p>
                        <p className="mt-2 text-xs text-kora-muted">{r.readTime} de lectura</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* ── Sticky sidebar ───────────────────────────────────── */}
            <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0">
              <div className="sticky top-24 flex flex-col gap-5">
                {/* Table of Contents */}
                {headings.length > 0 && (
                  <div className="bg-kora-bg border border-gray-200 rounded-2xl p-5">
                    <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-4">
                      En este artículo
                    </p>
                    <nav aria-label="Tabla de contenidos">
                      <ol className="space-y-2.5">
                        {headings.map((h, i) => (
                          <li key={h.id} className="flex items-start gap-2.5">
                            <span className="text-[10px] font-bold text-kora-accent mt-[3px] flex-shrink-0 tabular-nums">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <a
                              href={`#${h.id}`}
                              className="text-sm text-kora-muted hover:text-kora-primary transition-colors leading-snug"
                            >
                              {h.text}
                            </a>
                          </li>
                        ))}
                      </ol>
                    </nav>
                  </div>
                )}

                {/* Share buttons */}
                <div className="bg-kora-bg border border-gray-200 rounded-2xl p-5">
                  <ShareButtons title={article.title} slug={article.slug} />
                </div>

                {/* Mini CTA */}
                <div className="bg-kora-primary rounded-2xl p-5 text-center">
                  <p className="text-white font-bold text-sm leading-snug mb-2">
                    ¿Tu hotel necesita esto?
                  </p>
                  <p className="text-white/60 text-xs leading-relaxed mb-4">
                    Demo de 20 min, sin costo, con tus números reales.
                  </p>
                  <Link
                    href="/#contacto"
                    className="btn-press btn-fill inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-kora-accent text-kora-primary font-bold text-xs hover:bg-kora-accent-dark transition-colors"
                  >
                    Solicitar demo →
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
