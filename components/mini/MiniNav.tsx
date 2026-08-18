// Barra de navegación del sitio del hotel: Inicio · páginas propias · Blog.
// Solo se dibuja si hay algo a dónde ir (páginas o blog): un hotel que nunca
// creó páginas ve su sitio EXACTAMENTE igual que antes.
//
// Misma regla que MiniRender: nada de fetch ni env vars; datos puros por props.
// En el editor (preview) los tabs no navegan: avisan con onNav para que el
// editor cambie de página sin salir.

import Link from "next/link";

export interface MiniNavDatos {
  paginas: { slug: string; titulo: string }[];
  blog: boolean;
  /** slug de la página activa; "blog" en el blog; null/undefined = Inicio */
  activo?: string | null;
}

export function MiniNav({
  slugHotel,
  nav,
  preview,
  onNav,
}: {
  slugHotel: string;
  nav: MiniNavDatos;
  preview?: boolean;
  onNav?: (slugPagina: string | null) => void;
}) {
  if (nav.paginas.length === 0 && !nav.blog) return null;

  const tabs: { slug: string | null; titulo: string; href: string }[] = [
    { slug: null, titulo: "Inicio", href: `/h/${slugHotel}` },
    ...nav.paginas.map((p) => ({
      slug: p.slug,
      titulo: p.titulo,
      href: `/h/${slugHotel}/${p.slug}`,
    })),
    ...(nav.blog ? [{ slug: "blog", titulo: "Blog", href: `/h/${slugHotel}/blog` }] : []),
  ];

  return (
    <nav
      aria-label="Secciones del sitio"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200"
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const activo = (nav.activo ?? null) === t.slug;
          const cls = `flex-shrink-0 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activo ? "" : "border-transparent text-kora-muted hover:text-kora-text"
          }`;
          const style: React.CSSProperties = activo
            ? { color: "var(--brand)", borderColor: "var(--brand)" }
            : {};
          if (preview) {
            return (
              <button
                key={t.slug ?? "inicio"}
                type="button"
                onClick={() => onNav?.(t.slug)}
                className={cls}
                style={style}
              >
                {t.titulo}
              </button>
            );
          }
          return (
            <Link key={t.slug ?? "inicio"} href={t.href} className={cls} style={style}>
              {t.titulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
