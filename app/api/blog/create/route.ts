import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { articles as staticArticles, calculateReadTime } from "@/lib/articles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── API del agente de blogs (blog-agent/) ────────────────────────────────────
// POST  → publica (upsert por slug) un artículo generado en blog_articles.
// GET   → lista slugs + topic_ids publicados (dedup y links internos del agente).
// DELETE→ borra un artículo por slug.
// Auth: Authorization: Bearer $BLOG_AGENT_SECRET (mismo patrón que los crons).

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.BLOG_AGENT_SECRET ?? "";
  return Boolean(secreto) && req.headers.get("authorization") === `Bearer ${secreto}`;
}

export async function POST(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const {
      slug, title, excerpt = "", category = "Gestión hotelera",
      tags = [], image, imageAlt = "", content,
      metaTitle, metaDescription, focusKeyword, secondaryKeywords = [],
      topicId = null,
    } = body;

    if (!slug || !title || !content) {
      return NextResponse.json(
        { error: "slug, title y content son requeridos." },
        { status: 400 }
      );
    }
    // La portada es obligatoria: cada artículo tiene la suya en
    // /blog/portadas/ (ver scripts/portadas-blog/). Antes había un default a
    // una foto genérica y por eso 13 de 17 artículos acabaron con la misma.
    if (!image) {
      return NextResponse.json(
        { error: "image es requerido: el artículo necesita su portada propia." },
        { status: 400 }
      );
    }
    // Los artículos estáticos de lib/articles.ts tienen prioridad: no permitir
    // que el agente los pise desde la BD.
    if (staticArticles.some((a) => a.slug === slug)) {
      return NextResponse.json(
        { error: `El slug "${slug}" pertenece a un artículo estático.` },
        { status: 409 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blog_articles")
      .upsert(
        {
          slug,
          title,
          excerpt,
          category,
          tags,
          image,
          image_alt: imageAlt,
          content,
          meta_title: metaTitle ?? null,
          meta_description: metaDescription ?? null,
          focus_keyword: focusKeyword ?? null,
          secondary_keywords: secondaryKeywords,
          read_time: calculateReadTime(content),
          topic_id: topicId,
          published: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id, slug, title")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json({ success: true, post: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("Blog API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("blog_articles")
      .select("slug, title, topic_id, published_at, focus_keyword")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Incluye los estáticos para que el agente pueda enlazarlos y no duplicar temas.
    const estaticos = staticArticles.map((a) => ({
      slug: a.slug,
      title: a.title,
      topic_id: null,
      published_at: a.publishedIso,
      focus_keyword: null,
    }));

    return NextResponse.json({ posts: [...(data ?? []), ...estaticos] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  }

  try {
    const { slug } = await req.json();
    if (!slug) {
      return NextResponse.json({ error: "slug requerido." }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { error, count } = await supabase
      .from("blog_articles")
      .delete({ count: "exact" })
      .eq("slug", slug);
    if (error) throw new Error(error.message);
    if (!count) {
      return NextResponse.json({ error: `Post no encontrado: ${slug}` }, { status: 404 });
    }

    revalidatePath("/blog");
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ success: true, deleted: slug });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
