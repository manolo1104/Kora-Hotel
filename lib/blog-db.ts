import { createClient } from "@supabase/supabase-js";
import { articles as staticArticles, type Article } from "@/lib/articles";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

// ── Fuente unificada del blog ────────────────────────────────────────────────
// Los 5 artículos originales viven en lib/articles.ts (estáticos); los que
// genera el agente (blog-agent/) viven en la tabla blog_articles de Supabase.
// Estos helpers fusionan ambas fuentes. Solo servidor (Server Components,
// sitemap, route handlers). Si Supabase no está configurado o falla, el blog
// sigue funcionando con los estáticos.

interface BlogRow {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  category: string;
  tags: string[];
  image: string;
  image_alt: string;
  content: string;
  read_time: string;
  published_at: string;
  updated_at: string | null;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaLarga(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

function rowToArticle(row: BlogRow): Article {
  const publishedIso = row.published_at.slice(0, 10);
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    author: row.author,
    date: fechaLarga(publishedIso),
    publishedIso,
    readTime: row.read_time,
    category: row.category,
    tags: row.tags ?? [],
    image: row.image,
    imageAlt: row.image_alt,
    content: row.content,
  };
}

async function fetchDbArticles(): Promise<Article[]> {
  if (!supabaseEnvReady) return [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase
      .from("blog_articles")
      .select(
        "slug, title, excerpt, author, category, tags, image, image_alt, content, read_time, published_at, updated_at"
      )
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (error || !data) return [];
    return (data as BlogRow[]).map(rowToArticle);
  } catch {
    return [];
  }
}

/** Todos los artículos (BD + estáticos), sin duplicados, más recientes primero. */
export async function getAllArticles(): Promise<Article[]> {
  const dbArticles = await fetchDbArticles();
  const staticSlugs = new Set(staticArticles.map((a) => a.slug));
  const merged = [
    ...staticArticles,
    ...dbArticles.filter((a) => !staticSlugs.has(a.slug)),
  ];
  return merged.sort((a, b) => (a.publishedIso < b.publishedIso ? 1 : -1));
}

/** Un artículo por slug: primero estáticos, luego BD. */
export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  const estatico = staticArticles.find((a) => a.slug === slug);
  if (estatico) return estatico;
  const dbArticles = await fetchDbArticles();
  return dbArticles.find((a) => a.slug === slug);
}
