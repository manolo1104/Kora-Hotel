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
      "Un PMS (Property Management System) es el software que un hotel usa para gestionar su operación diaria: mapa de habitaciones, reservas, check-in y check-out, tarifas, limpieza (housekeeping) y cobros. Es el cerebro operativo que reemplaza al cuaderno o al Excel y evita errores como el overbooking.",
    cuerpo: [
      "En un hotel pequeño o boutique, el PMS centraliza lo que normalmente está repartido entre una libreta de recepción, una hoja de cálculo y varios WhatsApps. Desde una sola pantalla ves qué habitaciones están ocupadas, quién llega hoy y quién sale, y registras cobros.",
      "Los PMS tradicionales suelen estar en inglés y pensados para cadenas grandes, lo que los hace complejos para un hotel operado por su dueño. Un hotel boutique mexicano necesita algo simple, en español y operable desde el celular.",
      "Kora incluye un PMS pensado para hoteles boutique mexicanos: mapa de habitaciones, check-in/check-out y housekeeping, en español y operable desde el celular.",
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
      "Un buen software de pricing considera demanda, eventos locales y puentes para sugerir la tarifa óptima de cada noche, en lugar de cobrar lo mismo todo el año.",
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
  {
    slug: "reservas-directas",
    termino: "Reservas directas",
    pregunta: "¿Qué son las reservas directas de un hotel?",
    resumen: "Las reservas que el huésped hace contigo, sin pasar por una OTA ni pagar comisión.",
    definicion:
      "Una reserva directa es la que el huésped hace directamente con el hotel —por su página web, WhatsApp, teléfono o en recepción— sin pasar por una OTA como Booking o Airbnb. Al no haber intermediario, el hotel no paga comisión y se queda con el 100% del ingreso y con los datos del huésped.",
    cuerpo: [
      "Cada reserva directa le ahorra al hotel el 15%–20% que cobraría una OTA, y le devuelve la relación con el huésped: su correo y teléfono para invitarlo a volver sin intermediario. Por eso las reservas directas son el canal más rentable de un hotel.",
      "El reto no es querer reservas directas, es tener cómo captarlas: una página con motor de reservas, una forma de cobrar el anticipo y alguien que conteste rápido. Un sistema como Kora reúne esas tres piezas para que el hotel construya su canal directo sin renunciar a la visibilidad de las OTAs.",
    ],
    faqs: [
      {
        q: "¿Cómo consigo más reservas directas?",
        a: "Con un motor de reservas en tu web o redes, respuesta rápida por WhatsApp (idealmente con IA 24/7) y un motivo para reservar contigo (mejor precio o valor que en la OTA). Kora reúne todo eso en un solo sistema.",
      },
      {
        q: "¿Las reservas directas reemplazan a las OTAs?",
        a: "No necesariamente. Lo sano es reducir la dependencia: usar las OTAs para captar huéspedes nuevos y mover a directo todo lo que se pueda para bajar la comisión promedio.",
      },
    ],
    relacionado: {
      texto: "Calcula cuánto pagas en comisiones",
      href: "/herramientas/calculadora-comisiones",
    },
  },
  {
    slug: "comision-ota",
    termino: "Comisión de OTA",
    pregunta: "¿Cuánto es la comisión de una OTA como Booking o Airbnb?",
    resumen: "El porcentaje que una OTA cobra al hotel por cada reserva, típicamente 15%–20%.",
    definicion:
      "La comisión de una OTA (agencia de viajes en línea, como Booking, Expedia o Airbnb) es el porcentaje que la plataforma le cobra al hotel por cada reserva que le trae. En México suele ir del 15% al 25% según la plataforma y el acuerdo. Es el costo de la visibilidad y el tráfico que aporta la OTA.",
    cuerpo: [
      "La comisión se calcula sobre el total de la reserva, así que crece con tu tarifa y tu ocupación. Un hotel que factura $80,000 al mes por OTAs y paga 18% le entrega unos $14,400 mensuales a las plataformas: dinero que ya ganó y que no vuelve.",
      "La comisión no es 'mala' por sí sola —paga la visibilidad ante viajeros que no te conocen—, pero depender solo de las OTAs erosiona el margen. La estrategia sana es mover a reservas directas las que de todos modos te buscarían, para bajar tu comisión promedio.",
    ],
    faqs: [
      {
        q: "¿Puedo negociar la comisión con Booking o Expedia?",
        a: "En parte: hay programas que dan más visibilidad a cambio de más comisión, pero el piso rara vez baja mucho. La palanca real de ahorro es hacer crecer tu canal directo sin comisión.",
      },
      {
        q: "¿Cómo sé cuánto pago de comisión al año?",
        a: "Multiplica tu facturación por OTAs por tu comisión promedio. Puedes estimarlo rápido con la calculadora de comisiones gratis de Kora.",
      },
    ],
    relacionado: {
      texto: "Calcula cuánto pagas en comisiones",
      href: "/herramientas/calculadora-comisiones",
    },
  },
  {
    slug: "tarifa-paritaria",
    termino: "Tarifa paritaria (rate parity)",
    pregunta: "¿Qué es la tarifa paritaria o rate parity?",
    resumen: "La regla de las OTAs de mantener el mismo precio en todos los canales, incluida tu web.",
    definicion:
      "La tarifa paritaria (rate parity) es la cláusula por la que una OTA te pide mantener en tu propia web el mismo precio (o no menor) que publicas en su plataforma. Busca evitar que el hotel use la visibilidad de la OTA y luego venda más barato por su cuenta. Su alcance depende del contrato y de la regulación local.",
    cuerpo: [
      "La paridad limita competir por precio en tu canal directo, pero no te impide ganar el directo por otras vías: valor añadido (late check-out, un extra, atención por WhatsApp), condiciones (anticipo flexible) o simplemente cerrando la reserva en el momento en que el huésped te escribe.",
      "Además, en muchos mercados la 'paridad amplia' se ha ido flexibilizando, y siempre puedes ofrecer beneficios no publicados a quien reserva directo. La clave es tener el canal directo listo para capturar la reserva sin pelear solo por precio.",
    ],
    faqs: [
      {
        q: "¿La tarifa paritaria me impide dar mejor precio en mi web?",
        a: "Puede limitar publicar un precio menor, pero no impide dar valor extra o condiciones mejores a quien reserva directo. Consulta tu contrato con cada OTA.",
      },
      {
        q: "¿Cómo gano reservas directas con paridad de tarifas?",
        a: "Compitiendo en valor y rapidez: contestar al instante, cobrar fácil, ofrecer un extra y cerrar la reserva cuando el huésped te busca por WhatsApp o redes.",
      },
    ],
    relacionado: {
      texto: "Conoce el motor de reservas de Kora",
      href: "/caracteristicas",
    },
  },
  {
    slug: "no-show",
    termino: "No-show",
    pregunta: "¿Qué es un no-show en un hotel?",
    resumen: "Cuando un huésped con reserva confirmada no llega ni cancela, dejando la habitación vacía.",
    definicion:
      "Un no-show ocurre cuando un huésped con reserva confirmada no se presenta ni avisa. La habitación queda vacía y, si no se cobró anticipo ni había política de garantía, el hotel pierde el ingreso de esa noche. Es especialmente costoso en destinos de temporada, donde esa noche pudo venderse a otro.",
    cuerpo: [
      "La mejor defensa contra los no-shows es cobrar un anticipo al confirmar la reserva y tener una política clara de cancelación. Un huésped que ya puso dinero es mucho menos probable que no aparezca, y si lo hace, el hotel no pierde todo.",
      "En reservas directas, un motor que cobra el anticipo con tarjeta al instante reduce los no-shows sin fricción. En Kora, el motor de reservas puede pedir anticipo al confirmar, para asegurar la reserva desde el primer momento.",
    ],
    faqs: [
      {
        q: "¿Cómo reduzco los no-shows en mi hotel?",
        a: "Cobrando un anticipo al reservar, con una política de cancelación clara y recordatorios previos a la llegada. El motor de reservas de Kora cobra anticipo con tarjeta al confirmar.",
      },
      {
        q: "¿Puedo cobrar anticipo también en reservas directas?",
        a: "Sí. En reservas directas con Kora, el motor pide el anticipo al confirmar, igual que esperarías de una plataforma profesional.",
      },
    ],
    relacionado: {
      texto: "Conoce el motor de reservas de Kora",
      href: "/caracteristicas",
    },
  },
];

export function getTermino(slug: string): TerminoGlosario | undefined {
  return glosario.find((t) => t.slug === slug);
}
