// Catálogo central de las herramientas gratuitas (estrategia Tentpole).
// Fuente única para la página índice /herramientas y para el sitemap.
// Al agregar una herramienta nueva, basta con sumar una entrada aquí
// (con disponible: true cuando su página ya exista).

export interface Herramienta {
  slug: string;
  titulo: string;
  /** Frase corta para la tarjeta del índice */
  resumen: string;
  /** Etiqueta del problema que resuelve */
  etiqueta: string;
  /** Emoji/ícono simple para la tarjeta */
  icono: string;
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
    icono: "💸",
    disponible: true,
  },
  {
    slug: "calculadora-tarifa",
    titulo: "Calculadora de tarifa y RevPAR",
    resumen: "Sabe si estás cobrando de más o de menos por tus habitaciones.",
    etiqueta: "Pricing",
    icono: "📈",
    disponible: true,
  },
  {
    slug: "punto-de-equilibrio",
    titulo: "Calculadora de punto de equilibrio",
    resumen: "Cuántas noches necesitas vender al mes para no perder dinero.",
    etiqueta: "Finanzas",
    icono: "⚖️",
    disponible: true,
  },
  {
    slug: "calculadora-impuestos",
    titulo: "Calculadora de IVA e Impuesto al Hospedaje",
    resumen: "Calcula impuestos y desglosa el total de tus reservas.",
    etiqueta: "Facturación",
    icono: "🧾",
    disponible: true,
  },
  {
    slug: "diagnostico",
    titulo: "Diagnóstico: ¿qué tan dependiente eres de Booking?",
    resumen: "Responde 7 preguntas y recibe un puntaje de salud de tu hotel.",
    etiqueta: "Diagnóstico",
    icono: "🩺",
    disponible: true,
  },
  {
    slug: "tarifa-neta",
    titulo: "Calculadora de tarifa neta por canal",
    resumen: "A qué precio publicar en Booking y cuánto más te deja el directo.",
    etiqueta: "Pricing",
    icono: "🏷️",
    disponible: true,
  },
  {
    slug: "descuento-maximo",
    titulo: "¿Hasta cuánto puedo descontar sin perder?",
    resumen: "El descuento máximo seguro para grupos y last-minute.",
    etiqueta: "Pricing",
    icono: "🔖",
    disponible: true,
  },
  {
    slug: "auditoria-ficha",
    titulo: "Auditoría de tu ficha en Booking y Google",
    resumen: "Checklist con puntaje y mejoras para que te encuentren más.",
    etiqueta: "Visibilidad",
    icono: "🔍",
    disponible: true,
  },
  {
    slug: "calendario-puentes",
    titulo: "Calendario de puentes y temporada alta",
    resumen: "Cuánto cobrar en cada puente y temporada alta de México.",
    etiqueta: "Pricing",
    icono: "📅",
    disponible: true,
  },
  {
    slug: "cotizacion",
    titulo: "Generador de cotización en PDF",
    resumen: "Crea una cotización profesional lista para enviar por WhatsApp.",
    etiqueta: "Reservas",
    icono: "📄",
    disponible: true,
  },
  {
    slug: "documentos",
    titulo: "Documentos legales para tu hotel",
    resumen: "Política de cancelación, aviso de privacidad y reglamento.",
    etiqueta: "Documentos",
    icono: "📋",
    disponible: true,
  },
  {
    slug: "qr-reservas",
    titulo: "Generador de QR de reservas",
    resumen: "Un QR que lleva a tu WhatsApp o a tu página de reservas.",
    etiqueta: "Reservas directas",
    icono: "🔳",
    disponible: true,
  },
  {
    slug: "anticipo",
    titulo: "Generador de mensaje de anticipo",
    resumen: "El mensaje de WhatsApp para pedir el anticipo, con tus datos.",
    etiqueta: "Reservas",
    icono: "💳",
    disponible: true,
  },
  {
    slug: "respuestas-resenas",
    titulo: "Respuestas a reseñas con IA",
    resumen: "Pega la reseña y obtén una respuesta profesional en segundos.",
    etiqueta: "IA · Reputación",
    icono: "⭐",
    disponible: true,
  },
  {
    slug: "mensajes-whatsapp",
    titulo: "Mensajes de WhatsApp con IA",
    resumen: "Confirmar, cotizar o pedir anticipo: el mensaje listo en segundos.",
    etiqueta: "IA · WhatsApp",
    icono: "💬",
    disponible: true,
  },
  {
    slug: "descripcion-hotel",
    titulo: "Descripción de hotel con IA",
    resumen: "Una descripción que vende, lista para Booking, Airbnb o tu web.",
    etiqueta: "IA · Marketing",
    icono: "✍️",
    disponible: true,
  },
  {
    slug: "mensajes-huesped",
    titulo: "Mensajes para huéspedes con IA",
    resumen: "Pre-llegada, bienvenida, check-out y pedir reseña.",
    etiqueta: "IA · Experiencia",
    icono: "🛎️",
    disponible: true,
  },
];

/** Solo las herramientas ya publicadas (para sitemap y enlaces). */
export const herramientasDisponibles = herramientas.filter((h) => h.disponible);
