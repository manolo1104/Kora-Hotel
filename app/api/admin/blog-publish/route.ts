import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { pingIndexNow } from "@/lib/indexnow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Publica o despublica un post del blog del hotel. Los borradores se guardan
// directo desde el cliente con RLS (patrón del editor visual); publicar pasa
// por aquí porque además hay que revalidar las páginas públicas (tienen
// revalidate de 1 h) y avisarle a IndexNow que hay URL nueva.

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  if (!adminEnvReady) {
    return NextResponse.json({ error: "Configuración incompleta." }, { status: 503 });
  }

  let body: { postId?: string; publicado?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const postId = String(body.postId ?? "").trim();
  const publicado = body.publicado === true;
  if (!postId) return NextResponse.json({ error: "Falta el artículo." }, { status: 400 });

  const admin = createAdminClient();
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
    // Mejor-esfuerzo: no bloquea la respuesta si IndexNow anda lento.
    void pingIndexNow([`/h/${slugHotel}/blog/${data.slug}`, `/h/${slugHotel}/blog`]);
  }

  return NextResponse.json({ ok: true, publicado });
}
