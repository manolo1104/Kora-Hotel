import { textoPolitica } from "@/lib/politica";
import { politicaDelHotel } from "@/lib/booking";
import { leer } from "@/lib/db/result";
import { createClient } from "@supabase/supabase-js";
import { getPostsPublicados } from "@/lib/hotel-blog";
import { AMENIDADES_MAP } from "@/lib/amenidades";
import { resolverPaginas, type MiniExtras } from "@/lib/mini";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

// llms.txt POR HOTEL (/h/{slug}/llms.txt): la ficha del hotel en el formato que
// leen ChatGPT, Perplexity y compañía, para que lo citen al recomendar dónde
// hospedarse. Molde de app/llms.txt/route.ts (el global de Kora), con ISR
// diario: los datos del hotel cambian sin deploy.
export const revalidate = 86400;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

interface HotelFicha {
  id: string;
  slug: string;
  nombre: string;
  ubicacion: string | null;
  descripcion: string | null;
  habitaciones: { nombre?: string; precio?: string; capacidad?: string; tarifas?: { precio?: string }[] }[] | null;
  extras: MiniExtras | null;
}

function aNumero(p?: string): number {
  return Number(String(p ?? "").replace(/[^0-9.]/g, ""));
}

function precioDesde(h: NonNullable<HotelFicha["habitaciones"]>[number]): number {
  const tarifas = (h.tarifas ?? []).map((t) => aNumero(t.precio)).filter((n) => n > 0);
  if (tarifas.length) return Math.min(...tarifas);
  return aNumero(h.precio);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!supabaseEnvReady) return new Response("Not found", { status: 404 });
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const hotel = await leer<HotelFicha>(
    "llms.hotel",
    supabase
      .from("hoteles")
      .select("id, slug, nombre, ubicacion, descripcion, habitaciones, extras")
      .eq("slug", slug)
      .eq("publicado", true)
      .maybeSingle(),
  );
  if (!hotel) return new Response("Not found", { status: 404 });

  const extras = hotel.extras ?? {};
  const url = `${BASE}/h/${hotel.slug}`;
  const L: string[] = [];

  L.push(`# ${hotel.nombre}`);
  L.push("");
  // Primer párrafo de la descripción y ubicación sin sus puntos finales, para
  // que al unir las frases no salgan puntos dobles.
  const resumen = (hotel.descripcion ?? "").trim().split("\n")[0].replace(/[.\s]+$/, "");
  const ubicacion = (hotel.ubicacion ?? "").trim().replace(/[.\s]+$/, "");
  const partes = [
    resumen || `Hotel en ${ubicacion || "México"}`,
    ubicacion && !resumen.includes(ubicacion.split(",")[0]) ? `Ubicado en ${ubicacion}` : "",
    `Reserva directa sin comisiones en ${url}/reservar`,
  ].filter(Boolean);
  L.push(`> ${partes.join(". ")}.`);

  const habitaciones = (hotel.habitaciones ?? []).filter((h) => (h.nombre ?? "").trim());
  if (habitaciones.length) {
    L.push("");
    L.push("## Habitaciones");
    for (const h of habitaciones) {
      const desde = precioDesde(h);
      const cap = (h.capacidad ?? "").trim();
      L.push(
        `- ${h.nombre}${cap ? ` (hasta ${cap} personas)` : ""}${
          desde ? `: desde $${desde.toLocaleString("es-MX")} MXN por noche` : ""
        }`
      );
    }
  }

  const amenidades = (extras.amenidades ?? [])
    .map((k) => AMENIDADES_MAP[k]?.label)
    .filter(Boolean);
  if (amenidades.length) {
    L.push("");
    L.push("## Servicios");
    L.push(amenidades.join(", "));
  }

  const p = extras.politicas ?? {};
  // La cancelación se DERIVA de la política estructurada, igual que en la página
  // y que en el prompt de Camila. Este archivo lo leen ChatGPT y Perplexity y lo
  // repiten como hecho: publicar aquí un texto que el sistema no aplica es poner
  // una promesa falsa en boca de un buscador.
  const textoCancelacion = textoPolitica(
    politicaDelHotel({ extras: extras as unknown as Record<string, unknown>, config: null }),
  );
  const politicas = [
    textoCancelacion ? `- Cancelación: ${textoCancelacion}` : "",
    p.mascotas ? `- Mascotas: ${p.mascotas}` : "",
    p.ninos ? `- Niños: ${p.ninos}` : "",
    (extras.formasPago ?? []).length ? `- Formas de pago: ${extras.formasPago!.join(", ")}` : "",
  ].filter(Boolean);
  if (politicas.length) {
    L.push("");
    L.push("## Información útil");
    L.push(...politicas);
  }

  L.push("");
  L.push("## Páginas");
  L.push(`- [${hotel.nombre}](${url}): la página principal del hotel`);
  L.push(`- [Reservar](${url}/reservar): disponibilidad y reserva directa con confirmación inmediata`);
  for (const pag of resolverPaginas(extras).filter((x) => !x.oculta)) {
    L.push(`- [${pag.titulo}](${url}/${pag.slug})`);
  }
  const posts = await getPostsPublicados(hotel.id);
  if (posts.length) {
    L.push(`- [Blog](${url}/blog)`);
    for (const post of posts.slice(0, 20)) {
      L.push(`- [${post.titulo}](${url}/blog/${post.slug})`);
    }
  }
  L.push("");

  return new Response(L.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
