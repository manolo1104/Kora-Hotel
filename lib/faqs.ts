export interface Faq {
  question: string;
  answer: string;
}

// Fuente única de las preguntas frecuentes.
// Se usa tanto en la sección visible (FAQSection) como en el schema FAQPage de la home.
export const faqs: Faq[] = [
  {
    question: "¿Me pueden hacer la página web?",
    answer:
      "Sí, como servicio aparte. Te diseñamos y construimos tu sitio web profesional completo con tu motor de reservas propio (sin comisiones), tu dominio, hosting y certificado de seguridad. Lo cotizamos según tu hotel, aparte de tu mensualidad de Kora. Si ya tienes página, también puedes conectar tu motor de reservas a la que usas.",
  },
  {
    question: "¿Cuánto cuesta y qué incluye?",
    answer:
      "Hay un solo plan de $550 MXN/mes, mes a mes y sin permanencia, con habitaciones ilimitadas y todo incluido: el motor de reservas directo (0% de comisión), el PMS completo, Camila (agente de WhatsApp con IA 24/7), el dashboard con tus reservas y métricas, y el CRM de huéspedes con emails automáticos. Lo pruebas 30 días gratis y sin tarjeta; activas tu plan solo si te convence.",
  },
  {
    question: "¿Necesito tarjeta para empezar?",
    answer:
      "No. Creas tu cuenta, cargas tu hotel y usas Kora completo durante 30 días sin dar ningún dato de pago. Cuando te convenza (o al terminar tu prueba) activas tu plan de $550 MXN/mes. Si no lo activas, tu motor de reservas se pausa, pero tus datos se conservan íntegros y puedes retomarlos cuando quieras.",
  },
  {
    question: "¿Hay permanencia o contrato?",
    answer:
      "No. Kora es mes a mes, sin contratos forzosos ni permanencia. Cancelas cuando quieras desde tu panel y tus datos siempre son tuyos: los exportas (reservas, huéspedes, pagos) cuando quieras.",
  },
  {
    question: "¿Por qué dicen que hay cupos limitados?",
    answer:
      "Porque damos de alta a pocos hoteles al mes: montamos tu sistema —y tu página web, si la quieres— con cuidado y te acompañamos en el arranque. No es una promoción falsa con cuenta regresiva, es nuestra capacidad real de implementación.",
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
      "48 horas. Tú nos das acceso y nosotros configuramos todo. Tu equipo recibe capacitación antes de arrancar.",
  },
  {
    question: "¿Funciona sin internet estable?",
    answer:
      "Sí. Kora tiene modo offline para operaciones básicas (check-in, check-out) que se sincronizan cuando regresa la conexión.",
  },
  {
    question: "¿Puedo exportar todos mis datos si cancelo?",
    answer:
      "Sí. Tus datos son tuyos. Antes de cancelar puedes exportar todo: reservas, huéspedes, historial de pagos e informes en formato CSV y PDF. Nunca quedarás rehén del sistema.",
  },
  {
    question: "¿Camila cierra las reservas sola?",
    answer:
      "Camila funciona como tu recepcionista 24/7: contesta al instante, consulta disponibilidad, informa precios y reúne los datos del huésped. La confirmación de la reserva y la verificación del pago las haces tú o tu equipo, para que mantengas el control. Así no pierdes al huésped que escribe de madrugada.",
  },
  {
    question: "¿Tienen API para conectar otros sistemas que ya uso?",
    answer:
      "Sí. Kora tiene API REST documentada para integrarse con tu channel manager o cualquier herramienta externa. Si lo necesitas, te ayudamos con la integración.",
  },
  {
    question: "¿Qué pasa si necesito ayuda a las 11 de la noche?",
    answer:
      "Tienes acceso directo a nuestro WhatsApp de soporte. Respondemos en menos de 2 horas en horario extendido. Para incidentes críticos del sistema (el motor de reservas caído, por ejemplo) el tiempo de respuesta es de 30 minutos, cualquier hora.",
  },
];
