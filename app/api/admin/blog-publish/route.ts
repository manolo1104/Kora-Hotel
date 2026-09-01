import { negar } from "@/lib/panel/permisos";
import { leer } from "@/lib/db/result";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { pingIndexNow } from "@/lib/indexnow";
import { zId } from "@/lib/api/cuerpo";
import { z } from "zod";
import { leerCuerpo } from "@/lib/api/cuerpo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Publica o despublica un post del blog del hotel. Los borradores se guardan
// directo desde el cliente con RLS (patrón del editor visual); publicar pasa
// por aquí porque además hay que revalidar las páginas públicas (tienen
// revalidate de 1 h) y avisarle a IndexNow que hay URL nueva.

const PUBLICAR_SCHEMA = z.object({
  postId: zId,
  publicado: z.boolean().default(false),
  revalidar: z.boolean().default(false),
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:editar");
  if (no) return no;
  if (!adminEnvReady) {
    return NextResponse.json({ error: "Configuración incompleta." }, { status: 503 });
  }

  const c = await leerCuerpo(req, PUBLICAR_SCHEMA);
  if (!c.ok) return c.respuesta;
  const body = c.datos;
  const postId = body.postId;
  const publicado = body.publicado;
  if (!postId) return NextResponse.json({ error: "Falta el artículo." }, { status: 400 });

  const admin = createAdminClient();

  // Modo "solo revalidar": al guardar cambios de un post YA publicado, las
  // páginas públicas (revalidate 1 h) se refrescan al momento sin tocar el
  // estado ni la fecha de publicación.
  if (body.revalidar) {
    const post = await leer<{ slug: string; publicado: boolean }>(
      "blog.postParaRevalidar",
      admin
        .from("hotel_blog_posts")
        .select("slug, publicado")
        .eq("id", postId)
        .eq("hotel_id", ctx.hotelId)
        .maybeSingle(),
    );
    if (!post) return NextResponse.json({ error: "No se encontró el artículo." }, { status: 404 });
    const slugHotel = ctx.hotel.slug;
    if (post.publicado) {
      revalidatePath(`/h/${slugHotel}/blog`);
      revalidatePath(`/h/${slugHotel}/blog/${post.slug}`);
    }
    return NextResponse.json({ ok: true, publicado: post.publicado });
  }
  // El hotel_id viene del tenant resuelto por sesión, nunca del body: un post
  // ajeno simplemente no coincide y el update no toca nada.
  const { data, error } = await admin
    .from("hotel_blog_posts")
    .update({
      publicado,
      // Cada publicación fija su fecha; al despublicar se conserva la última.
      ...(publicado ? { publicado_at: new Date().toISOString() } : {}),
    })
    .eq("id", postId)
    .eq("hotel_id", ctx.hotelId)
    .select("slug, publicado_at")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo actualizar el artículo." }, { status: 400 });
  }

  const slugHotel = ctx.hotel.slug;
  revalidatePath(`/h/${slugHotel}`);
  revalidatePath(`/h/${slugHotel}/blog`);
  revalidatePath(`/h/${slugHotel}/blog/${data.slug}`);
  revalidatePath("/sitemap.xml");
  if (publicado) {
    // CON await y tope de 3 s dentro de pingIndexNow: el `void` de antes hacía
    // que en Vercel el ping se cancelara al responder, así que las entradas
    // nuevas del blog no se avisaban a los buscadores casi nunca.
    await pingIndexNow([`/h/${slugHotel}/blog/${data.slug}`, `/h/${slugHotel}/blog`]);
  }

  return NextResponse.json({ ok: true, publicado });
}
