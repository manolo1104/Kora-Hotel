"use client";

// El blog del hotel, para dueños sin nada de técnica: lista de artículos,
// editor de un post (título, portada, texto en formato simple) y la tarjeta
// "Escríbelo con IA" (da el tema → la IA redacta → él revisa → publica).
//
// Borradores: se guardan directo a Supabase con la sesión del hotelero (RLS),
// igual que el editor visual. Publicar pasa por /api/admin/blog-publish, que
// además revalida las páginas públicas y avisa a IndexNow.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/images-client";
import {
  fechaLargaPost,
  renderPostHtml,
  slugificarPost,
  type HotelBlogPost,
} from "@/lib/hotel-blog";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-kora-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-kora-primary/30 focus:border-kora-primary transition";
const labelCls = "block text-xs font-semibold text-kora-muted mb-1";
const ayudaCls = "mt-1 text-[11px] text-kora-muted leading-snug";

export function BlogHotel({
  hotelId,
  hotelSlug,
  userId,
}: {
  hotelId: string;
  hotelSlug: string;
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<HotelBlogPost[] | null>(null);
  const [abierto, setAbierto] = useState<HotelBlogPost | null>(null); // post en edición
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("hotel_blog_posts")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false });
    if (err) setError("No se pudieron cargar tus artículos. Recarga la página.");
    setPosts((data as HotelBlogPost[] | null) ?? []);
  }, [supabase, hotelId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function nuevoPost() {
    setError("");
    const { data, error: err } = await supabase
      .from("hotel_blog_posts")
      .insert({
        hotel_id: hotelId,
        titulo: "",
        slug: `articulo-${Date.now().toString(36)}`,
        contenido: "",
      })
      .select("*")
      .single();
    if (err || !data) {
      setError(
        "No se pudo crear el artículo. Si es la primera vez, avisa a soporte: puede faltar preparar la base."
      );
      return;
    }
    const post = data as HotelBlogPost;
    setPosts((ps) => [post, ...(ps ?? [])]);
    setAbierto(post);
  }

  return (
    <main className="pt-16">
      <section className="py-12 sm:py-16 bg-kora-bg min-h-[70vh]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href={`/panel/${hotelSlug}/sitio`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text transition-colors"
          >
            <ArrowLeft size={15} /> Editar sitio
          </Link>
          <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                Blog de tu hotel
              </h1>
              <p className="mt-1 text-sm text-kora-muted max-w-lg">
                Cada artículo es una puerta más por la que te encuentran en Google. Escríbelo tú o
                pídeselo a la IA, revísalo y publícalo: se indexa solo.
              </p>
            </div>
            {!abierto && (
              <button
                type="button"
                onClick={nuevoPost}
                className="btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-sm hover:bg-kora-primary-dark transition-colors"
              >
                <Plus size={16} /> Nuevo artículo
              </button>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
              {error}
            </p>
          )}

          {abierto ? (
            <EditorPost
              key={abierto.id}
              inicial={abierto}
              hotelSlug={hotelSlug}
              userId={userId}
              onCerrar={(refrescar) => {
                setAbierto(null);
                if (refrescar) void cargar();
              }}
            />
          ) : (
            <ListaPosts posts={posts} hotelSlug={hotelSlug} onAbrir={setAbierto} />
          )}
        </div>
      </section>
    </main>
  );
}

function ListaPosts({
  posts,
  hotelSlug,
  onAbrir,
}: {
  posts: HotelBlogPost[] | null;
  hotelSlug: string;
  onAbrir: (p: HotelBlogPost) => void;
}) {
  if (posts === null) {
    return (
      <p className="mt-8 inline-flex items-center gap-2 text-sm text-kora-muted">
        <Loader2 size={15} className="animate-spin" /> Cargando tus artículos…
      </p>
    );
  }
  if (posts.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-kora-text">Todavía no tienes artículos.</p>
        <p className="mt-1 text-sm text-kora-muted max-w-md mx-auto">
          Ideas que funcionan: “Qué hacer en tu pueblo en 2 días”, “Cuándo es la mejor época para
          visitar”, “5 platillos que tienes que probar”.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-2">
      {posts.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onAbrir(p)}
          className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-kora-accent transition-colors"
        >
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-kora-text">
              {p.titulo.trim() || "Sin título"}
            </span>
            {p.publicado ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Publicado
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Borrador
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs text-kora-muted">
            {p.publicado && p.publicado_at
              ? `Publicado el ${fechaLargaPost(p.publicado_at)} · /h/${hotelSlug}/blog/${p.slug}`
              : "Solo tú lo ves"}
          </span>
        </button>
      ))}
    </div>
  );
}

function EditorPost({
  inicial,
  hotelSlug,
  userId,
  onCerrar,
}: {
  inicial: HotelBlogPost;
  hotelSlug: string;
  userId: string;
  onCerrar: (refrescar: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [post, setPost] = useState<HotelBlogPost>(inicial);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");

  // IA
  const [tema, setTema] = useState("");
  const [notas, setNotas] = useState("");
  const [generando, setGenerando] = useState(false);

  const set = (cambios: Partial<HotelBlogPost>) => {
    setPost((p) => ({ ...p, ...cambios }));
    setSucio(true);
  };

  async function guardar(): Promise<HotelBlogPost | null> {
    setGuardando(true);
    setError("");
    try {
      const titulo = post.titulo.trim();
      // El slug se fija con el primer título guardado y ya no cambia una vez
      // publicado (la URL es SEO). Antes de publicar, sigue al título.
      const slug =
        !post.publicado && titulo ? slugificarPost(titulo) || post.slug : post.slug;
      const { data, error: err } = await supabase
        .from("hotel_blog_posts")
        .update({
          titulo,
          slug,
          excerpt: post.excerpt.trim(),
          portada: post.portada,
          contenido: post.contenido,
        })
        .eq("id", post.id)
        .select("*")
        .single();
      if (err || !data) {
        setError(
          err?.code === "23505"
            ? "Ya tienes un artículo con ese título. Cámbialo un poco."
            : "No se pudo guardar. Inténtalo de nuevo."
        );
        return null;
      }
      const fresco = data as HotelBlogPost;
      setPost(fresco);
      setSucio(false);
      return fresco;
    } finally {
      setGuardando(false);
    }
  }

  async function publicar(publicado: boolean) {
    setError("");
    if (publicado) {
      if (!post.titulo.trim()) {
        setError("Ponle un título antes de publicar.");
        return;
      }
      if (!post.contenido.trim()) {
        setError("El artículo está vacío.");
        return;
      }
    }
    const guardadoOk = sucio ? await guardar() : post;
    if (!guardadoOk) return;
    setPublicando(true);
    try {
      const res = await fetch("/api/admin/blog-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, publicado }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo publicar. Inténtalo de nuevo.");
        return;
      }
      setPost((p) => ({
        ...p,
        publicado,
        publicado_at: publicado ? new Date().toISOString() : p.publicado_at,
      }));
    } catch {
      setError("No se pudo conectar. Revisa tu internet.");
    } finally {
      setPublicando(false);
    }
  }

  async function eliminar() {
    setError("");
    const { error: err } = await supabase.from("hotel_blog_posts").delete().eq("id", post.id);
    if (err) {
      setError("No se pudo eliminar.");
      return;
    }
    onCerrar(true);
  }

  async function subirPortada(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setError("");
    try {
      const file = files[0];
      const blob = await comprimirImagen(file);
      const esWebp = blob !== file && blob.type === "image/webp";
      const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
      const ext = esWebp ? "webp" : (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
      const rnd = Math.random().toString(36).slice(2, 6);
      const path = `${userId}/${Date.now()}-${rnd}-${base}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos").upload(path, blob, {
        upsert: false,
        contentType: esWebp ? "image/webp" : file.type || undefined,
      });
      if (upErr) {
        setError("No se pudo subir la foto. Inténtalo de nuevo.");
        return;
      }
      const { data } = supabase.storage.from("fotos").getPublicUrl(path);
      set({ portada: data.publicUrl });
    } finally {
      setSubiendo(false);
    }
  }

  async function escribirConIA() {
    if (generando) return;
    if (!tema.trim()) {
      setError("Dile a la IA el tema del artículo (ej. Qué hacer en Xilitla en 2 días).");
      return;
    }
    setGenerando(true);
    setError("");
    try {
      const res = await fetch("/api/admin/blog-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema, notas }),
      });
      const data = (await res.json()) as {
        titulo?: string;
        excerpt?: string;
        contenido?: string;
        error?: string;
      };
      if (!res.ok || !data.titulo || !data.contenido) {
        setError(
          res.status === 401
            ? "Tu sesión se venció. Vuelve a entrar."
            : data.error || "No se pudo escribir el artículo. Inténtalo de nuevo."
        );
        return;
      }
      set({ titulo: data.titulo, excerpt: data.excerpt ?? "", contenido: data.contenido });
    } catch {
      setError("No se pudo conectar con la IA. Revisa tu internet.");
    } finally {
      setGenerando(false);
    }
  }

  const previewHtml = useMemo(() => renderPostHtml(post.contenido), [post.contenido]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onCerrar(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text"
        >
          <X size={15} /> Cerrar
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {post.publicado && (
            <a
              href={`/h/${hotelSlug}/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-kora-primary hover:underline"
            >
              <Globe size={13} /> Ver publicado
            </a>
          )}
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando || !sucio}
            className={`btn-press px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
              sucio
                ? "border-kora-primary text-kora-primary hover:bg-kora-primary/5"
                : "border-gray-200 text-gray-400"
            }`}
          >
            {guardando ? "Guardando…" : sucio ? "Guardar" : "Guardado"}
          </button>
          <button
            type="button"
            onClick={() => void publicar(!post.publicado)}
            disabled={publicando}
            className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full bg-kora-primary text-white text-sm font-semibold hover:bg-kora-primary-dark transition-colors"
          >
            {publicando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : post.publicado ? (
              <EyeOff size={14} />
            ) : (
              <Eye size={14} />
            )}
            {publicando ? "Un momento…" : post.publicado ? "Despublicar" : "Publicar"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </p>
      )}

      {/* Escríbelo con IA */}
      <div className="rounded-2xl border border-kora-primary/30 bg-kora-primary/5 p-4 space-y-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-kora-primary">
          <Sparkles size={15} /> Escríbelo con IA
        </p>
        <div>
          <label className={labelCls}>¿Sobre qué es el artículo?</label>
          <input
            className={inputCls}
            value={tema}
            placeholder="Qué hacer en Xilitla en 2 días"
            onChange={(e) => setTema(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Algo que quieras que incluya (opcional)</label>
          <input
            className={inputCls}
            value={notas}
            placeholder="Que mencione el desayuno con café de la región"
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => void escribirConIA()}
          disabled={generando}
          className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full bg-kora-primary text-white text-sm font-semibold hover:bg-kora-primary-dark transition-colors"
        >
          {generando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generando ? "Escribiendo (tarda unos 30 s)…" : "Escribir el artículo"}
        </button>
        <p className={ayudaCls}>
          La IA usa los datos reales de tu hotel y no inventa precios ni servicios. Tú siempre lo
          revisas antes de publicar{post.contenido.trim() ? "; ojo: reemplaza lo que ya haya escrito" : ""}.
        </p>
      </div>

      {/* Campos del artículo */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <label className={labelCls}>Título</label>
          <input
            className={inputCls}
            value={post.titulo}
            placeholder="Qué hacer en Xilitla en 2 días"
            onChange={(e) => set({ titulo: e.target.value })}
          />
          {!post.publicado && post.titulo.trim() && (
            <p className={ayudaCls}>
              Su dirección será /h/{hotelSlug}/blog/<b>{slugificarPost(post.titulo)}</b>
            </p>
          )}
        </div>

        <div>
          <label className={labelCls}>Resumen (sale en Google, opcional)</label>
          <input
            className={inputCls}
            value={post.excerpt}
            maxLength={200}
            placeholder="Una o dos frases que resumen el artículo."
            onChange={(e) => set({ excerpt: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>Foto de portada (opcional)</label>
          <div className="flex items-center gap-3">
            {post.portada && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.portada}
                alt=""
                className="w-24 h-16 object-cover rounded-lg border border-gray-200"
              />
            )}
            <label className="btn-press inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-kora-text cursor-pointer hover:border-kora-accent transition-colors">
              {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {subiendo ? "Subiendo…" : post.portada ? "Cambiar foto" : "Subir foto"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void subirPortada(e.target.files)}
              />
            </label>
            {post.portada && (
              <button
                type="button"
                onClick={() => set({ portada: null })}
                className="text-xs font-semibold text-kora-muted hover:text-red-600"
              >
                Quitar
              </button>
            )}
          </div>
        </div>

        <div>
          <label className={labelCls}>Artículo</label>
          <textarea
            className={`${inputCls} min-h-[320px] font-mono text-[13px]`}
            value={post.contenido}
            placeholder={"Escribe aquí. Formato:\n\n## Un subtítulo\n\nUn párrafo normal. Deja una línea en blanco entre párrafos.\n\n- Una lista\n- Con guiones\n\n**negritas** con asteriscos"}
            onChange={(e) => set({ contenido: e.target.value })}
          />
          <p className={ayudaCls}>
            Formato: “## ” para subtítulos, “- ” para listas, **negritas** entre asteriscos y una
            línea en blanco entre párrafos. Abajo lo ves como quedará.
          </p>
        </div>

        <div className="flex justify-end">
          {borrando ? (
            <button
              type="button"
              onClick={() => void eliminar()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600"
            >
              <Trash2 size={13} /> ¿Seguro? Se elimina para siempre
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setBorrando(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
            >
              <Trash2 size={13} /> Eliminar artículo
            </button>
          )}
        </div>
      </div>

      {/* Vista previa */}
      {post.contenido.trim() && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-kora-muted mb-3">
            Así se verá
          </p>
          <h2 className="text-xl font-bold text-kora-text mb-3">
            {post.titulo.trim() || "Sin título"}
          </h2>
          <div
            className="post-hotel text-sm text-kora-text leading-relaxed space-y-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      )}
    </div>
  );
}
