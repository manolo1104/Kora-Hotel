// Índice del blog del hotel (/h/{hotel}/blog). Estático con revalidate: los
// posts cambian poco y al publicar se revalida desde /api/admin/blog-publish.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { HotelImage } from "@/components/HotelImage";
import { MiniNav } from "@/components/mini/MiniNav";
import { fechaLargaPost, getPostsPublicados } from "@/lib/hotel-blog";
import {
  COLOR_DEFAULT,
  fontStack,
  inkFor,
  resolverPaginas,
  type MiniExtras,
} from "@/lib/mini";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

export const revalidate = 3600;

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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) return { title: "Blog no encontrado" };
  const title = `Blog · ${hotel.nombre}`;
  const description = `Guías y recomendaciones de ${hotel.nombre} para planear tu viaje.`;
  return {
    title,
    description,
    alternates: { canonical: `/h/${slug}/blog` },
    openGraph: { title, description, type: "website", locale: "es_MX" },
  };
}

export default async function BlogHotelIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) notFound();
  const posts = await getPostsPublicados(hotel.id);
  if (posts.length === 0) notFound();

  const extras = hotel.extras ?? {};
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;

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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1
          className="text-2xl sm:text-3xl font-extrabold tracking-tight"
          style={{ color: "var(--brand)" }}
        >
          Blog de {hotel.nombre}
        </h1>
        <div className="mt-6 space-y-4">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/h/${hotel.slug}/blog/${p.slug}`}
              className="block rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {p.portada && (
                <HotelImage
                  src={p.portada}
                  alt={p.titulo}
                  className="w-full h-44 sm:h-52"
                  sizes="(max-width: 640px) 100vw, 640px"
                />
              )}
              <div className="p-5">
                <p className="text-xs text-kora-muted">{fechaLargaPost(p.publicado_at)}</p>
                <h2 className="mt-1 text-lg font-bold text-kora-text leading-snug">{p.titulo}</h2>
                {p.excerpt && (
                  <p className="mt-1.5 text-sm text-kora-muted leading-relaxed">{p.excerpt}</p>
                )}
                <span className="mt-2 inline-block text-sm font-semibold" style={{ color: "var(--brand)" }}>
                  Leer artículo →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
