import type { Metadata } from "next";

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

// Título de pestaña con la marca al final, sólo si cabe en 60 caracteres (lo
// que Google enseña antes de cortar con «…»). Si no cabe, va el título solo: es
// mejor perder « | Kora» que la palabra clave del final.
export function conMarca(titulo: string, max = 60): string {
  const t = (titulo ?? "").trim();
  return t.length + " | Kora".length <= max ? `${t} | Kora` : t;
}

// El primer título que cabe en 60 caracteres, de más completo a más corto. Para
// las páginas de los hoteles, que llevaban la dirección entera en la pestaña
// («CASA ROSA Embassy Lofts CDMX — Cda. 6 22, Deportivo Pensil…», 104).
// Si ninguno cabe, el último, que es el más corto.
export function tituloQueCabe(...candidatos: string[]): string {
  const limpios = candidatos.map((c) => (c ?? "").trim()).filter(Boolean);
  return limpios.find((c) => c.length <= 60) ?? limpios[limpios.length - 1] ?? "";
}

// «Nombre — Ubicación» probando con la ubicación cada vez más corta: completa,
// sus dos últimas partes («Ciudad de México, CDMX») y la última.
export function tituloDeHotel(nombre: string, ubicacion?: string | null): string {
  // Sin el código postal: «11480 Ciudad de México» → «Ciudad de México».
  const partes = (ubicacion ?? "")
    .split(",")
    .map((p) => p.trim().replace(/^\d{4,5}\s+/, ""))
    .filter(Boolean);
  const opciones = [partes.join(", "), partes.slice(-2).join(", "), partes.slice(-1).join("")]
    .filter(Boolean)
    .map((u) => `${nombre} — ${u}`);
  return tituloQueCabe(...opciones, nombre);
}

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

// ── Etiquetas sociales completas en una sola llamada ────────────────────────
//
// SEO (18 nov 2026): 14 páginas públicas no declaraban `openGraph` (al
// compartirlas en WhatsApp salían sin título ni descripción propios) y las que
// sí lo declaraban REEMPLAZABAN el del layout entero, perdiendo `siteName`;
// sólo una ponía `og:url`. Este envoltorio deriva openGraph y twitter de lo
// que cada página ya declara (title, description, canónica) sin pisar nada que
// la página haya puesto a propósito. Las imágenes siguen viniendo de los
// archivos `opengraph-image.tsx` de cada ruta.
function textoDeTitulo(t: Metadata["title"]): string | undefined {
  if (!t) return undefined;
  if (typeof t === "string") return t;
  if ("absolute" in t && t.absolute) return t.absolute;
  if ("default" in t && t.default) return t.default;
  return undefined;
}

export function conSocial(m: Metadata): Metadata {
  const titulo = textoDeTitulo(m.title);
  const descripcion = m.description ?? undefined;
  const canonica = m.alternates?.canonical;
  const url = typeof canonica === "string" ? canonica : canonica instanceof URL ? canonica.toString() : undefined;
  const og = (m.openGraph ?? {}) as Record<string, unknown>;
  const tw = (m.twitter ?? {}) as Record<string, unknown>;
  return {
    ...m,
    openGraph: {
      siteName: "Kora",
      locale: "es_MX",
      type: "website",
      ...(titulo ? { title: titulo } : {}),
      ...(descripcion ? { description: descripcion } : {}),
      ...(url ? { url } : {}),
      ...og,
    } as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      ...(og.title || titulo ? { title: (og.title as string) ?? titulo } : {}),
      ...(og.description || descripcion ? { description: (og.description as string) ?? descripcion } : {}),
      ...tw,
    } as Metadata["twitter"],
  };
}

// ── Dirección del hotel para schema.org ─────────────────────────────────────
//
// `hoteles.ubicacion` es texto libre («Cda. 6 22, Deportivo Pensil, Miguel
// Hidalgo, 11480 Ciudad de México, CDMX» o «Xilitla, SLP, México.»). Antes iba
// ENTERA a `addressLocality`, que Google lee como el nombre de la ciudad. Se
// parte por comas: lo último es el estado, lo penúltimo la ciudad, lo de antes
// la calle; el código postal y «México» se sacan aparte.
export function direccionPostal(ubicacion: string): Record<string, string> {
  let cp = "";
  const partes = (ubicacion ?? "")
    .split(",")
    .map((p) => p.trim().replace(/\.+$/, ""))
    .map((p) => {
      const m = p.match(/^(\d{5})\s+(.*)$/);
      if (m) {
        cp = m[1];
        return m[2];
      }
      return p;
    })
    .filter((p) => p && !/^m[ée]xico$/i.test(p));
  const dir: Record<string, string> = { "@type": "PostalAddress", addressCountry: "MX" };
  if (partes.length >= 3) {
    dir.streetAddress = partes.slice(0, -2).join(", ");
    dir.addressLocality = partes[partes.length - 2];
    dir.addressRegion = partes[partes.length - 1];
  } else if (partes.length === 2) {
    dir.addressLocality = partes[0];
    dir.addressRegion = partes[1];
  } else if (partes.length === 1) {
    dir.addressLocality = partes[0];
  }
  if (cp) dir.postalCode = cp;
  return dir;
}
