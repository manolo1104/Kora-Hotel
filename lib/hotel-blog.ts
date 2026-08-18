// Blog por hotel: tipos, consultas públicas y el render del contenido.
//
// El contenido de un post es MARKDOWN MÍNIMO (párrafos separados por línea en
// blanco, "## Subtítulo", "### Subtítulo chico", listas con "- ", **negritas**
// / *cursivas*, y fotos en su propia línea con ![descripción](url)).
// renderPostHtml() lo convierte a HTML emitiendo SOLO esas etiquetas y
// escapando todo lo demás: XSS imposible por construcción, sin librería de
// sanitizado. Las imágenes solo se emiten si la URL es del Storage del
// proyecto (el botón "Insertar foto" del panel sube ahí). La IA del panel
// devuelve este mismo formato, así que lo generado y lo escrito a mano se
// editan igual.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

// Artículos con IA por hotel por mes (el costo real por artículo con
// investigación web es de centavos; esto acota el peor caso).
export const LIMITE_IA_MENSUAL = 2;

export interface HotelBlogPost {
  id: string;
  hotel_id: string;
  slug: string;
  titulo: string;
  excerpt: string;
  portada: string | null;
  contenido: string;
  publicado: boolean;
  publicado_at: string | null;
  created_at: string;
  updated_at: string;
}

const COLS =
  "id, hotel_id, slug, titulo, excerpt, portada, contenido, publicado, publicado_at, created_at, updated_at";

// ─── Consultas públicas (anon, RLS deja pasar solo lo publicado) ─────────────

export async function getPostsPublicados(hotelId: string): Promise<HotelBlogPost[]> {
  if (!supabaseEnvReady) return [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabase
      .from("hotel_blog_posts")
      .select(COLS)
      .eq("hotel_id", hotelId)
      .eq("publicado", true)
      .order("publicado_at", { ascending: false });
    return (data as HotelBlogPost[] | null) ?? [];
  } catch {
    return [];
  }
}

export async function getPostPublicado(
  hotelId: string,
  slug: string
): Promise<HotelBlogPost | null> {
  if (!supabaseEnvReady) return null;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabase
      .from("hotel_blog_posts")
      .select(COLS)
      .eq("hotel_id", hotelId)
      .eq("slug", slug)
      .eq("publicado", true)
      .maybeSingle();
    return (data as HotelBlogPost | null) ?? null;
  } catch {
    return null;
  }
}

// ¿El hotel tiene blog que mostrar? (prende el tab Blog de la navegación).
export async function tienePostsPublicados(hotelId: string): Promise<boolean> {
  if (!supabaseEnvReady) return false;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { count } = await supabase
      .from("hotel_blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("publicado", true);
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ─── Formato ─────────────────────────────────────────────────────────────────

// "Zacahuil: el tamal gigante" → "zacahuil-el-tamal-gigante"
export function slugificarPost(titulo: string): string {
  return titulo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Negritas y cursivas sobre texto YA escapado.
function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// ¿La URL puede ir en un <img> del post? Solo el Storage público del proyecto:
// nunca se emite un <img> a un dominio arbitrario escrito en el textarea.
function urlDeImagenPermitida(url: string): boolean {
  if (!SUPABASE_URL) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === new URL(SUPABASE_URL).host;
  } catch {
    return false;
  }
}

export function renderPostHtml(md: string): string {
  const lineas = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let parrafo: string[] = [];
  let enLista = false;

  const cerrarParrafo = () => {
    if (parrafo.length) {
      html.push(`<p>${inline(parrafo.join("<br/>"))}</p>`);
      parrafo = [];
    }
  };
  const cerrarLista = () => {
    if (enLista) {
      html.push("</ul>");
      enLista = false;
    }
  };

  for (const cruda of lineas) {
    // Foto en su propia línea: ![descripción](url). Se valida la URL cruda y
    // se escapa todo lo que acaba dentro del tag.
    const foto = cruda.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (foto && urlDeImagenPermitida(foto[2])) {
      cerrarParrafo();
      cerrarLista();
      html.push(
        `<img src="${escapeHtml(foto[2])}" alt="${escapeHtml(foto[1])}" loading="lazy" />`
      );
      continue;
    }
    const linea = escapeHtml(cruda.trim());
    if (!linea) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    if (linea.startsWith("### ")) {
      cerrarParrafo();
      cerrarLista();
      html.push(`<h3>${inline(linea.slice(4))}</h3>`);
      continue;
    }
    if (linea.startsWith("## ")) {
      cerrarParrafo();
      cerrarLista();
      html.push(`<h2>${inline(linea.slice(3))}</h2>`);
      continue;
    }
    if (linea.startsWith("- ")) {
      cerrarParrafo();
      if (!enLista) {
        html.push("<ul>");
        enLista = true;
      }
      html.push(`<li>${inline(linea.slice(2))}</li>`);
      continue;
    }
    parrafo.push(linea);
  }
  cerrarParrafo();
  cerrarLista();
  return html.join("\n");
}

// "2026-08-17T..." → "17 de agosto, 2026"
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export function fechaLargaPost(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}
