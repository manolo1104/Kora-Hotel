// Catálogo del glosario hotelero (estrategia pSEO "qué es X" + AI-SEO).
// Fuente única para /glosario, /glosario/[termino] y el sitemap.
// Cada término abre con una "definicion" de 40-60 palabras (bloque citable por IA).

export interface FAQ {
  q: string;
  a: string;
}

export interface TerminoGlosario {
  slug: string;
  /** Término tal cual (H1 de la página) */
  termino: string;
  /** Pregunta-título para metadata y tarjetas: "¿Qué es X?" */
  pregunta: string;
  /** Resumen corto para la tarjeta del índice */
  resumen: string;
  /** Bloque de definición de 40-60 palabras (lo primero de la página) */
  definicion: string;
  /** Párrafos de contexto (uno por entrada) */
  cuerpo: string[];
  faqs: FAQ[];
  /** Enlace interno a la herramienta/módulo de Kora relacionado */
  relacionado?: { texto: string; href: string };
}

export const glosario: TerminoGlosario[] = [
  {
    slug: "pms",
    termino: "PMS hotelero",
    pregunta: "¿Qué es un PMS hotelero?",
    resumen: "El sistema que gestiona habitaciones, reservas y operación del hotel.",
    definicion:
      "Un PMS (Property Management System) es el software que un hotel usa para gestionar su operación diaria: mapa de habitaciones, reservas, check-in y check-out, tarifas, limpieza (housekeeping) y facturación. Es el cerebro operativo que reemplaza al cuaderno o al Excel y evita errores como el overbooking.",
    cuerpo: [
      "En un hotel pequeño o boutique, el PMS centraliza lo que normalmente está repartido entre una libreta de recepción, una hoja de cálculo y varios WhatsApps. Desde una sola pantalla ves qué habitaciones están ocupadas, quién llega hoy y quién sale, y registras cobros.",
      "Los PMS tradicionales suelen estar en inglés y pensados para cadenas grandes, lo que los hace complejos para un hotel operado por su dueño. En México, además, el sistema debe poder emitir CFDI 4.0 (la factura oficial del SAT), algo que la mayoría de los PMS extranjeros no integran de forma nativa.",
      "Kora incluye un PMS pensado para hoteles boutique mexicanos: mapa de habitaciones, check-in/check-out, housekeeping y facturación CFDI, en español y operable desde el celular.",
    ],
    faqs: [
      {
        q: "¿Cuál es la diferencia entre un PMS y un motor de reservas?",
        a: "El motor de reservas toma reservas desde tu página web; el PMS gestiona la operación interna del hotel (habitaciones, check-in/out, housekeeping). Un sistema todo-en-uno como Kora incluye ambos y los mantiene sincronizados.",
      },
      {
        q: "¿Un hotel pequeño necesita un PMS?",
        a: "Sí. En cuanto manejas más de unas pocas habitaciones, llevar las reservas en cuaderno o Excel genera errores y overbooking. Un PMS simple reduce ese riesgo y te ahorra tiempo.",
      },
    ],
    relacionado: {
      texto: "Conoce el PMS de Kora",
      href: "/caracteristicas",
    },
  },
  {
    slug: "motor-de-reservas",
    termino: "Motor de reservas",
    pregunta: "¿Qué es un motor de reservas?",
    resumen: "La herramienta que permite reservar directo en tu página, sin comisión.",
    definicion:
      "Un motor de reservas es la herramienta que se integra a la página web de tu hotel para que el huésped consulte disponibilidad, elija fechas y reserve directamente contigo, sin pasar por una OTA. Al ser una reserva directa, no pagas comisión: el ingreso completo se queda en el hotel.",
    cuerpo: [
      "Cuando un huésped reserva por Booking o Airbnb, esas plataformas cobran una comisión del 15% al 20% por cada reserva. Un motor de reservas propio te permite captar a ese mismo huésped de forma directa y quedarte con el 100% del ingreso.",
      "Además de ahorrar la comisión, las reservas directas te dan la relación con el huésped: su correo, su teléfono y la posibilidad de fidelizarlo para que vuelva, en lugar de que la OTA sea la dueña de esa relación.",
      "El motor de reservas de Kora se conecta a tu página (o a la mini-página gratuita que creas con nosotros) y cobra el anticipo en línea para confirmar la reserva.",
    ],
    faqs: [
      {
        q: "¿Un motor de reservas reemplaza a Booking?",
        a: "No lo reemplaza, lo complementa. Sigues recibiendo reservas de las OTAs, pero capturas de forma directa (sin comisión) a los huéspedes que hoy se pierden o que de todos modos te buscarían.",
      },
      {
        q: "¿Cuánto cuesta tener un motor de reservas?",
        a: "Con Kora está incluido en el plan mensual. También puedes crear gratis una página de reservas por WhatsApp para empezar sin costo.",
      },
    ],
    relacionado: {
      texto: "Crea tu página de reservas gratis",
      href: "/herramientas/mini-pagina",
    },
  },
  {
    slug: "channel-manager",
    termino: "Channel manager",
    pregunta: "¿Qué es un channel manager?",
    resumen: "Sincroniza tu disponibilidad entre tu web y las OTAs para evitar overbooking.",
    definicion:
      "Un channel manager es el software que sincroniza la disponibilidad y las tarifas de tu hotel entre todos tus canales de venta (tu página web, Booking, Airbnb, Expedia) en tiempo real. Cuando se vende una habitación en un canal, la descuenta de los demás, evitando el overbooking.",
    cuerpo: [
      "Sin un channel manager, tienes que actualizar la disponibilidad a mano en cada plataforma cada vez que entra una reserva. Eso es lento y propenso a errores: si dos personas reservan la misma habitación en canales distintos, terminas en overbooking.",
      "El channel manager conecta todos los canales a un solo inventario. Vendes una habitación en Booking y automáticamente deja de estar disponible en tu web y en Airbnb.",
      "Para un hotel boutique, lo ideal es que el channel manager venga integrado con el PMS y el motor de reservas, en lugar de ser una herramienta suelta más que pagar y configurar.",
    ],
    faqs: [
      {
        q: "¿Channel manager y motor de reservas son lo mismo?",
        a: "No. El motor de reservas capta reservas en tu propia web; el channel manager sincroniza el inventario entre tu web y las OTAs. Se complementan.",
      },
      {
        q: "¿Evita el overbooking por completo?",
        a: "Reduce drásticamente el riesgo al mantener un solo inventario sincronizado entre canales, que es la causa más común de overbooking en hoteles pequeños.",
      },
    ],
    relacionado: {
      texto: "Cómo funciona Kora",
      href: "/como-funciona",
    },
  },
  {
    slug: "revpar",
    termino: "RevPAR",
    pregunta: "¿Qué es el RevPAR?",
    resumen: "Ingreso por habitación disponible: la métrica clave de rentabilidad.",
    definicion:
      "El RevPAR (Revenue Per Available Room, o ingreso por habitación disponible) es la métrica que mide cuánto ingresa tu hotel por cada habitación que tienes, esté ocupada o no. Se calcula multiplicando la tarifa promedio por la ocupación, o dividiendo los ingresos por habitaciones entre el total de habitaciones disponibles.",
    cuerpo: [
      "El RevPAR combina en un solo número las dos palancas de ingreso de un hotel: el precio (tarifa promedio o ADR) y qué tan lleno está (ocupación). Por eso es mejor indicador de salud que mirar solo la ocupación o solo el precio por separado.",
      "Ejemplo: si tu tarifa promedio es de $1,500 y tu ocupación es del 60%, tu RevPAR es de $900. Subir el RevPAR significa llenar más el hotel, cobrar mejor, o ambas.",
      "Kora calcula tu RevPAR automáticamente en el dashboard y lo proyecta a 30 días, para que sepas si vas bien sin tener que armar fórmulas en Excel.",
    ],
    faqs: [
      {
        q: "¿Cómo se calcula el RevPAR?",
        a: "De dos formas equivalentes: tarifa promedio × ocupación, o ingresos totales por habitaciones ÷ número de habitaciones disponibles en el periodo.",
      },
      {
        q: "¿Qué es un buen RevPAR?",
        a: "Depende de tu mercado, temporada y tipo de hotel. Lo útil no es el número absoluto sino la tendencia: que tu RevPAR suba mes contra mes y temporada contra temporada.",
      },
    ],
    relacionado: {
      texto: "Calcula tu RevPAR gratis",
      href: "/herramientas/calculadora-tarifa",
    },
  },
  {
    slug: "ota",
    termino: "OTA (agencia de viajes en línea)",
    pregunta: "¿Qué es una OTA?",
    resumen: "Plataformas como Booking o Airbnb que venden tu hotel a cambio de comisión.",
    definicion:
      "Una OTA (Online Travel Agency, o agencia de viajes en línea) es una plataforma como Booking, Airbnb o Expedia que vende habitaciones de hotel a cambio de una comisión por cada reserva, normalmente del 15% al 20%. Llenan el hotel, pero se quedan con parte del ingreso y con la relación con el huésped.",
    cuerpo: [
      "Las OTAs son útiles para darte visibilidad ante viajeros que no te conocen. El problema empieza cuando un hotel depende casi por completo de ellas: cada reserva cuesta una comisión y el huésped queda registrado como cliente de la OTA, no tuyo.",
      "La estrategia sana no es eliminar las OTAs, sino equilibrarlas: usarlas para captar huéspedes nuevos y, al mismo tiempo, mover las reservas directas con tu propia página para reducir la comisión promedio que pagas.",
      "Kora está diseñado para inclinar la balanza hacia las reservas directas sin comisión, conservando lo que las OTAs aportan.",
    ],
    faqs: [
      {
        q: "¿Cuánto cobran de comisión las OTAs?",
        a: "En México suele ir del 15% al 20% por reserva, según la plataforma y el acuerdo. En algunos casos llega a más con programas de visibilidad.",
      },
      {
        q: "¿Conviene salirse de Booking?",
        a: "No necesariamente. Conviene reducir la dependencia: captar más reservas directas para que la comisión promedio que pagas baje, sin perder la visibilidad de las OTAs.",
      },
    ],
    relacionado: {
      texto: "Calcula cuánto pagas en comisiones",
      href: "/herramientas/calculadora-comisiones",
    },
  },
  {
    slug: "cfdi-40",
    termino: "CFDI 4.0",
    pregunta: "¿Qué es el CFDI 4.0?",
    resumen: "La factura electrónica oficial del SAT que tu hotel debe emitir en México.",
    definicion:
      "El CFDI 4.0 (Comprobante Fiscal Digital por Internet, versión 4.0) es la factura electrónica oficial que el SAT exige en México. Desde 2022 es la versión obligatoria e incluye datos como el nombre, RFC y régimen fiscal exactos del cliente. Tu hotel debe poder emitirlo cuando un huésped pide factura.",
    cuerpo: [
      "Para un hotel, emitir facturas a tiempo y sin errores es parte de operar en regla. El CFDI 4.0 es más estricto que versiones anteriores: los datos fiscales del huésped deben coincidir exactamente con su constancia de situación fiscal, o la factura se rechaza.",
      "Muchos sistemas hoteleros extranjeros no emiten CFDI de forma nativa, lo que obliga al hotel a usar un sistema de facturación aparte y a capturar todo dos veces.",
      "Kora integra la facturación CFDI 4.0 directamente con el flujo de reservas, para que factures sin salir del sistema ni duplicar la captura.",
    ],
    faqs: [
      {
        q: "¿Es obligatorio el CFDI 4.0?",
        a: "Sí. Es la versión vigente y obligatoria del comprobante fiscal en México. Todo negocio que emita facturas, incluidos los hoteles, debe usarla.",
      },
      {
        q: "¿Kora emite CFDI?",
        a: "Sí, Kora integra la emisión de CFDI 4.0 con el SAT dentro del mismo sistema, vinculada a tus reservas.",
      },
    ],
    relacionado: {
      texto: "Conoce las características de Kora",
      href: "/caracteristicas",
    },
  },
  {
    slug: "overbooking",
    termino: "Overbooking",
    pregunta: "¿Qué es el overbooking?",
    resumen: "Vender más habitaciones de las que tienes. El error más caro de recepción.",
    definicion:
      "El overbooking ocurre cuando un hotel acepta más reservas de las habitaciones que realmente tiene disponibles para una fecha. Suele pasar por llevar las reservas en cuaderno o Excel, o por no sincronizar la disponibilidad entre canales. Obliga a reubicar o rechazar huéspedes, dañando la reputación del hotel.",
    cuerpo: [
      "Algunas cadenas grandes hacen overbooking a propósito, apostando a que habrá cancelaciones. Pero en un hotel boutique casi siempre es un accidente: dos reservas para la misma habitación que nadie detectó a tiempo.",
      "Las causas más comunes son llevar el control a mano y vender en varios canales (tu web, Booking, Airbnb) sin un inventario sincronizado.",
      "Un PMS con channel manager integrado, como Kora, mantiene un solo inventario y descuenta cada reserva de todos los canales, que es la forma más efectiva de evitar el overbooking accidental.",
    ],
    faqs: [
      {
        q: "¿Cómo se evita el overbooking?",
        a: "Llevando un solo inventario de habitaciones sincronizado entre todos tus canales de venta, en lugar de actualizar cada plataforma a mano. Eso lo hace un PMS con channel manager.",
      },
      {
        q: "¿Qué hago si ya tengo un overbooking?",
        a: "Reubica al huésped en un hotel de categoría similar y asume la diferencia; comunícate con anticipación y honestidad. Lo importante es prevenirlo con un sistema que sincronice tu disponibilidad.",
      },
    ],
    relacionado: {
      texto: "Cómo Kora evita el overbooking",
      href: "/como-funciona",
    },
  },
  {
    slug: "pricing-dinamico",
    termino: "Pricing dinámico",
    pregunta: "¿Qué es el pricing dinámico?",
    resumen: "Ajustar tus tarifas según la demanda para ganar más en temporada alta.",
    definicion:
      "El pricing dinámico (o tarifa dinámica) es la práctica de ajustar el precio de las habitaciones según la demanda: subir en puentes, eventos y temporada alta, y bajar cuando hay poca ocupación. El objetivo es maximizar el ingreso por habitación (RevPAR) en lugar de cobrar la misma tarifa todo el año.",
    cuerpo: [
      "Cobrar la misma tarifa en un martes de febrero que en un puente de Semana Santa deja dinero sobre la mesa. El pricing dinámico responde a la realidad: cuando hay mucha demanda, el precio sube; cuando hay poca, baja para llenar.",
      "Hacerlo a mano es difícil porque hay que vigilar eventos locales, puentes y la ocupación de la zona. Por eso suele apoyarse en software que sugiere o ajusta el precio automáticamente.",
      "Kora incluye pricing dinámico con IA que considera demanda, eventos locales y puentes para sugerir la tarifa óptima de cada noche.",
    ],
    faqs: [
      {
        q: "¿El pricing dinámico solo sube precios?",
        a: "No. También los baja cuando hay poca ocupación para llenar habitaciones que de otro modo quedarían vacías. El objetivo es maximizar el ingreso total, no solo el precio.",
      },
      {
        q: "¿Sirve para hoteles pequeños?",
        a: "Sí. Cualquier hotel con temporadas marcadas o puentes se beneficia de ajustar tarifas. Con software se vuelve práctico incluso operando solo.",
      },
    ],
    relacionado: {
      texto: "Calcula tu tarifa ideal gratis",
      href: "/herramientas/calculadora-tarifa",
    },
  },
];

export function getTermino(slug: string): TerminoGlosario | undefined {
  return glosario.find((t) => t.slug === slug);
}
