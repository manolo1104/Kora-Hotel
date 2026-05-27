import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getArticle, articles } from "@/lib/articles";
import { notFound } from "next/navigation";

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
      images: [article.image],
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

  return (
    <main className="pt-16">
      {/* Header */}
      <section className="py-12 sm:py-16 bg-kora-bg border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-kora-muted hover:text-kora-primary transition-colors mb-6"
          >
            ← Volver al blog
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text leading-tight">
            {article.title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-kora-muted mt-4">
            <time dateTime={article.date}>{article.date}</time>
            <span aria-hidden="true">·</span>
            <span>{article.readTime} de lectura</span>
            <span aria-hidden="true">·</span>
            <span>Kora</span>
          </div>
        </div>
      </section>

      {/* Cover image */}
      <div className="bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <div className="aspect-video rounded-2xl overflow-hidden">
            <img
              src={article.image}
              alt={article.imageAlt}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Article body */}
      <section className="py-10 sm:py-14 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="
              prose prose-gray max-w-none
              prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-kora-text
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-kora-text prose-p:leading-relaxed prose-p:mb-5
              prose-ul:my-4 prose-ul:space-y-2 prose-li:text-kora-text
              prose-ol:my-4 prose-ol:space-y-2
              prose-strong:text-kora-text prose-strong:font-semibold
              prose-a:text-kora-primary prose-a:no-underline hover:prose-a:underline
            "
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* CTA card */}
          <div className="mt-14 pt-10 border-t border-gray-100">
            <div className="bg-kora-primary rounded-2xl p-7 sm:p-9 text-center">
              <h2 className="font-bold text-white text-xl sm:text-2xl tracking-tight mb-3">
                ¿Quieres aplicarlo en tu hotel?
              </h2>
              <p className="text-white/70 text-sm leading-relaxed mb-7 max-w-md mx-auto">
                Te mostramos el sistema completo en 20 minutos, con tus números
                reales y configurado para tu tipo de hotel.
              </p>
              <Link
                href="/#contacto"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Solicitar mi lugar como hotel fundador
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Related articles */}
          <div className="mt-12">
            <h3 className="font-bold text-kora-text text-lg mb-6">
              Más artículos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {articles
                .filter((a) => a.slug !== slug)
                .slice(0, 2)
                .map((related) => (
                  <Link
                    key={related.slug}
                    href={`/blog/${related.slug}`}
                    className="group block bg-kora-bg rounded-2xl p-5 border border-gray-100 hover:border-kora-primary/20 transition-colors"
                  >
                    <p className="font-semibold text-kora-text text-sm leading-snug group-hover:text-kora-primary transition-colors">
                      {related.title}
                    </p>
                    <p className="mt-2 text-xs text-kora-muted">
                      {related.readTime} de lectura
                    </p>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
