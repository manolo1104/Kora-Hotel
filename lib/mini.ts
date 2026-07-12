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
  nrfActiva?: boolean; // ofrecer tarifa No Reembolsable con descuento; default no
  nrfPct?: number; // % de descuento de la tarifa no reembolsable (5..50); default 10
  cancelacionDias?: number; // días antes del check-in con cancelación gratis (tarifa flexible); default 2
  pagoEnHotel?: boolean; // permitir "pagar al llegar" con tarjeta como garantía; default no
}

// Impuestos del hotel para el desglose del motor. Los precios cargados por el
// hotel se tratan como precio FINAL (impuestos incluidos, como exige Profeco);
// el desglose solo transparenta cuánto es base, IVA e ISH.
export interface Impuestos {
  ishPct?: number; // Impuesto Sobre Hospedaje del estado (0..10, ej. SLP = 3); default 0
}

// Medición del propio hotel en su motor (IDs suyos, no de Kora).
export interface Medicion {
  ga4Id?: string; // p.ej. G-XXXXXXX
  metaPixelId?: string; // p.ej. 1234567890
}

// Avisos por correo al hotel (nueva reserva, cancelación) y recuperación de
// reservas incompletas hacia el huésped.
export interface Notificaciones {
  email?: string; // destinatario de avisos; vacío = correo de la cuenta del dueño
  abandono?: boolean; // recordatorio de reserva incompleta al huésped (default: sí)
}

// Progreso del asistente de configuración (6 pasos: 1-2 crean el hotel en
// /panel/onboarding; 3-6 viven en /panel/[slug]/onboarding y son resumables).
export interface OnboardingProgreso {
  paso?: number; // último paso alcanzado (3..6)
  completado?: boolean; // el dueño llegó al final y publicó
}

// Extras vendibles (add-ons): desayuno, transporte, late checkout, etc.
export interface Addon {
  nombre: string;
  precio: number;
  tipo: "estancia" | "noche" | "persona"; // cobro: por reserva / por noche / por persona
}

// Experiencias vendibles en el motor: tours, traslados, cena, spa. Es un add-on
// "rico": se vende con foto y descripción, y admite cantidad explícita (p. ej.
// "2 boletos al tour", cobro="unidad"), mientras que Addon multiplica por todos
// los huéspedes. Vive en extras.experiencias (sin migración de BD).
export interface Experiencia {
  nombre: string;
  precio: number;
  cobro: "estancia" | "noche" | "persona" | "unidad"; // ×1 / ×noches / ×huéspedes / ×cantidad
  descripcion?: string;
  imagen?: string; // URL de foto (Storage del hotel)
  categoria?: string; // clave de CATEGORIAS_EXPERIENCIA
  cantidadMax?: number; // tope de unidades (solo cobro="unidad"); 0/undefined = sin tope
}

// Categorías para agrupar experiencias en el motor y elegir en el panel.
export const CATEGORIAS_EXPERIENCIA = [
  { key: "tour", label: "Tour" },
  { key: "traslado", label: "Traslado" },
  { key: "gastronomia", label: "Gastronomía" },
  { key: "spa", label: "Spa / Bienestar" },
  { key: "otro", label: "Otro" },
] as const;

export interface MiniExtras {
  demo?: boolean; // hotel de demostración: el motor simula el pago (nada se cobra)
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
  impuestos?: Impuestos;
  medicion?: Medicion;
  notificaciones?: Notificaciones;
  onboarding?: OnboardingProgreso;
  addons?: Addon[];
  experiencias?: Experiencia[];
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
