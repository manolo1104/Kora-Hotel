import type { Metadata } from "next";
import Link from "next/link";
import { articles } from "@/lib/articles";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";

export const metadata: Metadata = {
  title: "Blog Kora: gestión hotelera y reservas directas",
  description:
    "Artículos sobre gestión hotelera inteligente, revenue management y cómo los hoteles boutique en México pueden crecer con tecnología.",
  alternates: {
    canonical: "/blog",
  },
};

const categories = Array.from(new Set(articles.map((a) => a.category)));

export default function BlogPage() {
  return (
    <main className="pt-16">
      {/* Header */}
      <section className="py-16 sm:py-20 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-xs font-bold text-kora-accent uppercase tracking-widest mb-3">
              {articles.length} artículos publicados
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text">
              Blog
            </h1>
            <p className="mt-3 text-kora-muted text-lg max-w-xl">
              Gestión hotelera inteligente para hoteles boutique en México.
            </p>

            {/* Category pills */}
            <div className="mt-6 flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-kora-bg border border-gray-200 text-xs font-semibold text-kora-muted"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-kora-accent flex-shrink-0" />
                  {cat}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Articles grid */}
      <section className="py-16 sm:py-20 bg-kora-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article, i) => (
              <Reveal key={article.slug} delay={0.06 + i * 0.08} className="h-full">
                <article className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col h-full card-hover hover:border-kora-primary/20 transition-colors">
                  <Link
                    href={`/blog/${article.slug}`}
                    className="block aspect-video overflow-hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <img
                      src={article.image}
                      alt={article.imageAlt}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </Link>

                  <div className="p-6 flex flex-col flex-1">
                    {/* Category */}
                    <span className="text-[10px] font-bold text-kora-accent uppercase tracking-widest mb-3">
                      {article.category}
                    </span>

                    {/* Title */}
                    <h2 className="font-bold text-kora-text text-base leading-snug mb-3">
                      <Link
                        href={`/blog/${article.slug}`}
                        className="hover:text-kora-primary transition-colors"
                      >
                        {article.title}
                      </Link>
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm text-kora-muted leading-relaxed flex-1">
                      {article.excerpt}
                    </p>

                    {/* Meta */}
                    <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-kora-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-[9px] font-bold">MC</span>
                        </div>
                        <span className="text-xs text-kora-muted truncate">
                          {article.author}
                        </span>
                      </div>
                      <span className="text-xs text-kora-muted flex-shrink-0">
                        {article.readTime} de lectura
                      </span>
                    </div>

                    <Link
                      href={`/blog/${article.slug}`}
                      className="mt-4 inline-flex items-center text-sm font-semibold text-kora-primary hover:text-kora-accent transition-colors"
                      aria-label={`Leer artículo: ${article.title}`}
                    >
                      Leer artículo →
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
