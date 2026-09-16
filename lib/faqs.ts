import { AYUDA_ALTA, GARANTIA, PRECIO_DESDE } from "@/lib/oferta";

export interface Faq {
  question: string;
  answer: string;
}

const PRECIO = `$${PRECIO_DESDE.toLocaleString("es-MX")} MXN/mes`;
const DIAS = GARANTIA.diasPrueba;

// Fuente única de las preguntas frecuentes.
// Se usa tanto en la sección visible (FAQSection) como en el schema FAQPage de la home.
// FAQSection sólo pinta las 8 primeras: el orden importa.
//
// 🔴 15 sep 2026 — Estas respuestas prometían «Nosotros instalamos todo», «Tú
// nos das acceso y nosotros configuramos todo» en 24 horas, «Kora se conecta
// con tus OTAs existentes» y «damos de alta a pocos hoteles al mes». Nada de
// eso era verdad: el alta es libre y por cuenta propia, no hay sincronía con
// Booking ni Airbnb, y no hay importador de reservas. Y como este archivo
// alimenta también el chat de la web y los llms.txt, la mentira salía por tres
// sitios a la vez. Decisión de Manolo: «lo configuras tú y te ayudamos si
// quieres». Las cifras salen de lib/oferta.ts.
export const faqs: Faq[] = [
  {
    question: "¿Cómo empiezo con Kora?",
    answer: `Entras a kora-hotel.com y creas tu cuenta con tu correo, sin tarjeta: tienes ${DIAS} días gratis. Cargas tu hotel en tu panel (el nombre, tus habitaciones y sus tarifas) y lo pruebas por dentro: hablas con Camila en el chat de prueba y haces una reserva de prueba sin que se cobre nada. Cuando quieras, conectas tus cobros y tu WhatsApp, y activas tu plan si te convence. ${AYUDA_ALTA}`,
  },
  {
    question: "¿Cuánto cuesta y qué incluye?",
    answer: `Hay un solo plan de ${PRECIO}, mes a mes y sin permanencia, con habitaciones ilimitadas y todo incluido: el motor de reservas directo (0% de comisión), el PMS completo, Camila (agente de WhatsApp con IA 24/7), el dashboard con tus reservas y métricas, y el CRM de huéspedes con emails automáticos. Lo pruebas ${DIAS} días gratis y sin tarjeta; activas tu plan solo si te convence.`,
  },
  {
    question: "¿Necesito tarjeta para empezar?",
    answer: `No. Creas tu cuenta, cargas tu hotel y usas Kora completo durante ${DIAS} días sin dar ningún dato de pago. Cuando te convenza (o al terminar tu prueba) activas tu plan de ${PRECIO}. Si no lo activas, tu motor de reservas se pausa, pero tus datos se conservan íntegros y puedes retomarlos cuando quieras.`,
  },
  {
    question: "¿Necesito saber de tecnología para usar Kora?",
    answer:
      "No. Cargas tu hotel con un asistente paso a paso, desde el celular o la computadora, y todo está en español. Si te atoras o prefieres que te acompañemos, nos escribes por WhatsApp y te ayudamos a dejarlo listo. Si sabes usar tu celular, sabes usar Kora.",
  },
  {
    // Decía «24 horas. Tú nos das acceso y nosotros configuramos todo». El plazo
    // era del montaje a mano, que ya no se ofrece; y ningún tiempo de alta está
    // medido, así que no se escribe uno.
    question: "¿Cuánto tarda en quedar listo?",
    answer:
      "Depende de ti. Con el nombre de tu hotel y al menos una habitación con su tarifa, tu página ya queda en línea y puedes probar el motor y a Camila. Las fotos, los cobros con Stripe y la conexión de tu WhatsApp los agregas cuando quieras y en el orden que quieras: el asistente guarda tu avance.",
  },
  {
    // Decía «Kora se conecta con tus OTAs existentes». La pestaña de canales está
    // retirada del panel desde el 26 ago 2026 (ver lib/integraciones.ts).
    question: "¿Qué pasa con mis reservas actuales en Booking o Airbnb?",
    answer:
      "Las sigues recibiendo por ahí: Kora no te pide salirte de las OTAs. Hoy no hay sincronía automática con Booking, Airbnb ni Expedia, ni importación automática de reservas: las que ya tienes y las que entren por una OTA las registras en tu panel y bloquean la fecha igual. Lo que ganas es capturar directo, sin comisión, las reservas que hoy se pierden.",
  },
  {
    question: "¿Hay permanencia o contrato?",
    answer:
      "No. Kora es mes a mes, sin contratos forzosos ni permanencia. Cancelas cuando quieras desde tu panel y tus datos siempre son tuyos: los descargas en Excel (reservas, huéspedes y cotizaciones) cuando quieras.",
  },
  {
    question: "¿Me pueden hacer la página web?",
    answer:
      "Sí, como servicio aparte. Te diseñamos y construimos tu sitio web profesional completo con tu motor de reservas propio (sin comisiones), tu dominio, hosting y certificado de seguridad. Lo cotizamos según tu hotel, aparte de tu mensualidad de Kora. Si ya tienes página, también puedes conectar tu motor de reservas a la que usas.",
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
    // 🔴 15 sep 2026 — Decía «la confirmación de la reserva y la verificación del
    // pago las haces tú». Es al revés de lo que hace Camila: la herramienta
    // `reservar` (agentes/camila/brain.js) aparta el cuarto y genera el link de
    // pago, y el webhook crea la reserva y manda los correos al pagarse. La
    // portada decía una cosa y /whatsapp y los llms.txt la contraria, y el chat
    // de la web lee las dos. Condición real: sin la cuenta de Stripe del hotel
    // lista, `crearLinkReservaAgente` no genera link (lib/agent-booking.ts).
    question: "¿Camila cierra las reservas sola?",
    answer:
      "Sí, cuando tienes tus cobros de Stripe conectados: consulta tu disponibilidad y tus precios reales, le da al huésped el total, aparta el cuarto y le manda el link de pago. Cuando el huésped paga, la reserva queda registrada en tu panel y le llega su confirmación por correo. Lo que no puede resolver, como grupos grandes o quejas, te lo pasa a ti. Así no pierdes al huésped que escribe de madrugada.",
  },
  {
    // 🔴 Hasta el 1 sep 2026 decía "Kora tiene API REST documentada". No existe
    // ninguna página de documentación de API en el repo. Pendiente construirla.
    // 15 sep 2026: terminaba en «armamos la conexión caso por caso», una obra a
    // mano por hotel que ya no se promete (y un channel manager es justo la
    // conexión con Booking y Expedia que hoy no existe).
    question: "¿Tienen API para conectar otros sistemas que ya uso?",
    answer:
      "Todavía no publicamos una API abierta ni hay conexión con channel managers. Si necesitas conectar Kora con otra herramienta que ya usas, escríbenos y te decimos con honestidad qué se puede hacer hoy.",
  },
  {
    // 15 sep 2026: prometía «menos de 2 horas» y «30 minutos, cualquier hora».
    // Nadie midió esos tiempos y el soporte lo lleva el fundador: un plazo que no
    // se puede sostener no se publica (mismo criterio que quitó los «5 minutos»
    // del correo de bienvenida).
    question: "¿Qué pasa si necesito ayuda a las 11 de la noche?",
    answer:
      "Tienes acceso directo a nuestro WhatsApp de soporte, a cualquier hora. Si lo que pasa es que algo del sistema falla (por ejemplo, tu motor de reservas no carga), dilo en tu mensaje y lo atendemos antes que cualquier otra cosa.",
  },
];
