// Catálogo central de las herramientas gratuitas (estrategia Tentpole).
// Fuente única para la página índice /herramientas y para el sitemap.
// Al agregar una herramienta nueva, basta con sumar una entrada aquí
// (con disponible: true cuando su página ya exista). El ícono se asigna por
// slug en components/herramientas/HerramientaIcono.tsx.

/** Grupos temáticos para organizar el índice (por objetivo del hotelero). */
export type GrupoHerramienta =
  | "Reservas directas"
  | "Precios e ingresos"
  | "Atención con IA"
  | "Administración";

export const GRUPOS_ORDEN: GrupoHerramienta[] = [
  "Reservas directas",
  "Precios e ingresos",
  "Atención con IA",
  "Administración",
];

export interface Herramienta {
  slug: string;
  titulo: string;
  /** Frase corta para la tarjeta del índice */
  resumen: string;
  /** Etiqueta específica del problema (tag en la tarjeta) */
  etiqueta: string;
  /** Grupo temático (encabezado de sección y filtro) */
  grupo: GrupoHerramienta;
  /** true cuando la página ya está publicada */
  disponible: boolean;
}

export const herramientas: Herramienta[] = [
  {
    slug: "calculadora-comisiones",
    titulo: "Calculadora de comisiones de OTAs",
    resumen:
      "Descubre cuánto pagas al año en comisiones a Booking, Airbnb y Expedia.",
    etiqueta: "Reservas directas",
    grupo: "Reservas directas",
    disponible: true,
  },
  {
    slug: "calculadora-tarifa",
    titulo: "Calculadora de tarifa y RevPAR",
    resumen: "Sabe si estás cobrando de más o de menos por tus habitaciones.",
    etiqueta: "Pricing",
    grupo: "Precios e ingresos",
    disponible: true,
  },
  {
    slug: "punto-de-equilibrio",
    titulo: "Calculadora de punto de equilibrio",
    resumen: "Cuántas noches necesitas vender al mes para no perder dinero.",
    etiqueta: "Finanzas",
    grupo: "Precios e ingresos",
    disponible: true,
  },
  {
    slug: "calculadora-impuestos",
    titulo: "Calculadora de IVA e Impuesto al Hospedaje",
    resumen: "Calcula impuestos y desglosa el total de tus reservas.",
    etiqueta: "Facturación",
    grupo: "Administración",
    disponible: true,
  },
  {
    slug: "diagnostico",
    titulo: "Diagnóstico: ¿qué tan dependiente eres de Booking?",
    resumen: "Responde 7 preguntas y recibe un puntaje de salud de tu hotel.",
    etiqueta: "Diagnóstico",
    grupo: "Administración",
    disponible: true,
  },
  {
    slug: "tarifa-neta",
    titulo: "Calculadora de tarifa neta por canal",
    resumen: "A qué precio publicar en Booking y cuánto más te deja el directo.",
    etiqueta: "Pricing",
    grupo: "Precios e ingresos",
    disponible: true,
  },
  {
    slug: "descuento-maximo",
    titulo: "¿Hasta cuánto puedo descontar sin perder?",
    resumen: "El descuento máximo seguro para grupos y last-minute.",
    etiqueta: "Pricing",
    grupo: "Precios e ingresos",
    disponible: true,
  },
  {
    slug: "auditoria-ficha",
    titulo: "Auditoría de tu ficha en Booking y Google",
    resumen: "Checklist con puntaje y mejoras para que te encuentren más.",
    etiqueta: "Visibilidad",
    grupo: "Administración",
    disponible: true,
  },
  {
    slug: "calendario-puentes",
    titulo: "Calendario de puentes y temporada alta",
    resumen: "Cuánto cobrar en cada puente y temporada alta de México.",
    etiqueta: "Pricing",
    grupo: "Precios e ingresos",
    disponible: true,
  },
  {
    slug: "cotizacion",
    titulo: "Generador de cotización en PDF",
    resumen: "Crea una cotización profesional lista para enviar por WhatsApp.",
    etiqueta: "Reservas",
    grupo: "Reservas directas",
    disponible: true,
  },
  {
    slug: "documentos",
    titulo: "Documentos legales para tu hotel",
    resumen: "Política de cancelación, aviso de privacidad y reglamento.",
    etiqueta: "Documentos",
    grupo: "Administración",
    disponible: true,
  },
  {
    slug: "qr-reservas",
    titulo: "Generador de QR de reservas",
    resumen: "Un QR que lleva a tu WhatsApp o a tu página de reservas.",
    etiqueta: "Reservas directas",
    grupo: "Reservas directas",
    disponible: true,
  },
  {
    slug: "anticipo",
    titulo: "Generador de mensaje de anticipo",
    resumen: "El mensaje de WhatsApp para pedir el anticipo, con tus datos.",
    etiqueta: "Reservas",
    grupo: "Reservas directas",
    disponible: true,
  },
  {
    slug: "respuestas-resenas",
    titulo: "Respuestas a reseñas con IA",
    resumen: "Pega la reseña y obtén una respuesta profesional en segundos.",
    etiqueta: "IA · Reputación",
    grupo: "Atención con IA",
    disponible: true,
  },
  {
    slug: "mensajes-whatsapp",
    titulo: "Mensajes de WhatsApp con IA",
    resumen: "Confirmar, cotizar o pedir anticipo: el mensaje listo en segundos.",
    etiqueta: "IA · WhatsApp",
    grupo: "Atención con IA",
    disponible: true,
  },
  {
    slug: "descripcion-hotel",
    titulo: "Descripción de hotel con IA",
    resumen: "Una descripción que vende, lista para Booking, Airbnb o tu web.",
    etiqueta: "IA · Marketing",
    grupo: "Atención con IA",
    disponible: true,
  },
  {
    slug: "mensajes-huesped",
    titulo: "Mensajes para huéspedes con IA",
    resumen: "Pre-llegada, bienvenida, check-out y pedir reseña.",
    etiqueta: "IA · Experiencia",
    grupo: "Atención con IA",
    disponible: true,
  },
  {
    slug: "mini-pagina",
    titulo: "Crea tu página de reservas gratis",
    resumen: "Página de reservas por WhatsApp + guía del huésped con QR.",
    etiqueta: "Reservas directas",
    grupo: "Reservas directas",
    disponible: true,
  },
];

/** Solo las herramientas ya publicadas (para sitemap y enlaces). */
export const herramientasDisponibles = herramientas.filter((h) => h.disponible);
