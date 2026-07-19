// Helper compartido (cliente + servidor) para convertir lo que el hotelero pega
// en el editor — una DIRECCIÓN o un LINK de Google Maps — en:
//   - embedUrl: la URL para el <iframe> del mapa embebido en la página pública.
//   - mapsUrl:  la URL para el botón "Cómo llegar".
//   - needsResolve: true si es un link CORTO (maps.app.goo.gl / goo.gl) que hay
//     que expandir en el servidor antes de poder extraer coordenadas.
//
// Usa el truco `output=embed` de Google Maps, que NO requiere API key.

export interface ResultadoMapa {
  embedUrl: string;
  mapsUrl: string;
  needsResolve: boolean;
}

const VACIO: ResultadoMapa = { embedUrl: "", mapsUrl: "", needsResolve: false };

function esUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

// ¿Es un link CORTO de Google que hay que expandir en el servidor?
export function esLinkCorto(s: string): boolean {
  const t = s.trim().toLowerCase();
  return (
    t.includes("maps.app.goo.gl") ||
    t.includes("goo.gl/maps") ||
    t.includes("g.co/kgs") ||
    /\bmaps\.app\b/.test(t)
  );
}

function embedDeCoords(lat: string, lng: string): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

function embedDeTexto(texto: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(texto)}&output=embed`;
}

function mapsSearchDeTexto(texto: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}

// Intenta sacar coordenadas de una URL de Google Maps (varios formatos).
function extraerCoords(url: string): { lat: string; lng: string } | null {
  // /@21.5510,-98.9910,17z
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: m[1], lng: m[2] };
  // !3d21.5510!4d-98.9910
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: m[1], lng: m[2] };
  // ?q=21.5510,-98.9910  |  ?query=...  |  ?ll=...  |  ?destination=...
  m = url.match(/[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i);
  if (m) return { lat: m[1], lng: m[2] };
  return null;
}

// Saca el nombre/dirección de una URL /maps/place/<texto>/ o del parámetro q=.
function extraerTexto(url: string): string | null {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("query");
    if (q && !/^-?\d+\.\d+,/.test(q)) return q;
    const m = u.pathname.match(/\/place\/([^/@]+)/);
    if (m) return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Convierte una dirección o un link de Google Maps en { embedUrl, mapsUrl }.
 * Si es un link corto, devuelve needsResolve=true para que el servidor lo expanda
 * y vuelva a llamar a esta función con la URL final.
 */
export function construirMapa(input: string): ResultadoMapa {
  const s = (input || "").trim();
  if (!s) return VACIO;

  // Link corto → hay que expandirlo en el servidor.
  if (esLinkCorto(s)) {
    return { embedUrl: "", mapsUrl: s, needsResolve: true };
  }

  if (esUrl(s)) {
    // Ya es una URL de "insertar mapa" → úsala tal cual.
    if (s.includes("/maps/embed")) {
      return { embedUrl: s, mapsUrl: s, needsResolve: false };
    }
    const coords = extraerCoords(s);
    if (coords) {
      return { embedUrl: embedDeCoords(coords.lat, coords.lng), mapsUrl: s, needsResolve: false };
    }
    const texto = extraerTexto(s);
    if (texto) {
      return { embedUrl: embedDeTexto(texto), mapsUrl: s, needsResolve: false };
    }
    // URL de Google Maps que no pudimos parsear: al menos el botón "Cómo llegar"
    // funciona; para el embed usamos la misma URL con output=embed como intento.
    return { embedUrl: `${s}${s.includes("?") ? "&" : "?"}output=embed`, mapsUrl: s, needsResolve: false };
  }

  // Texto libre = dirección.
  return { embedUrl: embedDeTexto(s), mapsUrl: mapsSearchDeTexto(s), needsResolve: false };
}
