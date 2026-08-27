import { leer } from "@/lib/db/result";
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getAllArticles } from "@/lib/blog-db";
import { herramientasDisponibles } from "@/lib/herramientas";
import { glosario } from "@/lib/glosario";
import { comparativas } from "@/lib/comparativas";
import { personas } from "@/lib/personas";
import { ciudades } from "@/lib/ciudades";
import { AYUDA } from "@/lib/ayuda";
import { resolverPaginas, type MiniExtras } from "@/lib/mini";
import { TENANTS_PRUEBA } from "@/lib/seo";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// Fecha estable de última actualización (no usar new Date() por entrada: cambiaría
// en cada build y le manda a Google señales falsas de "página modificada").
const SITE_UPDATED = new Date("2026-06-03");

// Mini-páginas de hoteles publicadas (/h/slug) + la página propia de cada
// habitación (/h/slug/habitacion/idx). Si el env de Supabase no está listo o
// falla, devuelve [] para no romper el sitemap.
async function miniPaginas(): Promise<MetadataRoute.Sitemap> {
  if (!supabaseEnvReady) return [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const data = await leer<Array<{ slug: string; updated_at: string | null; habitaciones: unknown; extras: unknown }>>(
      "sitemap.hoteles",
      supabase.from("hoteles").select("slug, updated_at, habitaciones, extras").eq("publicado", true),
    );
    if (!data) return [];
    return data
      .filter((h) => h.slug && !TENANTS_PRUEBA.has(h.slug))
      .flatMap((h) => {
        const lastModified = h.updated_at ? new Date(h.updated_at) : SITE_UPDATED;
        const hotel: MetadataRoute.Sitemap = [
          {
            url: `${BASE_URL}/h/${h.slug}`,
            lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.6,
          },
        ];
        const habitaciones: { nombre?: string }[] = Array.isArray(h.habitaciones)
          ? h.habitaciones
          : [];
        const cuartos: MetadataRoute.Sitemap = habitaciones
          .map((room, idx) => ({ room, idx }))
          .filter(({ room }) => (room?.nombre ?? "").trim())
          .map(({ idx }) => ({
            url: `${BASE_URL}/h/${h.slug}/habitacion/${idx}`,
            lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.5,
          }));
        const propias: MetadataRoute.Sitemap = resolverPaginas(
          (h.extras as MiniExtras | null) ?? undefined
        )
          .filter((p) => !p.oculta)
          .map((p) => ({
            url: `${BASE_URL}/h/${h.slug}/${p.slug}`,
            lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.5,
          }));
        return [...hotel, ...cuartos, ...propias];
      });
  } catch (e) {
    // Degradar a vacío es DELIBERADO (no romper la página por esto), pero
    // ya no en silencio: sin este log, un fallo aquí se publica como "no
    // hay contenido" y nadie lo nota hasta que el tráfico baja.
    console.error("[sitemap.hoteles]", e instanceof Error ? e.message : e);
    return [];
  }
}

// Blogs de los hoteles: /h/{slug}/blog (si hay ≥1 post) y cada post publicado.
async function blogsHoteles(): Promise<MetadataRoute.Sitemap> {
  if (!supabaseEnvReady) return [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const data = await leer<unknown[]>(
      "sitemap.blog",
      supabase
        .from("hotel_blog_posts")
        .select("slug, updated_at, publicado_at, hoteles:hotel_id (slug, publicado)")
        .eq("publicado", true),
    );
    if (!data) return [];
    const entradas: MetadataRoute.Sitemap = [];
    const indicesVistos = new Set<string>();
    for (const row of data as unknown as {
      slug: string;
      updated_at: string | null;
      publicado_at: string | null;
      hoteles: { slug: string; publicado: boolean } | null;
    }[]) {
      const h = row.hoteles;
      if (!h?.publicado || !h.slug || TENANTS_PRUEBA.has(h.slug)) continue;
      const lastModified = new Date(row.updated_at || row.publicado_at || SITE_UPDATED);
      if (!indicesVistos.has(h.slug)) {
        indicesVistos.add(h.slug);
        entradas.push({
          url: `${BASE_URL}/h/${h.slug}/blog`,
          lastModified,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
      entradas.push({
        url: `${BASE_URL}/h/${h.slug}/blog/${row.slug}`,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
    return entradas;
  } catch (e) {
    // Degradar a vacío es DELIBERADO (no romper la página por esto), pero
    // ya no en silencio: sin este log, un fallo aquí se publica como "no
    // hay contenido" y nadie lo nota hasta que el tráfico baja.
    console.error("[sitemap.blog]", e instanceof Error ? e.message : e);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hotelEntries = [...(await miniPaginas()), ...(await blogsHoteles())];
  // Estáticos (lib/articles.ts) + generados por el agente (blog_articles).
  const articles = await getAllArticles();
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${BASE_URL}/blog/${article.slug}`,
    lastModified: new Date(article.updatedIso || article.publishedIso),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const herramientaEntries: MetadataRoute.Sitemap = herramientasDisponibles.map(
    (h) => ({
      url: `${BASE_URL}/herramientas/${h.slug}`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    })
  );

  const glosarioEntries: MetadataRoute.Sitemap = glosario.map((t) => ({
    url: `${BASE_URL}/glosario/${t.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const comparativaEntries: MetadataRoute.Sitemap = comparativas.map((c) => ({
    url: `${BASE_URL}/comparativas/${c.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const personaEntries: MetadataRoute.Sitemap = personas.map((p) => ({
    url: `${BASE_URL}/para/${p.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const ayudaEntries: MetadataRoute.Sitemap = AYUDA.map((a) => ({
    url: `${BASE_URL}/ayuda/${a.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const ciudadEntries: MetadataRoute.Sitemap = ciudades.map((c) => ({
    url: `${BASE_URL}/hoteles-en/${c.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: SITE_UPDATED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/caracteristicas`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/precios`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/casos/paraiso-encantado`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/como-funciona`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: SITE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/herramientas`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      // La guía es el imán de toda la captación por correo y compite por la
      // búsqueda más valiosa del sitio: se indexa completa, sin candado.
      url: `${BASE_URL}/guia`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/herramientas/mini-pagina`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/glosario`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/comparativas`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/ayuda`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/hoteles-en`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...herramientaEntries,
    ...glosarioEntries,
    ...comparativaEntries,
    ...personaEntries,
    ...ciudadEntries,
    ...ayudaEntries,
    ...articleEntries,
    ...hotelEntries,
    {
      url: `${BASE_URL}/privacidad`,
      lastModified: SITE_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terminos`,
      lastModified: SITE_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
