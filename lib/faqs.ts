export interface Faq {
  question: string;
  answer: string;
}

// Fuente única de las preguntas frecuentes.
// Se usa tanto en la sección visible (FAQSection) como en el schema FAQPage de la home.
export const faqs: Faq[] = [
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
    question: "¿Cómo funciona el agente de llamadas exactamente?",
    answer:
      "El agente contesta en tu nombre con voz natural en español. Responde preguntas frecuentes, cotiza disponibilidad, y cuando el huésped quiere reservar, captura sus datos y los registra directamente en el PMS. No suena a robot y no requiere que tu equipo esté disponible.",
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
