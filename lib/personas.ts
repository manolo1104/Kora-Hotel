// Páginas por tipo de hotel (pSEO Personas). Aterrizaje ICP para backlinks de directorios.
import type { FAQ } from "@/lib/glosario";

export interface Persona {
  slug: string;
  /** H1 de la página */
  titulo: string;
  /** Para metadata/tarjetas */
  pregunta: string;
  resumen: string;
  /** Bloque de respuesta de 40-60 palabras */
  intro: string;
  /** Dolores específicos de este tipo de hotel */
  dolor: string[];
  /** Cómo lo resuelve Kora (título + texto) */
  solucion: { titulo: string; texto: string }[];
  faqs: FAQ[];
}

export const personas: Persona[] = [
  {
    slug: "hoteles-boutique",
    titulo: "Sistema hotelero para hoteles boutique",
    pregunta: "¿Cuál es el mejor sistema para un hotel boutique?",
    resumen:
      "Software pensado para hoteles boutique en México: reservas directas, IA en WhatsApp y operación simple.",
    intro:
      "Un hotel boutique necesita un sistema que cuide la experiencia personal sin volverse complejo: reservas directas sin comisión, atención rápida por WhatsApp y una operación que se maneje desde el celular. Kora reúne motor de reservas, PMS y CRM en una sola pantalla, en español, instalado llave en mano.",
    dolor: [
      "Cada reserva por OTA se lleva 15%–20% de comisión, justo cuando el margen del boutique es lo que sostiene la experiencia.",
      "El huésped escribe a deshoras por WhatsApp y, si nadie contesta, se pierde la reserva.",
      "Los PMS tradicionales están en inglés y pensados para cadenas: demasiado para un hotel operado por su dueño.",
    ],
    solucion: [
      {
        titulo: "Reservas directas, sin comisión",
        texto:
          "Tu propia página con motor de reservas para que el huésped reserve directo y el ingreso se quede contigo.",
      },
      {
        titulo: "Agente de WhatsApp con IA 24/7",
        texto:
          "Contesta, cotiza y cierra la reserva aunque estés dormido, con el tono cercano que distingue a un boutique.",
      },
      {
        titulo: "Todo en una pantalla",
        texto:
          "Calendario, PMS, CRM de huéspedes y precios en un solo lugar. Si sabes usar tu celular, sabes usar Kora.",
      },
    ],
    faqs: [
      {
        q: "¿Kora sirve para un hotel boutique pequeño?",
        a: "Sí. Está diseñado precisamente para hoteles boutique e independientes en México, operados por su dueño. Lo instalamos y capacitamos nosotros en 48 a 72 horas.",
      },
      {
        q: "¿Pierdo mis reservas de Booking o Airbnb?",
        a: "No. Kora convive con tus OTAs; capturas de forma directa (sin comisión) las reservas que hoy se pierden, sin renunciar a la visibilidad de las plataformas.",
      },
    ],
  },
  {
    slug: "hoteles-pequenos",
    titulo: "Software para hoteles pequeños e independientes",
    pregunta: "¿Qué software necesita un hotel pequeño?",
    resumen:
      "Sistema todo-en-uno para hoteles pequeños: deja el cuaderno y el Excel sin complicarte.",
    intro:
      "Un hotel pequeño o independiente necesita dejar atrás el cuaderno y el Excel sin caer en un sistema caro y complicado. Lo esencial: tomar reservas directas, evitar el overbooking y contestar rápido. Kora junta todo eso en un solo sistema en español, instalado y con soporte por WhatsApp.",
    dolor: [
      "Llevar las reservas en cuaderno o Excel termina en errores y, tarde o temprano, en overbooking.",
      "Pagar varias herramientas sueltas (motor, chatbot, PMS) sale caro y no se hablan entre sí.",
      "No hay equipo grande: todo lo hace el dueño, así que el sistema tiene que ser simple.",
    ],
    solucion: [
      {
        titulo: "Un solo inventario, sin overbooking",
        texto:
          "Tus habitaciones y reservas en un solo lugar sincronizado, para no volver a vender dos veces la misma noche.",
      },
      {
        titulo: "Todo-en-uno en lugar de herramientas sueltas",
        texto:
          "Reservas, atención con IA, PMS y CRM por un solo precio, en vez de juntar (y pagar) varias apps distintas.",
      },
      {
        titulo: "Instalado y con soporte en español",
        texto:
          "Lo configuramos por ti en 48 a 72 horas y te damos soporte por WhatsApp. Cero fricción técnica.",
      },
    ],
    faqs: [
      {
        q: "¿Es difícil de usar si no sé de tecnología?",
        a: "No. Lo instalamos, capacitamos y damos soporte por WhatsApp. Está pensado para dueños que operan su hotel desde el celular.",
      },
      {
        q: "¿Cuánto cuesta para un hotel pequeño?",
        a: "Hay un solo plan de $550 MXN/mes, mes a mes y sin permanencia, con habitaciones ilimitadas y todo incluido: el motor de reservas directo (0% de comisión), el PMS, Camila (agente de WhatsApp con IA 24/7), el dashboard y el CRM. Lo pruebas 30 días gratis. Además, si quieres, te creamos tu sitio web profesional con motor de reservas como servicio aparte.",
      },
    ],
  },
  {
    slug: "hoteles-de-playa",
    titulo: "Sistema hotelero para hoteles de playa",
    pregunta: "¿Qué sistema necesita un hotel pequeño de playa?",
    resumen:
      "Reservas directas, WhatsApp con IA y tarifas por temporada para hoteles boutique de playa en México.",
    intro:
      "Un hotel pequeño de playa vive de temporadas marcadas, puentes y viajeros que planean con ilusión pero preguntan mucho antes de reservar. Necesita captar reservas directas sin comisión, cobrar anticipo para asegurar la fecha y contestar rápido. Kora reúne motor de reservas, IA en WhatsApp y tarifas por temporada en un solo sistema, en español.",
    dolor: [
      "La ocupación se concentra en temporada alta y puentes: cada reserva por OTA en esas fechas se lleva 15%–20% justo cuando más pesa.",
      "El huésped pregunta por disponibilidad, mascotas, alberca o vista a toda hora, y si no le contestas, reserva en otro lado.",
      "Manejar tarifas distintas por temporada a mano termina en errores y en dejar dinero sobre la mesa.",
    ],
    solucion: [
      {
        titulo: "Tarifas por temporada automáticas",
        texto:
          "Configuras precios por fecha y el motor cobra la tarifa correcta en cada reserva, sin que la cambies a mano en cada puente.",
      },
      {
        titulo: "Anticipo con tarjeta para asegurar la fecha",
        texto:
          "El motor cobra el anticipo al confirmar, para bajar los no-shows tan comunes en destinos de temporada.",
      },
      {
        titulo: "WhatsApp con IA que no descansa",
        texto:
          "Camila contesta 24/7 las dudas típicas (disponibilidad, qué incluye, cómo llegar) y reúne los datos para cerrar la reserva directa.",
      },
    ],
    faqs: [
      {
        q: "¿Kora maneja tarifas de temporada alta y baja?",
        a: "Sí. Defines precios por fecha (temporada alta, puentes, entre semana) y el motor aplica el correcto automáticamente en cada reserva.",
      },
      {
        q: "¿Puedo cobrar anticipo para reservar?",
        a: "Sí. El motor cobra el anticipo con tarjeta al confirmar, para asegurar la reserva y reducir cancelaciones de última hora.",
      },
    ],
  },
  {
    slug: "cabanas-ecoturismo",
    titulo: "Sistema de reservas para cabañas y ecoturismo",
    pregunta: "¿Qué sistema de reservas necesita una cabaña o un ecolodge?",
    resumen:
      "Motor de reservas directas, WhatsApp con IA y sincronía con OTAs para cabañas, ecolodges y turismo de naturaleza.",
    intro:
      "Las cabañas y ecolodges viven del turismo de naturaleza y de fin de semana, muchas veces en zonas de baja señal y operados por su dueño o familia. Necesitan captar reservas directas sin comisión y no perder las consultas que llegan por WhatsApp. Kora les da motor de reservas, IA 24/7 y sincronía con las OTAs, en un solo sistema.",
    dolor: [
      "La mayoría de las reservas llegan por Airbnb, Booking o Vrbo pagando comisión sobre cada noche.",
      "El huésped pregunta cómo llegar, qué actividades hay y si hay señal, a cualquier hora; sin respuesta rápida, se pierde la reserva.",
      "Con unidades vendidas en varias plataformas es fácil terminar en overbooking.",
    ],
    solucion: [
      {
        titulo: "Reservas directas por unidad, sin comisión",
        texto:
          "Cada cabaña o unidad se reserva directo desde tu web o WhatsApp, y el ingreso se queda contigo.",
      },
      {
        titulo: "Sincronía con tus OTAs, sin overbooking",
        texto:
          "Kora mantiene tu disponibilidad al día entre Airbnb, Booking y tus reservas directas para no vender dos veces la misma noche.",
      },
      {
        titulo: "Camila contesta 24/7",
        texto:
          "Responde las dudas de tus visitantes con la información que le cargues (cómo llegar, qué incluye, actividades) y cierra la reserva.",
      },
    ],
    faqs: [
      {
        q: "¿Kora sirve si tengo varias cabañas o unidades?",
        a: "Sí. Maneja unidades ilimitadas en un solo plan, con su propio calendario y disponibilidad sincronizada con tus OTAs.",
      },
      {
        q: "¿Funciona en zonas de poca señal?",
        a: "El motor y Camila operan en línea, pero Kora tiene modo offline para operaciones básicas (check-in/out) que se sincronizan cuando vuelve la conexión.",
      },
    ],
  },
  {
    slug: "hoteles-pueblo-magico",
    titulo: "Sistema hotelero para hoteles en Pueblos Mágicos",
    pregunta: "¿Qué sistema necesita un hotel en un Pueblo Mágico?",
    resumen:
      "Reservas directas sin comisión, WhatsApp con IA y operación simple para hoteles boutique en Pueblos Mágicos de México.",
    intro:
      "Un hotel en un Pueblo Mágico atrae viajeros que buscan experiencia y encanto, y que se concentran en fines de semana y temporadas. Depender de las OTAs le cuesta comisión justo en sus mejores fechas. Kora le da reservas directas 0% comisión, un recepcionista de IA en WhatsApp y toda la operación en una sola pantalla, en español.",
    dolor: [
      "El turismo de Pueblo Mágico es de fin de semana y puentes: la comisión de las OTAs pesa el doble en las fechas que sostienen el año.",
      "El huésped valora el trato personal, pero el dueño no puede estar pegado al WhatsApp mientras atiende el hotel.",
      "Competir por precio en las OTAs erosiona el margen de un hotel boutique cuyo valor es la experiencia.",
    ],
    solucion: [
      {
        titulo: "Reservas directas con tu sello",
        texto:
          "Tu propia página de reservas con tu marca, para que el huésped reserve directo y viva tu experiencia desde el primer contacto.",
      },
      {
        titulo: "Camila, tu recepcionista de IA 24/7",
        texto:
          "Contesta al instante con el tono cercano de tu hotel, cotiza y reúne los datos, aunque estés atendiendo a los huéspedes.",
      },
      {
        titulo: "Todo en una pantalla, en español",
        texto:
          "Calendario, PMS, CRM y tarifas por temporada en un solo lugar. Si sabes usar tu celular, sabes usar Kora.",
      },
    ],
    faqs: [
      {
        q: "¿Kora sirve para un hotel boutique pequeño en un Pueblo Mágico?",
        a: "Sí. Está diseñado para hoteles independientes operados por su dueño. Lo instalamos y capacitamos en 48 horas; convive con tus OTAs.",
      },
      {
        q: "¿Me ayuda a fidelizar al huésped?",
        a: "Sí. Al reservar directo te quedas con los datos del huésped y con un CRM y correos automáticos para invitarlo a volver, sin intermediario.",
      },
    ],
  },
];

export function getPersona(slug: string): Persona | undefined {
  return personas.find((p) => p.slug === slug);
}
