import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: `${title} — Blog Kora`,
    description:
      "Lee este artículo del blog de Kora sobre gestión hotelera inteligente para hoteles boutique en México.",
    openGraph: {
      title: `${title} — Blog Kora`,
      type: "article",
      locale: "es_MX",
    },
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-kora-bg border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <a
            href="/blog"
            className="inline-flex items-center text-sm text-kora-muted hover:text-kora-primary transition-colors mb-6"
            aria-label="Volver al blog"
          >
            ← Volver al blog
          </a>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text leading-tight">
            {title}
          </h1>
          <div className="flex items-center gap-3 text-xs text-kora-muted mt-4">
            <time>Mayo 2026</time>
            <span aria-hidden="true">·</span>
            <span>Kora</span>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="aspect-video bg-gradient-to-br from-kora-primary/10 to-kora-accent/20 rounded-2xl mb-10"
            aria-hidden="true"
          />

          <div className="prose prose-gray max-w-none">
            <p className="text-kora-muted text-sm p-4 bg-kora-bg rounded-xl border border-gray-100 font-medium">
              TODO: Conectar con fuente de contenido real. Por ahora este
              artículo es un placeholder con slug: <code>{slug}</code>
            </p>
            <p className="mt-6 text-kora-text leading-relaxed">
              Este artículo sobre gestión hotelera inteligente está en camino.
              Mientras tanto, escríbenos directamente por WhatsApp y uno de
              nuestros expertos responde tus preguntas.
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-100">
            <div className="bg-kora-bg rounded-2xl p-6 sm:p-8 text-center">
              <h2 className="font-bold text-kora-text text-lg">
                ¿Te interesa lo que leíste?
              </h2>
              <p className="mt-2 text-kora-muted text-sm">
                Solicita tu lugar como hotel fundador y ve Kora funcionando en
                tu hotel.
              </p>
              <a
                href="/#contacto"
                className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Solicitar mi lugar
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
