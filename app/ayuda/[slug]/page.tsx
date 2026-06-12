import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { AYUDA, articuloPorSlug } from "@/lib/ayuda";

export function generateStaticParams() {
  return AYUDA.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const articulo = articuloPorSlug(slug);
  if (!articulo) return { title: "Ayuda | Kora" };
  return {
    title: `${articulo.titulo} | Ayuda de Kora`,
    description: articulo.resumen,
    alternates: { canonical: `/ayuda/${articulo.slug}` },
  };
}

export default async function ArticuloAyudaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const articulo = articuloPorSlug(slug);
  if (!articulo) notFound();

  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-white min-h-[60vh]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Ayuda", href: "/ayuda" },
                { name: articulo.titulo, href: `/ayuda/${articulo.slug}` },
              ]}
            />
          </div>
          <Reveal>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              {articulo.titulo}
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-7 space-y-5">
              {articulo.contenido.map((p, i) => (
                <p key={i} className="text-kora-text text-[15px] leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="mt-10 pt-6 border-t border-gray-100">
              <Link
                href="/ayuda"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:text-kora-primary-dark"
              >
                <ArrowLeft size={15} aria-hidden="true" /> Volver al centro de ayuda
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
