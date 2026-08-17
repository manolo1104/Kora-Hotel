// Un artículo del blog del hotel (/h/{hotel}/blog/{post}). El contenido viene
// del markdown mínimo de lib/hotel-blog.ts: renderPostHtml solo emite <h2> <h3>
// <p> <ul> <li> <strong> <em> con todo lo demás escapado (sin XSS posible).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { HotelImage } from "@/components/HotelImage";
import { MiniNav } from "@/components/mini/MiniNav";
import {
  fechaLargaPost,
  getPostPublicado,
  renderPostHtml,
} from "@/lib/hotel-blog";
import {
  COLOR_DEFAULT,
  fontStack,
  inkFor,
  resolverPaginas,
  type MiniExtras,
} from "@/lib/mini";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

export const revalidate = 3600;

const BASE_URL = "https://kora-hotel.com";

interface HotelMini {
  id: string;
  slug: string;
  nombre: string;
  extras: MiniExtras | null;
}

async function getHotel(slug: string): Promise<HotelMini | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabase
    .from("hoteles")
    .select("id, slug, nombre, extras")
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();
  return (data as HotelMini | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; post: string }>;
}): Promise<Metadata> {
  const { slug, post: slugPost } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) return { title: "Artículo no encontrado" };
  const post = await getPostPublicado(hotel.id, slugPost);
  if (!post) return { title: "Artículo no encontrado" };
  const title = `${post.titulo} · ${hotel.nombre}`;
  const description = post.excerpt || `${post.titulo} — del blog de ${hotel.nombre}.`;
  return {
    title,
    description,
    alternates: { canonical: `/h/${slug}/blog/${post.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "es_MX",
      ...(post.portada ? { images: [{ url: post.portada }] } : {}),
    },
    twitter: { card: post.portada ? "summary_large_image" : "summary" },
  };
}

export default async function PostHotel({
  params,
}: {
  params: Promise<{ slug: string; post: string }>;
}) {
  const { slug, post: slugPost } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) notFound();
  const post = await getPostPublicado(hotel.id, slugPost);
  if (!post) notFound();

  const extras = hotel.extras ?? {};
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const urlPost = `${BASE_URL}/h/${hotel.slug}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": urlPost,
        headline: post.titulo,
        description: post.excerpt || undefined,
        image: post.portada || undefined,
        datePublished: post.publicado_at || undefined,
        dateModified: post.updated_at || post.publicado_at || undefined,
        inLanguage: "es-MX",
        author: { "@type": "Organization", name: hotel.nombre },
        publisher: { "@type": "Organization", name: hotel.nombre },
        mainEntityOfPage: urlPost,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: hotel.nombre, item: `${BASE_URL}/h/${hotel.slug}` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/h/${hotel.slug}/blog` },
          { "@type": "ListItem", position: 3, name: post.titulo, item: urlPost },
        ],
      },
    ],
  };

  return (
    <div
      className="min-h-screen bg-kora-bg"
      style={
        {
          "--brand": color,
          "--brand-ink": inkFor(color),
          fontFamily: fontStack(diseno.fuente),
        } as React.CSSProperties
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <MiniNav
        slugHotel={hotel.slug}
        nav={{
          paginas: resolverPaginas(extras)
            .filter((p) => !p.oculta)
            .map((p) => ({ slug: p.slug, titulo: p.titulo })),
          blog: true,
          activo: "blog",
        }}
      />
      <article className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link
          href={`/h/${hotel.slug}/blog`}
          className="text-sm font-semibold text-kora-muted hover:text-kora-text"
        >
          ← Blog de {hotel.nombre}
        </Link>
        <h1
          className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight"
          style={{ color: "var(--brand)" }}
        >
          {post.titulo}
        </h1>
        <p className="mt-2 text-xs text-kora-muted">{fechaLargaPost(post.publicado_at)}</p>
        {post.portada && (
          <HotelImage
            src={post.portada}
            alt={post.titulo}
            className="mt-5 w-full h-52 sm:h-72 rounded-2xl border border-gray-100"
            sizes="(max-width: 640px) 100vw, 640px"
            priority
          />
        )}
        <div
          className="mt-6 text-[15px] text-kora-text leading-relaxed space-y-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-7 [&_h2]:tracking-tight [&_h3]:font-bold [&_h3]:mt-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5"
          dangerouslySetInnerHTML={{ __html: renderPostHtml(post.contenido) }}
        />
        <div className="mt-10 rounded-2xl p-6 text-center" style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}>
          <p className="text-lg font-bold">¿Planeando tu visita?</p>
          <p className="mt-1 text-sm opacity-85">Hospédate en {hotel.nombre} y reserva directo, sin comisiones.</p>
          <a
            href={`/h/${hotel.slug}/reservar`}
            className="btn-press mt-4 inline-flex items-center justify-center rounded-full px-7 py-3 font-semibold text-sm"
            style={{ backgroundColor: "var(--brand-ink)", color: "var(--brand)" }}
          >
            Ver disponibilidad
          </a>
        </div>
      </article>
    </div>
  );
}
