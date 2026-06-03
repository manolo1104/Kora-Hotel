export interface Faq {
  question: string;
  answer: string;
}

// Fuente única de las preguntas frecuentes.
// Se usa tanto en la sección visible (FAQSection) como en el schema FAQPage de la home.
export const faqs: Faq[] = [
  {
    question: "¿De verdad la página web va gratis?",
    answer:
      "Sí. Para los primeros 10 hoteles que se suscriben a Kora, diseñamos y construimos tu sitio web profesional completo sin costo (un servicio que normalmente vale $30,000 MXN). Incluye tu motor de reservas propio, reseñas, señales de urgencia, tu dominio, hosting y certificado de seguridad. Tú solo pagas tu mensualidad de Kora.",
  },
  {
    question: "¿Cómo se decide mi precio mensual?",
    answer:
      "Por el tamaño de tu hotel: de 1 a 8 habitaciones son $1,990 MXN/mes, de 9 a 20 habitaciones $2,990 MXN/mes, y de 21 habitaciones o más $4,490 MXN/mes. El plan Boutique incluye el motor de reservas, PMS, dashboard y CRM; el agente de WhatsApp con IA y el pricing dinámico se incluyen a partir del plan Hotel (9 a 20 habitaciones).",
  },
  {
    question: "¿Hay permanencia o contrato?",
    answer:
      "Para la oferta de fundador con sitio web gratis pedimos una permanencia mínima de 12 meses. Es justo: te construimos un sitio que vale $30,000 sin cobrarte, y el compromiso de un año nos permite amortizar ese trabajo. Tus datos siempre son tuyos y los puedes exportar cuando quieras.",
  },
  {
    question: "¿Qué pasa cuando se acaben los 10 lugares de fundador?",
    answer:
      "El precio vuelve a la tarifa normal y la página web pasa a ser un servicio de pago (desde $30,000 MXN). Por eso la oferta es solo para los primeros 10 hoteles: queremos casos de éxito reales antes de abrirlo a todos.",
  },
  {
    question: "¿Necesito saber de tecnología para usar Kora?",
    answer:
      "No. Nosotros instalamos todo, capacitamos a tu equipo y quedamos disponibles por WhatsApp. Si sabes usar tu celular, sabes usar Kora.",
  },
  {
    question: "¿Qué pasa con mis reservas actuales en Booking o Airbnb?",
    answer:
      "Kora se conecta con tus OTAs existentes. No pierdes reservas, solo empiezas a capturar las que antes perdías.",
  },
  {
    question: "¿Cuánto tiempo tarda la implementación?",
    answer:
      "48 a 72 horas. Tú nos das acceso y nosotros configuramos todo. Tu equipo recibe capacitación antes de arrancar.",
  },
  {
    question: "¿Funciona sin internet estable?",
    answer:
      "Sí. Kora tiene modo offline para operaciones básicas (check-in, check-out) que se sincronizan cuando regresa la conexión.",
  },
  {
    question: "¿Incluye la facturación electrónica (CFDI)?",
    answer:
      "Sí, Kora genera CFDI 4.0 directamente desde cada reserva, integrado con el SAT.",
  },
  {
    question: "¿Puedo exportar todos mis datos si cancelo?",
    answer:
      "Sí. Tus datos son tuyos. Antes de cancelar puedes exportar todo: reservas, huéspedes, historial de pagos e informes en formato CSV y PDF. Nunca quedarás rehén del sistema.",
  },
  {
    question: "¿El agente de WhatsApp puede cerrar reservas por sí solo?",
    answer:
      "Sí. Consulta disponibilidad en tiempo real, informa precios, envía el link de pago directo y confirma la reserva, todo sin intervención humana. Tu equipo solo entra cuando hay algo fuera de lo ordinario.",
  },
  {
    question: "¿Tienen API para conectar otros sistemas que ya uso?",
    answer:
      "Sí. Kora tiene API REST documentada para integrarse con tu channel manager, sistema de facturación o cualquier herramienta externa. Para hoteles en el plan fundador, hacemos la integración nosotros sin costo adicional.",
  },
  {
    question: "¿Qué pasa si necesito ayuda a las 11 de la noche?",
    answer:
      "Tienes acceso directo a nuestro WhatsApp de soporte. Respondemos en menos de 2 horas en horario extendido. Para incidentes críticos del sistema (el motor de reservas caído, por ejemplo) el tiempo de respuesta es de 30 minutos, cualquier hora.",
  },
];
