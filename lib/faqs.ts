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
      "No. Kora es mes a mes, sin contratos forzosos ni permanencia. Cancelas cuando quieras desde tu panel y tus datos siempre son tuyos: los descargas en Excel (reservas, huéspedes y cotizaciones) cuando quieras.",
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
      "24 horas. Tú nos das acceso y nosotros configuramos todo. Tu equipo recibe capacitación antes de arrancar.",
  },
  {
    // 🔴 Hasta el 1 sep 2026 esta respuesta decía que Kora tiene "modo offline
    // para check-in y check-out que se sincroniza al volver la conexión". NO
    // EXISTE: no hay service worker, ni manifest, ni almacenamiento local en
    // todo el repo. Y es la objeción real de un hotel de la Huasteca, así que
    // borrar la pregunta era peor que contestarla. Lo que sí es cierto —y es
    // mejor argumento— es que Kora no vive en el hotel: vive en la nube.
    question: "¿Funciona sin internet estable?",
    answer:
      "Kora no vive en la computadora del hotel, vive en la nube: si a ti se te cae la señal, tu página de reservas sigue recibiendo huéspedes y Camila sigue contestando por WhatsApp. Lo que necesita conexión es el panel de tu equipo, y abre igual desde el celular con datos móviles.",
  },
  {
    question: "¿Puedo exportar todos mis datos si cancelo?",
    answer:
      "Sí, y no hace falta que canceles ni que nos lo pidas: en tu panel hay un botón que te baja un Excel con tus reservas (con lo cobrado y el anticipo de cada una), tu lista completa de huéspedes y tus cotizaciones, cada cosa en su hoja. Nunca quedarás rehén del sistema.",
  },
  {
    question: "¿Camila cierra las reservas sola?",
    answer:
      "Camila funciona como tu recepcionista 24/7: contesta al instante, consulta disponibilidad, informa precios y reúne los datos del huésped. La confirmación de la reserva y la verificación del pago las haces tú o tu equipo, para que mantengas el control. Así no pierdes al huésped que escribe de madrugada.",
  },
  {
    // 🔴 Hasta el 1 sep 2026 decía "Kora tiene API REST documentada". No existe
    // ninguna página de documentación de API en el repo. Pendiente construirla.
    question: "¿Tienen API para conectar otros sistemas que ya uso?",
    answer:
      "Todavía no publicamos una API abierta. Si necesitas conectar Kora con un channel manager o con otra herramienta que ya usas, escríbenos: lo vemos contigo y armamos la conexión caso por caso.",
  },
  {
    question: "¿Qué pasa si necesito ayuda a las 11 de la noche?",
    answer:
      "Tienes acceso directo a nuestro WhatsApp de soporte. Respondemos en menos de 2 horas en horario extendido. Para incidentes críticos del sistema (el motor de reservas caído, por ejemplo) el tiempo de respuesta es de 30 minutos, cualquier hora.",
  },
];
