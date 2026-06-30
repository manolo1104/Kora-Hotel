// Tipos, opciones y helpers compartidos entre el editor del panel (PanelEditor)
// y la mini-página pública (/h/[slug]). Todo lo nuevo vive dentro del jsonb
// `extras` del hotel para no requerir migraciones de columnas.

export interface Resena {
  autor: string;
  texto: string;
  estrellas: number; // 1..5
  fecha?: string;
}

export interface MiniFaq {
  pregunta: string;
  respuesta: string;
}

export interface Politicas {
  cancelacion?: string;
  mascotas?: string;
  ninos?: string;
}

export interface Diseno {
  color?: string; // hex del color de marca
  acento?: string; // hex del color de acento (botones del motor); default = color
  logoUrl?: string;
  fuente?: string; // clave de FUENTES
  heroEstilo?: "banda" | "completa";
  portada?: boolean; // mostrar la 1ª foto del hotel como portada en el motor (default: sí)
  ordenSecciones?: string[]; // claves de SECCIONES
}

export interface Reglas {
  anticipoPct?: number; // % a cobrar como anticipo (0..100); default 50
  anticipoMinNoches?: number; // mín. noches para aplicar anticipo; menos = cobra 100%; default 2
  minNoches?: number; // mín. de noches por reserva; default 1
}

// Extras vendibles (add-ons): desayuno, transporte, late checkout, etc.
export interface Addon {
  nombre: string;
  precio: number;
  tipo: "estancia" | "noche" | "persona"; // cobro: por reserva / por noche / por persona
}

export interface MiniExtras {
  amenidades?: string[];
  instagram?: string;
  facebook?: string;
  mapsUrl?: string;
  mapEmbedUrl?: string;
  diseno?: Diseno;
  resenas?: Resena[];
  faqs?: MiniFaq[];
  politicas?: Politicas;
  reglas?: Reglas;
  addons?: Addon[];
  formasPago?: string[];
  idiomas?: string[];
  premium?: { marcaOculta?: boolean; dominio?: string };
}

// ─── Tipografías curadas (las variables se cargan en app/layout.tsx) ──────────
export const FUENTES = [
  { key: "jakarta", label: "Moderna" },
  { key: "playfair", label: "Elegante" },
  { key: "lora", label: "Clásica" },
  { key: "poppins", label: "Limpia" },
] as const;

const SYS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function fontStack(key?: string): string {
  switch (key) {
    case "playfair":
      return `var(--font-playfair), Georgia, serif`;
    case "lora":
      return `var(--font-lora), Georgia, serif`;
    case "poppins":
      return `var(--font-poppins), ${SYS}`;
    default:
      return `var(--font-jakarta), ${SYS}`;
  }
}

// ─── Color de marca ───────────────────────────────────────────────────────────
export const COLOR_DEFAULT = "#1B4332"; // verde Kora (default)
export const COLOR_PRESETS = [
  "#1B4332", // verde Kora
  "#0F766E", // teal
  "#1E3A8A", // azul
  "#7C3AED", // morado
  "#B45309", // ámbar
  "#9D174D", // vino
  "#1E293B", // pizarra
  "#0EA5E9", // cielo
];

// Tinta legible (texto sobre el color de marca) según luminancia.
export function inkFor(hex?: string): string {
  const h = (hex || COLOR_DEFAULT).replace("#", "");
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#1a1a1a" : "#ffffff";
}

// ─── Secciones reordenables de la mini-página ─────────────────────────────────
export const SECCIONES_DEFAULT = [
  "descripcion",
  "fotos",
  "habitaciones",
  "amenidades",
  "resenas",
  "faq",
  "politicas",
  "ubicacion",
] as const;

export const SECCION_LABELS: Record<string, string> = {
  descripcion: "Descripción",
  fotos: "Galería de fotos",
  habitaciones: "Habitaciones",
  amenidades: "Servicios / amenidades",
  resenas: "Reseñas",
  faq: "Preguntas frecuentes",
  politicas: "Políticas",
  ubicacion: "Ubicación y contacto",
};

// Devuelve el orden guardado completado con cualquier sección faltante (para que
// no desaparezcan secciones nuevas si el orden viejo no las incluía).
export function ordenSecciones(guardado?: string[]): string[] {
  const base = [...SECCIONES_DEFAULT];
  if (!guardado || guardado.length === 0) return base;
  const validos = guardado.filter((s) => base.includes(s as never));
  const faltantes = base.filter((s) => !validos.includes(s));
  return [...validos, ...faltantes];
}

// ─── Opciones de políticas / pago / idiomas ───────────────────────────────────
export const FORMAS_PAGO = [
  "Efectivo",
  "Transferencia",
  "Tarjeta de crédito/débito",
  "Depósito bancario",
  "Mercado Pago",
  "PayPal",
] as const;

export const IDIOMAS = ["Español", "Inglés", "Francés", "Portugués"] as const;
