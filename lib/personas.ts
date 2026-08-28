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
        a: "Sí. Está diseñado precisamente para hoteles boutique e independientes en México, operados por su dueño. Lo instalamos y capacitamos nosotros en 48 horas.",
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
          "Lo configuramos por ti en 48 horas y te damos soporte por WhatsApp. Cero fricción técnica.",
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
      "Un hotel boutique de playa en México —de Sayulita y Puerto Escondido a Tulum, Bacalar o Zihuatanejo— vive de temporadas marcadas, puentes y viajeros que planean con ilusión pero preguntan mucho antes de reservar. Necesita captar reservas directas sin comisión, cobrar anticipo para asegurar la fecha y contestar rápido. Kora reúne motor de reservas, IA en WhatsApp y tarifas por temporada en un solo sistema, en español.",
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
      {
        q: "¿Sirve para un hotel de playa en Tulum, Sayulita o Puerto Escondido?",
        a: "Sí. Kora sirve para hoteles boutique de playa en cualquier destino de México. Convive con Booking, Airbnb y Expedia mientras haces crecer tu canal directo sin comisión, y lo montamos llave en mano en 48 horas.",
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
  {
    slug: "hostales",
    titulo: "Sistema de reservas para hostales",
    pregunta: "¿Cuál es el mejor sistema para un hostal?",
    resumen:
      "Reservas directas sin comisión y WhatsApp con IA para hostales con mucha rotación y huésped internacional.",
    intro:
      "Un hostal vive de alta rotación, estancias cortas y consultas de último minuto, casi siempre por WhatsApp y muchas veces en inglés. Kora te da un motor de reservas directas sin comisión, un agente de WhatsApp con IA que responde 24/7 en el idioma del huésped, y todo el inventario en una sola pantalla.",
    dolor: [
      "El volumen de consultas es altísimo y la mayoría llega fuera de horario o en otro idioma.",
      "Casi todo el inventario se vende por plataformas, y la comisión pesa muchísimo sobre un ticket bajo.",
      "Con tanta rotación, llevar el control a mano termina en camas vendidas dos veces.",
    ],
    solucion: [
      {
        titulo: "Un agente que contesta en el idioma del huésped",
        texto:
          "Camila responde al instante en español o inglés con tu disponibilidad real, a cualquier hora del día.",
      },
      {
        titulo: "Reservas directas sin comisión",
        texto:
          "Tu propia página de reservas con cobro de anticipo con tarjeta, para que el ticket bajo no se coma la comisión.",
      },
      {
        titulo: "Un solo inventario",
        texto:
          "Lo que se vende por WhatsApp, por tu página o por una OTA bloquea la misma unidad. Sin doble venta.",
      },
    ],
    faqs: [
      {
        q: "¿Sirve para camas en dormitorio compartido?",
        a: "Cargamos tus unidades como las manejes, con su capacidad y tarifa. Lo revisamos contigo en el arranque para que quede como lo vendes.",
      },
      {
        q: "¿Cuánto cuesta?",
        a: "Plan único de $550 MXN al mes con habitaciones ilimitadas, sin permanencia y con 30 días gratis.",
      },
    ],
  },
  {
    slug: "glamping-y-domos",
    titulo: "Sistema de reservas para glamping y domos",
    pregunta: "¿Cuál es el mejor sistema de reservas para un glamping?",
    resumen:
      "Motor de reservas directas y WhatsApp con IA para glampings, domos y cabañas de naturaleza.",
    intro:
      "Un glamping vende experiencia y se descubre por Instagram, pero la reserva casi siempre se cierra por WhatsApp. Kora te da un motor de reservas directas sin comisión, un agente de IA que cotiza con disponibilidad real las 24 horas, y el cobro del anticipo dentro de la misma conversación.",
    dolor: [
      "El descubrimiento pasa en Instagram y la conversación en WhatsApp, pero la reserva se captura a mano y se pierde.",
      "Las unidades son pocas y cada fin de semana perdido pesa muchísimo en el mes.",
      "El huésped pregunta mucho antes de reservar —qué incluye, cómo llegar, si hay señal— y todo eso lo contesta el dueño.",
    ],
    solucion: [
      {
        titulo: "Cierra la reserva dentro del chat",
        texto:
          "Camila cotiza con tu disponibilidad real, aparta la unidad y manda el link de pago sin que tú captures nada.",
      },
      {
        titulo: "Contesta las preguntas de siempre",
        texto:
          "Qué incluye, cómo llegar, si aceptan mascotas, si hay señal: responde con la información que cargaste de tu proyecto.",
      },
      {
        titulo: "Mínimo de noches en fechas fuertes",
        texto:
          "Puedes exigir dos noches en fines de semana y puentes, y el agente lo respeta al cotizar.",
      },
    ],
    faqs: [
      {
        q: "¿Sirve si mis unidades no son habitaciones normales?",
        a: "Sí. Domos, tiendas, cabañas o casas: se cargan como unidades con su capacidad y tarifa.",
      },
      {
        q: "¿Puedo cobrar sólo un anticipo?",
        a: "Sí. El link de pago respeta tu política y el resto se liquida a la llegada.",
      },
    ],
  },
  {
    slug: "hoteles-de-ciudad",
    titulo: "Sistema de reservas para hoteles de ciudad",
    pregunta: "¿Cuál es el mejor sistema para un hotel urbano independiente?",
    resumen:
      "Reservas directas sin comisión, WhatsApp con IA y operación completa para hoteles independientes de ciudad.",
    intro:
      "Un hotel urbano independiente compite contra cadenas con presupuesto de marketing y depende de las OTAs para que lo encuentren. Kora te da un canal directo propio —motor de reservas sin comisión y agente de WhatsApp con IA 24/7— más el PMS, el dashboard y el CRM en una sola pantalla.",
    dolor: [
      "Compites con cadenas que invierten en publicidad y aparecen primero en todos lados.",
      "La demanda es mixta: turista de fin de semana y viajero de negocios entre semana, con preguntas muy distintas.",
      "Cada reserva por OTA se lleva comisión, incluso las de huéspedes que ya se habían hospedado contigo.",
    ],
    solucion: [
      {
        titulo: "Un canal directo que sí cierra",
        texto:
          "Motor de reservas en tu página y un agente que cotiza y cobra por WhatsApp, sin comisión por reserva.",
      },
      {
        titulo: "El huésped que vuelve, vuelve directo",
        texto:
          "El CRM guarda a cada huésped y los correos automáticos lo traen de regreso sin pagar comisión otra vez.",
      },
      {
        titulo: "La operación completa en una pantalla",
        texto:
          "Mapa de habitaciones, check-in y check-out, housekeeping, ocupación, ADR, RevPAR y forecast de 30 días.",
      },
    ],
    faqs: [
      {
        q: "¿Puedo tener tarifas distintas entre semana y fin de semana?",
        a: "Sí, con tarifas por temporada y por día. El agente cotiza siempre con la vigente.",
      },
      {
        q: "¿Se sincroniza con las OTAs?",
        a: "Sí. Kora sincroniza el calendario para que una reserva directa cierre esa fecha en todos los canales.",
      },
    ],
  },
  {
    slug: "hoteles-que-dependen-de-booking",
    titulo: "Para hoteles que dependen demasiado de Booking",
    pregunta: "¿Cómo bajo la dependencia de Booking en mi hotel?",
    resumen:
      "El plan para mover volumen de las OTAs a tu canal directo, sin perder visibilidad.",
    intro:
      "Si la mayoría de tus reservas entra por Booking, tu ocupación se ve bien y tu margen no. Bajar esa dependencia no significa salirte: significa tener un canal directo lo bastante bueno para que quien ya te encontró cierre contigo. Eso es exactamente lo que monta Kora.",
    dolor: [
      "El 15%–20% de comisión se lleva la utilidad justo de las reservas que ya eran tuyas.",
      "Los datos del huésped los tiene la plataforma, así que no puedes traerlo de vuelta sin pagar de nuevo.",
      "Cuando el huésped te busca directo por WhatsApp y no contestas a tiempo, vuelve a la OTA y cierra ahí.",
    ],
    solucion: [
      {
        titulo: "Intercepta al huésped que ya te encontró",
        texto:
          "Muchos viajeros te descubren en la OTA y te buscan directo antes de pagar. Con respuesta en segundos y un total concreto, esa reserva entra sin comisión.",
      },
      {
        titulo: "Un canal directo que cierra solo",
        texto:
          "Motor de reservas en tu página con cobro de anticipo, y un agente de WhatsApp que cotiza y aparta las 24 horas.",
      },
      {
        titulo: "Los datos del huésped se quedan contigo",
        texto:
          "Cada reserva directa alimenta tu CRM, y los correos automáticos lo traen de vuelta sin comisión.",
      },
      {
        titulo: "Sin overbooking",
        texto:
          "El calendario sigue sincronizado con las OTAs: una reserva directa cierra esa fecha también allá.",
      },
    ],
    faqs: [
      {
        q: "¿Tengo que salirme de Booking?",
        a: "No. Las OTAs siguen sirviendo para que te descubran. La meta es que las reservas que ya eran tuyas dejen de pagar comisión.",
      },
      {
        q: "¿Puedo ofrecer mejor precio en directo?",
        a: "Muchas OTAs tienen cláusulas de paridad tarifaria, así que conviene revisarlas. Lo que casi siempre sí puedes hacer es dar valor extra: late check-out, un detalle de bienvenida o una cortesía.",
      },
      {
        q: "¿Cuánto puedo ahorrar?",
        a: "Depende de cuánto volumen muevas a directo. Puedes estimarlo con la calculadora de comisiones gratuita de Kora.",
      },
    ],
  },
];

export function getPersona(slug: string): Persona | undefined {
  return personas.find((p) => p.slug === slug);
}
