// Utilidades de SEO compartidas.

// Recorta un texto para meta description sin cortar palabras a la mitad.
// Si cabe entero, lo deja tal cual; si no, corta en el último espacio antes del
// límite y añade una elipsis. Evita snippets rotos en Google (bug de .slice(0, 155)).
export function metaDescripcion(texto: string, max = 158): string {
  const t = (texto ?? "").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(" ");
  const base = ultimoEspacio > 40 ? corte.slice(0, ultimoEspacio) : corte;
  return base.replace(/[\s.,;:–—-]+$/, "") + "…";
}
