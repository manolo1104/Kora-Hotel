// Centro de ayuda de Kora: fuente única de los artículos.
// Se usa en /ayuda, /ayuda/[slug] y como conocimiento del chat de soporte
// (lib/soporte/prompt.ts) — si cambias algo aquí, el bot se actualiza solo.
//
// 15 sep 2026: el alta mandaba a /entrar (que abre en «Entrar», no en «Crear
// cuenta») y describía un asistente que ya no es así. La ruta y las cifras salen
// de lib/oferta.ts para que no se vuelvan a quedar atrás.
import {
  AYUDA_ALTA,
  GARANTIA,
  PASOS_ALTA,
  PRECIO_DESDE,
  RUTA_REGISTRO,
} from "@/lib/oferta";

const PRUEBA = PASOS_ALTA[2];

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
    titulo: "Cómo crear tu cuenta y tu página de reservas",
    resumen: `Te registras, cargas tu hotel y lo pruebas ${GARANTIA.diasPrueba} días gratis.`,
    contenido: [
      `1. Entra a kora-hotel.com${RUTA_REGISTRO} y crea tu cuenta con tu correo, sin tarjeta (con contraseña o con un enlace que te llega al correo). Te llega un correo para confirmarla: ábrelo en el mismo celular o computadora donde te registraste.`,
      "2. Escribe el nombre de tu hotel (y, si quieres, la ubicación, tu WhatsApp y una descripción) y después al menos una habitación con su precio y su capacidad. Con eso tu página queda en línea en kora-hotel.com/h/tu-hotel.",
      "3. El asistente sigue con tus fotos, los cobros en línea con Stripe y tus reglas de cobro (anticipo, mínimo de noches e impuestos). Puedes guardar y retomarlo cuando quieras.",
      `4. ${PRUEBA.titulo}. ${PRUEBA.texto}`,
      "Después puedes editar todo desde el panel: diseño (colores, tipografía, logo), reseñas, preguntas frecuentes, políticas y el orden de las secciones. Cada cambio se aplica al guardar.",
      AYUDA_ALTA,
    ],
  },
  {
    slug: "precios-y-planes",
    titulo: "Precios y plan de Kora",
    resumen: "Cuánto cuesta y qué incluye el plan.",
    contenido: [
      `Hay un solo plan de $${PRECIO_DESDE.toLocaleString("es-MX")} MXN/mes, mes a mes y sin permanencia, con habitaciones ilimitadas.`,
      "Incluye todo: el motor de reservas directo (0% de comisión), el PMS completo, Camila (agente de WhatsApp con IA 24/7), el dashboard con métricas y el CRM de huéspedes con emails automáticos.",
      // Decía «no se cobra nada hasta el día 15 y cancelas antes sin pagar», como
      // si la prueba cobrara sola al terminar. La prueba no pide tarjeta: si no
      // activas el plan, no hay nada que cancelar.
      `Lo pruebas ${GARANTIA.diasPrueba} días gratis y sin tarjeta: te registras, cargas tu hotel y lo usas completo. No se cobra nada si no activas tu plan.`,
      // «Gratis para siempre» sólo es cierto para la página pública: al vencer la
      // prueba sin plan, /h/[slug] sigue en línea y sus botones pasan a WhatsApp.
      "Si al terminar la prueba no activas tu plan, tu página pública de reservas sigue en línea y tus huéspedes te escriben por WhatsApp; lo que se pausa es el motor de reservas en línea y Camila.",
      `Activas tu plan con tarjeta desde tu panel (botón “Activar mi plan”) o desde la página de precios; el cobro es mensual y automático. Si cancelas dentro de los ${GARANTIA.diasDevolucion} días siguientes a tu primer pago, te devolvemos esa mensualidad. Puedes cambiar de tarjeta, descargar recibos o cancelar tú mismo desde tu panel, en “Administrar mi pago”.`,
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
    resumen: "Por tu motor de reservas o por WhatsApp, sin comisiones.",
    // 15 sep 2026: sólo describía la página SIN plan (botones a WhatsApp). El chat
    // de la web lo leía como la única forma de reservar, justo cuando la invitación
    // es probar el motor por dentro. Los botones de /h/[slug] van al motor mientras
    // la prueba o el plan están activos, y a WhatsApp si no (`motorActivo`).
    contenido: [
      "Durante tu prueba y con tu plan activo, los botones de tu página llevan a tu motor de reservas: el huésped elige fechas y habitación, y reserva ahí mismo.",
      "Si tu plan no está activo, tu página sigue en línea con botones de “Reservar por WhatsApp” y un formulario de solicitud. Cuando el huésped los usa, te llega un mensaje directo a tu WhatsApp con lo que quiere reservar; tú confirmas disponibilidad y cobras como prefieras (transferencia, tarjeta, efectivo al llegar).",
      "En los dos casos, Kora no cobra ninguna comisión por tus reservas.",
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
      "Si quieres que te acompañemos a dejar tu hotel listo en Kora, también es por ahí: lo configuras tú desde tu panel y te ayudamos en lo que necesites.",
    ],
  },
];

export function articuloPorSlug(slug: string): ArticuloAyuda | null {
  return AYUDA.find((a) => a.slug === slug) ?? null;
}
