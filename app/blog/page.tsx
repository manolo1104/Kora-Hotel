import type { Metadata } from "next";
import { BarraCTA } from "@/components/shared/BarraCTA";

export const metadata: Metadata = {
  title: "Blog — Kora",
  description:
    "Artículos sobre gestión hotelera inteligente, revenue management y cómo los hoteles boutique en México pueden crecer con tecnología.",
};

const articles = [
  {
    slug: "como-aumentar-reservas-directas",
    title:
      "Cómo aumentar tus reservas directas y dejar de pagar comisiones a Booking",
    excerpt:
      "El 18% que le pagas a Booking en cada reserva puede quedarse en tu hotel. Te explicamos cómo.",
    date: "20 de mayo, 2026",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&q=75",
    imageAlt: "Recepción de hotel boutique",
  },
  {
    slug: "revenue-management-hoteles-boutique-mexico",
    title: "Guía completa: Revenue management para hoteles boutique en México",
    excerpt:
      "Sube y baja tus precios según la demanda, puentes y eventos locales. Sin ser un experto.",
    date: "15 de mayo, 2026",
    readTime: "8 min",
    image:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&auto=format&q=75",
    imageAlt: "Vista de alberca en hotel boutique",
  },
  {
    slug: "agente-whatsapp-ia-hotel-2026",
    title:
      "Por qué tu hotel boutique necesita un agente de WhatsApp con IA en 2026",
    excerpt:
      "Las reservas que pierdes de noche porque nadie contesta son dinero que se va. Esto tiene solución.",
    date: "5 de mayo, 2026",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&q=75",
    imageAlt: "Habitación de hotel boutique con vista",
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
            {articles.map((article) => (
              <article
                key={article.slug}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-col"
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={article.image}
                    alt={article.imageAlt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
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
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
