// Utilidades de SEO compartidas.

// Slugs de hoteles de PRUEBA/semilla que no deben aparecer en sitemap, llms.txt
// ni directorios públicos (no son clientes reales). El fix de fondo es
// despublicarlos en Supabase; esto los excluye como parche.
export const TENANTS_PRUEBA = new Set([
  "hotel-1",
  "hotel-grande",
  "hotel-corazon-lleno",
  "hotel-5-encantos",
  "hotel-demo-huasteca",
  // `hotel-magico` SALIÓ de esta lista: es el Hotel Paraíso Encantado real y
  // publicado (el del caso de estudio), no una semilla. El slug feo lo hacía
  // parecer prueba y lo tenía fuera del sitemap y del llms.txt.
  "manolo",
  "paraiso-encantadfi",
]);

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
