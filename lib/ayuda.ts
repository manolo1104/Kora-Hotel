// Centro de ayuda de Kora: fuente única de los artículos.
// Se usa en /ayuda, /ayuda/[slug] y como conocimiento del chat de soporte
// (lib/soporte/prompt.ts) — si cambias algo aquí, el bot se actualiza solo.

export interface ArticuloAyuda {
  slug: string;
  titulo: string;
  resumen: string;
  /** Párrafos del artículo (texto plano; los saltos se respetan). */
  contenido: string[];
}

export const AYUDA: ArticuloAyuda[] = [
  {
    slug: "crear-mi-pagina",
    titulo: "Cómo crear tu página de reservas gratis",
    resumen: "De cero a página publicada en unos 5 minutos.",
    contenido: [
      "1. Entra a kora-hotel.com/entrar y crea tu cuenta con tu correo (con contraseña o con un enlace que te llega al correo).",
      "2. Al entrar a tu panel, un asistente te pide lo básico: nombre del hotel, ubicación, WhatsApp, descripción, fotos y al menos una habitación con precio.",
      "3. Toca “Publicar mi página”. Tu dirección queda como kora-hotel.com/h/tu-hotel y ya puedes compartirla o ponerla en tu Instagram.",
      "Después puedes editar todo desde el panel: diseño (colores, tipografía, logo), reseñas, preguntas frecuentes, políticas y el orden de las secciones. Cada cambio se aplica al guardar.",
    ],
  },
  {
    slug: "precios-y-planes",
    titulo: "Precios y plan de Kora",
    resumen: "Cuánto cuesta y qué incluye el plan.",
    contenido: [
      "Hay un solo plan de $550 MXN/mes, mes a mes y sin permanencia, con habitaciones ilimitadas.",
      "Incluye todo: el motor de reservas directo (0% de comisión), el PMS completo, Camila (agente de WhatsApp con IA 24/7), el dashboard con métricas y el CRM de huéspedes con emails automáticos.",
      "Lo pruebas 30 días gratis: no se cobra nada hasta el día 31 y cancelas antes sin pagar.",
      "La mini-página de reservas es gratis para siempre, con o sin plan.",
      "Pagas con tarjeta desde la página de precios; el cobro es mensual y automático. Puedes cambiar de tarjeta, descargar recibos o cancelar tú mismo desde tu panel, en “Administrar mi pago”.",
    ],
  },
  {
    slug: "sitio-web",
    titulo: "El servicio de sitio web profesional",
    resumen: "Te creamos tu sitio web con motor de reservas, como servicio aparte.",
    contenido: [
      "Te diseñamos y construimos tu sitio web profesional completo: diseño 100% personalizado, motor de reservas propio sin comisiones, tu dominio, hosting y certificado de seguridad.",
      "Es un servicio aparte de tu mensualidad: lo cotizamos según tu hotel. Tu plan de Kora es siempre mes a mes, sin permanencia.",
      "Si ya tienes página, también podemos conectar tu motor de reservas a la que usas. Más detalles en kora-hotel.com/precios.",
    ],
  },
  {
    slug: "pagos-y-facturacion",
    titulo: "Pagos, recibos y cancelación",
    resumen: "Todo lo del cobro mensual lo manejas tú, sin llamadas.",
    contenido: [
      "El cobro de tu plan es mensual y automático con tarjeta, procesado por Stripe (la misma plataforma de pagos que usan Amazon y Google).",
      "En tu panel (kora-hotel.com/panel) está el botón “Administrar mi pago”: ahí cambias tu tarjeta, ves y descargas tus recibos, o cancelas tu suscripción cuando quieras.",
      "Si un cargo no pasa (tarjeta vencida, límite, bloqueo del banco), te avisamos por correo y el sistema reintenta automáticamente. Tu servicio no se corta de inmediato: tienes días de gracia para actualizar tu tarjeta.",
    ],
  },
  {
    slug: "quitar-marca-kora",
    titulo: "Quitar “Hecho con Kora” de tu página",
    resumen: "Disponible con cualquier plan de pago.",
    contenido: [
      "Tu página gratis muestra una línea pequeña al pie que dice “Hecho con Kora”. Con cualquier plan de Kora puedes quitarla.",
      "Ya con tu plan activo: entra a tu panel → pestaña “Avanzado” → “Marca de Kora en tu página” → activa la casilla y guarda.",
    ],
  },
  {
    slug: "reservas-por-whatsapp",
    titulo: "Cómo llegan las reservas de tu página",
    resumen: "Directo a tu WhatsApp, sin comisiones.",
    contenido: [
      "Tu mini-página tiene botones de “Reservar por WhatsApp” y un formulario de solicitud. Cuando el huésped los usa, te llega un mensaje directo a tu WhatsApp con lo que quiere reservar.",
      "Tú confirmas disponibilidad y cobras como prefieras (transferencia, tarjeta, efectivo al llegar). Kora no cobra ninguna comisión por tus reservas.",
      "Consejo: responde rápido. La mayoría de los huéspedes reservan con el primer hotel que les contesta.",
    ],
  },
  {
    slug: "guia-del-huesped",
    titulo: "La guía del huésped y los códigos QR",
    resumen: "WiFi, horarios y recomendaciones en un QR para la habitación.",
    contenido: [
      "Además de tu página de reservas, Kora te da una guía del huésped: una página con tu WiFi y clave, horarios de check-in/out, reglas de la casa y recomendaciones de la zona. Se llena en el panel, pestaña “Avanzado”.",
      "En la pestaña “Compartir” puedes descargar dos códigos QR: el de reservas (para recepción, tarjetas y redes) y el de la guía (imprímelo y ponlo en las habitaciones).",
    ],
  },
  {
    slug: "contacto",
    titulo: "Hablar con una persona",
    resumen: "Soporte directo con el fundador, en español.",
    contenido: [
      "Kora la hace un hotelero (Manolo, del Hotel Paraíso Encantado en la Huasteca Potosina), no un call center.",
      "Si el chat de ayuda no resuelve tu duda, escríbenos por WhatsApp desde el botón verde del sitio o responde cualquiera de nuestros correos. Contestamos el mismo día.",
    ],
  },
];

export function articuloPorSlug(slug: string): ArticuloAyuda | null {
  return AYUDA.find((a) => a.slug === slug) ?? null;
}
