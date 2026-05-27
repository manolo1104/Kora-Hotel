import type { Metadata } from "next";
import { BarraCTA } from "@/components/shared/BarraCTA";

export const metadata: Metadata = {
  title: "Blog — Kora",
  description:
    "Artículos sobre gestión hotelera inteligente, revenue management y cómo los hoteles boutique en México pueden crecer con tecnología.",
};

const placeholderArticles = [
  {
    slug: "como-aumentar-reservas-directas",
    title:
      "Cómo aumentar tus reservas directas y dejar de pagar comisiones a Booking",
    excerpt:
      "El 18% que le pagas a Booking en cada reserva puede quedarse en tu hotel. Te explicamos cómo.",
    date: "20 de mayo, 2026",
    readTime: "5 min",
  },
  {
    slug: "revenue-management-hoteles-boutique-mexico",
    title: "Guía completa: Revenue management para hoteles boutique en México",
    excerpt:
      "Sube y baja tus precios según la demanda, puentes y eventos locales. Sin ser un experto.",
    date: "15 de mayo, 2026",
    readTime: "8 min",
  },
  {
    slug: "agente-whatsapp-ia-hotel-2026",
    title:
      "Por qué tu hotel boutique necesita un agente de WhatsApp con IA en 2026",
    excerpt:
      "Las reservas que pierdes de noche porque nadie contesta son dinero que se va. Esto tiene solución.",
    date: "5 de mayo, 2026",
    readTime: "6 min",
  },
];

export default function BlogPage() {
  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text">
            Blog
          </h1>
          <p className="mt-4 text-kora-muted text-lg">
            Gestión hotelera inteligente para hoteles boutique en México.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-kora-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {placeholderArticles.map((article) => (
              <article
                key={article.slug}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col"
              >
                <div
                  className="aspect-video bg-gradient-to-br from-kora-primary/10 to-kora-accent/20"
                  aria-hidden="true"
                />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 text-xs text-kora-muted mb-3">
                    <time>{article.date}</time>
                    <span aria-hidden="true">·</span>
                    <span>{article.readTime} de lectura</span>
                  </div>
                  <h2 className="font-bold text-kora-text text-base leading-snug mb-3">
                    {article.title}
                  </h2>
                  <p className="text-sm text-kora-muted leading-relaxed flex-1">
                    {article.excerpt}
                  </p>
                  <a
                    href={`/blog/${article.slug}`}
                    className="mt-5 inline-flex items-center text-sm font-semibold text-kora-primary hover:text-kora-accent transition-colors"
                    aria-label={`Leer artículo: ${article.title}`}
                  >
                    Leer artículo
                  </a>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-12 text-center text-xs text-kora-muted">
            TODO: Conectar con el agente de blog automático para publicar
            contenido generado con IA.
          </p>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
