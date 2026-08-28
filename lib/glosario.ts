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
  // ─── Bloque IA / WhatsApp (la cuña comercial) ──────────────────────────────
  {
    slug: "agente-ia-hotelero",
    termino: "Agente de IA hotelero",
    pregunta: "¿Qué es un agente de IA para hoteles?",
    resumen: "Una IA que además de conversar puede consultar tu sistema y crear reservas.",
    definicion:
      "Un agente de IA hotelero es un programa que conversa con los huéspedes en lenguaje natural y, a diferencia de un chatbot, puede ejecutar acciones sobre el sistema del hotel: consultar disponibilidad y precios reales, apartar una habitación y generar el cobro. Es la diferencia entre informar y cerrar la reserva.",
    cuerpo: [
      "La palabra clave que separa a un agente de un chatbot es \"herramienta\". Un chatbot devuelve texto escrito de antemano; un agente tiene funciones que puede ejecutar contra un sistema real y decide cuándo usarlas según lo que le pregunten.",
      "En un hotel eso se traduce en dos acciones que valen dinero: consultar la disponibilidad y el total exactos de unas fechas, y crear la reserva con su link de pago. Sin esas dos, el bot sólo produce trabajo pendiente para la recepción.",
      "Camila, el agente de WhatsApp de Kora, funciona así. Tiene prohibido dar un precio o confirmar lugar sin consultar antes el inventario real, y cuando el caso se sale de lo que puede resolver ofrece pasar la conversación con una persona del hotel.",
    ],
    faqs: [
      {
        q: "¿Un agente de IA puede equivocarse en un precio?",
        a: "Si está bien construido, no inventa: el precio sale de la consulta al sistema, no de su memoria. El riesgo real es distinto: si una tarifa está mal cargada en el sistema, el agente la repetirá tal cual.",
      },
      {
        q: "¿Reemplaza a la recepción?",
        a: "No. Cubre lo repetitivo —disponibilidad, precios, políticas, cobro del anticipo— y libera a la persona para lo que sí necesita criterio: quejas, grupos y la atención dentro del hotel.",
      },
    ],
    relacionado: { texto: "Conoce a Camila, el agente de WhatsApp de Kora", href: "/whatsapp" },
  },
  {
    slug: "whatsapp-business-api",
    termino: "API de WhatsApp Business",
    pregunta: "¿Qué es la API de WhatsApp Business?",
    resumen: "La vía técnica que permite que un software conteste tu WhatsApp.",
    definicion:
      "La API de WhatsApp Business es la interfaz que permite que un software envíe y reciba mensajes en un número de WhatsApp de empresa. No es una aplicación que se descargue: es la conexión que hace posible que un sistema —por ejemplo un agente de IA— opere el WhatsApp del negocio.",
    cuerpo: [
      "Conviene separar tres cosas que suelen mezclarse. WhatsApp normal es la app de siempre. WhatsApp Business es una app gratuita con perfil de negocio, catálogo, etiquetas y respuestas rápidas. La API es otra categoría: no se usa, se conecta.",
      "Para un hotel pequeño, contratar y configurar la API por cuenta propia es un proyecto técnico que no aporta valor por sí mismo. Lo que resuelve el problema no es la API, sino el sistema que se conecta a través de ella.",
      "Por eso en Kora la conexión del número forma parte del arranque llave en mano: la montamos nosotros y el hotelero sólo ve las conversaciones en su panel.",
    ],
    faqs: [
      {
        q: "¿La API de WhatsApp Business es gratis?",
        a: "La app WhatsApp Business sí es gratuita. La API se cobra según el volumen de conversaciones, y ese costo lo suele absorber el proveedor del software que la usa.",
      },
      {
        q: "¿Necesito la API para tener un bot?",
        a: "Para que un software conteste tu número de forma estable, sí hace falta una conexión de este tipo. Lo que no hace falta es que la contrates y configures tú.",
      },
    ],
    relacionado: { texto: "Los tres niveles de WhatsApp para hotel", href: "/whatsapp/whatsapp-business-api-hotel" },
  },
  {
    slug: "chatbot-hotelero",
    termino: "Chatbot hotelero",
    pregunta: "¿Qué es un chatbot hotelero?",
    resumen: "El bot de respuestas fijas: contesta rápido, pero no sabe si tienes cuartos.",
    definicion:
      "Un chatbot hotelero es un programa que responde mensajes de huéspedes siguiendo un guion escrito de antemano, normalmente por menús o palabras clave. Contesta al instante, pero no consulta el inventario del hotel: no sabe si hay disponibilidad ni cuánto cuesta realmente una estancia concreta.",
    cuerpo: [
      "Los chatbots resolvieron un problema real: dejar de tener al huésped esperando. El límite aparece en cuanto la pregunta se vuelve concreta, que es justo cuando la conversación vale dinero.",
      "La prueba rápida para saber ante cuál estás: pregúntale por unas fechas específicas con un número raro de personas. Un chatbot de guion devolverá un precio genérico o un rango; un agente conectado devolverá el total real de esa estancia.",
      "Esa distinción importa porque explica por qué muchos hoteleros que ya probaron un bot llegan escépticos: probaron la categoría que informa, no la que cierra.",
    ],
    faqs: [
      {
        q: "¿Sirve de algo un chatbot de guion?",
        a: "Para preguntas fijas —horarios, ubicación, si aceptan mascotas— sí. Deja de servir en cuanto el huésped pregunta por disponibilidad o precio de unas fechas.",
      },
      {
        q: "¿Cuál es la alternativa?",
        a: "Un agente de IA conectado al inventario del hotel, que consulta antes de responder y puede crear la reserva.",
      },
    ],
    relacionado: { texto: "Chatbot vs. agente de IA", href: "/whatsapp/chatbot-vs-agente-ia" },
  },
  {
    slug: "tiempo-de-respuesta",
    termino: "Tiempo de respuesta",
    pregunta: "¿Por qué importa el tiempo de respuesta en un hotel?",
    resumen: "La variable que más decide quién se queda con la reserva.",
    definicion:
      "El tiempo de respuesta es cuánto tarda un hotel en contestar el mensaje de un posible huésped. Importa porque el viajero suele estar preguntando en varios hoteles a la vez: el primero que responde con disponibilidad y un precio concreto entra a la conversación con enorme ventaja.",
    cuerpo: [
      "En un hotel independiente, el tiempo de respuesta no es un indicador de servicio: es un indicador de ventas. El mensaje llega mientras el dueño atiende un check-in, maneja o duerme, y la respuesta se va a las horas.",
      "El problema se concentra en las horas en que nadie contesta: noche, madrugada y fin de semana. Son justo las horas en que la gente planea viajes.",
      "Bajar el tiempo de respuesta a segundos no exige contratar guardias. Un agente de IA cubre esas horas contestando con la información real del hotel y cerrando la reserva si el huésped se decide.",
    ],
    faqs: [
      {
        q: "¿Cuánto es un buen tiempo de respuesta?",
        a: "Cuanto menos, mejor: el viajero que está comparando decide en minutos. Lo que sí es seguro es que responder al día siguiente casi siempre llega tarde.",
      },
      {
        q: "¿Cómo mido el mío?",
        a: "Revisa tus últimas veinte conversaciones de WhatsApp y anota cuánto pasó entre el mensaje del huésped y tu respuesta. Suele ser una sorpresa incómoda.",
      },
    ],
    relacionado: { texto: "Cómo cubrir el turno de noche", href: "/whatsapp/responder-whatsapp-fuera-de-horario" },
  },
  // ─── Bloque operación y métricas ────────────────────────────────────────────
  {
    slug: "adr",
    termino: "ADR (tarifa diaria promedio)",
    pregunta: "¿Qué es el ADR en un hotel?",
    resumen: "Cuánto cobras en promedio por habitación vendida.",
    definicion:
      "El ADR (Average Daily Rate) es la tarifa promedio que cobra un hotel por cada habitación efectivamente vendida en un periodo. Se calcula dividiendo los ingresos por habitación entre el número de habitaciones vendidas. Mide el precio, no el llenado: por eso se lee junto con la ocupación.",
    cuerpo: [
      "El ADR responde a una sola pregunta: ¿a qué precio estoy vendiendo? Si subes tarifas y el ADR no sube, algo se está yendo en descuentos, promociones o tarifas de OTA.",
      "Por sí solo engaña. Un hotel puede tener un ADR altísimo y estar medio vacío. Por eso se combina con la ocupación en un tercer indicador, el RevPAR, que es el que de verdad refleja el desempeño.",
      "Para un hotel boutique, el ADR es la métrica que más conviene defender: bajar precio para llenar suele salir más caro que sostener la tarifa y trabajar la demanda directa.",
    ],
    faqs: [
      {
        q: "¿El ADR incluye impuestos?",
        a: "Normalmente se calcula sobre la tarifa de hospedaje sin impuestos, para que sea comparable entre periodos y entre hoteles.",
      },
      {
        q: "¿Cómo subo mi ADR sin perder ocupación?",
        a: "Trabajando la demanda directa y el valor percibido —fotos, descripción, respuesta rápida— en lugar de competir por precio en las OTAs.",
      },
    ],
    relacionado: { texto: "Calculadora de tarifa por habitación", href: "/herramientas/calculadora-tarifa" },
  },
  {
    slug: "ocupacion",
    termino: "Ocupación hotelera",
    pregunta: "¿Cómo se calcula la ocupación de un hotel?",
    resumen: "El porcentaje de tus habitaciones que se vendieron.",
    definicion:
      "La ocupación es el porcentaje de habitaciones vendidas respecto de las disponibles en un periodo. Se calcula dividiendo habitaciones vendidas entre habitaciones disponibles y multiplicando por cien. Mide el llenado, no la rentabilidad: se puede tener 100% de ocupación regalando la tarifa.",
    cuerpo: [
      "Es la métrica que todo hotelero conoce de memoria y también la que más se malinterpreta. Una ocupación alta sostenida con descuentos agresivos puede dejar menos utilidad que una ocupación media con tarifa firme.",
      "El otro error es medirla sólo en el mes fuerte. La foto útil es la del año completo, porque ahí aparecen los meses en los que hay que trabajar la demanda.",
      "En el panel de Kora la ocupación se ve junto al ADR y al RevPAR, y con un forecast de 30 días para actuar antes de que la fecha llegue vacía.",
    ],
    faqs: [
      {
        q: "¿Qué ocupación es buena para un hotel boutique?",
        a: "Depende del destino y la temporada. Más útil que compararte con un número general es comparar tu mismo mes contra el año anterior.",
      },
      {
        q: "¿Cuento las habitaciones fuera de servicio?",
        a: "Lo habitual es descontarlas de las disponibles, porque no se podían vender. Lo importante es usar siempre el mismo criterio.",
      },
    ],
    relacionado: { texto: "Qué es el RevPAR", href: "/glosario/revpar" },
  },
  {
    slug: "housekeeping",
    termino: "Housekeeping",
    pregunta: "¿Qué es el housekeeping en un hotel?",
    resumen: "La operación de limpieza y el estado real de cada habitación.",
    definicion:
      "Housekeeping es el área encargada de la limpieza y preparación de las habitaciones. En términos de sistema, es el registro del estado de cada cuarto —sucio, limpio, en proceso, listo para vender—, y es lo que evita entregar una habitación que todavía no estaba preparada.",
    cuerpo: [
      "En hoteles pequeños el housekeeping suele coordinarse por WhatsApp o de viva voz, y funciona hasta el día en que hay varias salidas y llegadas a la misma hora. Ahí es cuando se entrega un cuarto sin preparar.",
      "Tener el estado de cada habitación en el sistema resuelve dos cosas: recepción sabe qué puede entregar sin preguntar, y quien limpia sabe qué sigue sin que nadie se lo dicte.",
      "En Kora el estado de limpieza vive en el mismo mapa de habitaciones donde están las reservas, así que la información no está en dos lugares distintos.",
    ],
    faqs: [
      {
        q: "¿Sirve para un hotel de pocas habitaciones?",
        a: "Sirve sobre todo en días de alta rotación. Con ocho cuartos y seis salidas el mismo día, el orden deja de ser memorizable.",
      },
      {
        q: "¿Quien limpia necesita entrar al sistema?",
        a: "Puede hacerlo desde el celular. Si prefieres, recepción actualiza los estados y el equipo sigue trabajando como siempre.",
      },
    ],
    relacionado: { texto: "Conoce el PMS de Kora", href: "/caracteristicas" },
  },
  {
    slug: "impuesto-al-hospedaje",
    termino: "Impuesto al Hospedaje (ISH)",
    pregunta: "¿Qué es el Impuesto al Hospedaje?",
    resumen: "El impuesto estatal que cobras al huésped y enteras a tu estado.",
    definicion:
      "El Impuesto al Hospedaje (ISH) es un impuesto estatal que grava el servicio de alojamiento en México. Lo paga el huésped, pero el hotel es responsable de cobrarlo, desglosarlo y enterarlo a la tesorería de su estado. La tasa varía por entidad, normalmente entre 2% y 5%.",
    cuerpo: [
      "El ISH se calcula sobre la tarifa de hospedaje, es decir sobre la base antes de impuestos, igual que el IVA. Al cotizar conviene mostrarlo desglosado para que el huésped entienda qué está pagando.",
      "El error caro de los hoteles pequeños es cotizar \"precios cerrados\" sin separar impuestos: al final los absorben de su propia utilidad. El error contrario, cobrarlos de más, genera fricción con el huésped.",
      "Como las tasas se actualizan y cambian por estado, conviene confirmar la vigente con tu contador o con la tesorería estatal antes de fijar tus precios de lista.",
    ],
    faqs: [
      {
        q: "¿El ISH es lo mismo que el IVA?",
        a: "No. El IVA es federal (16%, u 8% en la franja fronteriza) y el ISH es estatal, con tasa distinta según la entidad. Ambos se calculan sobre la tarifa de hospedaje.",
      },
      {
        q: "¿Cómo desgloso los dos sin equivocarme?",
        a: "Puedes usar la calculadora gratuita de IVA e Impuesto al Hospedaje de Kora, que separa base, IVA, ISH y total en segundos.",
      },
    ],
    relacionado: { texto: "Calculadora de IVA e Impuesto al Hospedaje", href: "/herramientas/calculadora-impuestos" },
  },
  {
    slug: "anticipo-hotelero",
    termino: "Anticipo o depósito de reserva",
    pregunta: "¿Qué es el anticipo de una reserva de hotel?",
    resumen: "El pago parcial que confirma la reserva y te protege del no-show.",
    definicion:
      "El anticipo es el pago parcial que el huésped hace al reservar para confirmar su estancia; el resto se liquida a la llegada. Su función real no es de flujo de efectivo sino de compromiso: una reserva con anticipo pagado es mucho menos probable que se convierta en un no-show.",
    cuerpo: [
      "Los hoteles pequeños suelen dudar en pedir anticipo por miedo a espantar al huésped. En la práctica pasa lo contrario: pedirlo proyecta profesionalismo y filtra a quien nunca iba a llegar.",
      "El monto correcto depende de tu temporada y tu política de cancelación. Un porcentaje muy bajo no compromete a nadie; uno muy alto frena reservas de última hora.",
      "Lo que sí conviene siempre es que el cobro sea fácil. Pedir transferencia y comprobante mete horas de fricción; un link de pago con tarjeta cierra en el mismo chat.",
    ],
    faqs: [
      {
        q: "¿Cuánto anticipo conviene pedir?",
        a: "Depende de tu temporada, tu política y tu tipo de huésped. Puedes estimarlo con la calculadora de anticipo de Kora.",
      },
      {
        q: "¿El anticipo es reembolsable?",
        a: "Lo define tu política de cancelación, y conviene que esté escrita y visible antes de que el huésped pague.",
      },
    ],
    relacionado: { texto: "Calculadora de anticipo", href: "/herramientas/anticipo" },
  },
  {
    slug: "politica-de-cancelacion",
    termino: "Política de cancelación",
    pregunta: "¿Cómo debe ser la política de cancelación de un hotel?",
    resumen: "Las reglas escritas que evitan discusiones y protegen tus fechas.",
    definicion:
      "La política de cancelación son las reglas que definen hasta cuándo un huésped puede cancelar y qué pasa con su anticipo. Su valor está en estar escrita y visible antes de pagar: es lo que evita discusiones, reembolsos improvisados y reseñas negativas por un malentendido.",
    cuerpo: [
      "En hoteles pequeños la política suele existir sólo en la cabeza del dueño, y se aplica distinto según el día y el huésped. Eso funciona hasta la primera cancelación conflictiva.",
      "Una política clara tiene tres piezas: hasta cuándo se puede cancelar sin costo, qué pasa con el anticipo si se cancela después, y qué se hace en caso de no-show.",
      "Conviene que aparezca en el motor de reservas, en la confirmación por correo y en lo que responde tu agente de WhatsApp, para que sea la misma en los tres lados.",
    ],
    faqs: [
      {
        q: "¿Conviene ser flexible o estricto?",
        a: "Depende de tu temporada. En fechas de alta demanda, una política estricta protege inventario que sí se puede revender; en temporada baja, la flexibilidad ayuda a cerrar.",
      },
      {
        q: "¿Puedo tener políticas distintas por temporada?",
        a: "Sí, y es lo habitual. Lo importante es que la que aplica esté visible antes de que el huésped pague.",
      },
    ],
    relacionado: { texto: "Qué es un no-show", href: "/glosario/no-show" },
  },
  {
    slug: "crm-hotelero",
    termino: "CRM hotelero",
    pregunta: "¿Qué es un CRM para hoteles?",
    resumen: "La base de datos de tus huéspedes, que es lo que las OTAs no te dan.",
    definicion:
      "Un CRM hotelero es el sistema donde el hotel guarda los datos y el historial de sus huéspedes: quién se hospedó, cuándo, cuánto gastó y cómo contactarlo. Es el activo que las OTAs no entregan, y es lo que permite que un huésped vuelva sin pagar comisión otra vez.",
    cuerpo: [
      "Cuando una reserva entra por una OTA, el huésped queda registrado como cliente de la plataforma. Si vuelve, lo hace por el mismo canal y pagas comisión de nuevo por alguien que ya era tuyo.",
      "El CRM invierte eso. Con el correo y el teléfono del huésped puedes escribirle antes de la temporada, ofrecerle una fecha o simplemente agradecerle la visita. Cada regreso directo es una comisión que no pagas.",
      "En Kora el CRM se llena solo con cada reserva directa y alimenta los correos automáticos previos y posteriores a la estancia.",
    ],
    faqs: [
      {
        q: "¿Necesito un CRM si tengo pocos cuartos?",
        a: "Con pocos cuartos importa más, porque cada huésped que vuelve pesa un porcentaje mayor de tu ocupación.",
      },
      {
        q: "¿Puedo tener los datos de huéspedes que llegaron por OTA?",
        a: "Los que la plataforma comparte, sí. Es una de las razones para mover parte del volumen a directo: ahí los datos son tuyos.",
      },
    ],
    relacionado: { texto: "Qué son las reservas directas", href: "/glosario/reservas-directas" },
  },
  {
    slug: "forecast-hotelero",
    termino: "Forecast hotelero",
    pregunta: "¿Qué es un forecast de ocupación?",
    resumen: "La foto de cómo viene tu mes, para actuar antes de que sea tarde.",
    definicion:
      "El forecast hotelero es la proyección de ocupación e ingresos de los próximos días o semanas, con base en las reservas que ya tienes. Su utilidad no es adivinar: es ver con anticipación qué fechas vienen flojas, cuando todavía hay tiempo de hacer algo al respecto.",
    cuerpo: [
      "Sin forecast, el hotelero se entera de que el fin de semana viene vacío el mismo viernes. En ese momento la única palanca que queda es bajar el precio.",
      "Con dos o tres semanas de anticipación las opciones son otras: activar una promoción a tu lista de huéspedes, mover presupuesto de publicidad, empujar en redes o abrir disponibilidad en un canal.",
      "En el panel de Kora el forecast de 30 días vive junto a la ocupación, el ADR y el RevPAR, para que la decisión se tome viendo las cuatro cosas.",
    ],
    faqs: [
      {
        q: "¿Un hotel pequeño necesita forecast?",
        a: "Es donde más rinde: con pocos cuartos, llenar dos noches flojas cambia el mes.",
      },
      {
        q: "¿Qué tan confiable es?",
        a: "Refleja lo que ya está reservado más el ritmo con que suele entrar el resto. No es una predicción exacta, es una alerta temprana.",
      },
    ],
    relacionado: { texto: "Qué es el RevPAR", href: "/glosario/revpar" },
  },
  {
    slug: "walk-in",
    termino: "Walk-in",
    pregunta: "¿Qué es un walk-in en un hotel?",
    resumen: "El huésped que llega sin reserva y decide en la puerta.",
    definicion:
      "Un walk-in es el huésped que llega al hotel sin reserva previa y pide habitación en el momento. Es venta directa sin comisión y sin costo de adquisición, pero exige saber al instante qué hay libre y a qué precio conviene venderlo esa noche.",
    cuerpo: [
      "El walk-in es la reserva más rentable que existe: no pagó comisión, no vino de publicidad y decide en tu recepción. El riesgo es venderlo mal por no tener la información a la mano.",
      "Dos errores típicos: dar una tarifa baja de reflejo cuando el hotel está casi lleno, o rechazar a alguien porque no se sabía que un cuarto se había liberado.",
      "Tener el mapa de habitaciones actualizado en el celular resuelve las dos cosas: se ve qué hay libre esa noche y se cobra en el momento.",
    ],
    faqs: [
      {
        q: "¿Qué tarifa le doy a un walk-in?",
        a: "Depende de tu ocupación de esa noche. Con el hotel casi lleno, no hay razón para descontar; con cuartos libres que ya no se van a vender, cualquier ingreso supera al cuarto vacío.",
      },
      {
        q: "¿Le puedo cobrar con tarjeta?",
        a: "Sí. Con Kora registras la reserva y cobras en el momento desde el panel.",
      },
    ],
    relacionado: { texto: "Descuento máximo que puedes dar", href: "/herramientas/descuento-maximo" },
  },
  {
    slug: "upselling-hotelero",
    termino: "Upselling hotelero",
    pregunta: "¿Qué es el upselling en un hotel?",
    resumen: "Subir el ticket de una reserva que ya tenías.",
    definicion:
      "El upselling hotelero es ofrecer al huésped que ya reservó una mejora de pago: subir de categoría de habitación, agregar noches, un late check-out o una experiencia. Aumenta el ingreso por reserva sin costo de adquisición, porque el huésped ya está decidido.",
    cuerpo: [
      "Es la palanca más barata que tiene un hotel pequeño. No requiere más tráfico, más publicidad ni más reservas: sólo aprovechar la conversación que ya está ocurriendo.",
      "Los momentos que mejor funcionan son dos: justo al cerrar la reserva, cuando el huésped ya aceptó gastar, y unos días antes de la llegada, cuando ya está ilusionado con el viaje.",
      "Lo que lo arruina es ofrecerlo como venta agresiva. Funciona mejor planteado como una opción concreta: la suite está libre esas noches y cuesta X más.",
    ],
    faqs: [
      {
        q: "¿Qué se puede ofrecer en un hotel boutique?",
        a: "Categoría superior, noche extra, late check-out, desayuno, un detalle de bienvenida o una experiencia local. Lo que ya tienes y no te cuesta operar.",
      },
      {
        q: "¿Cuándo lo ofrezco?",
        a: "Al confirmar la reserva y en el correo previo a la llegada. Ambos momentos tienen al huésped con la decisión fresca.",
      },
    ],
    relacionado: { texto: "Correos automáticos previos a la estancia", href: "/caracteristicas" },
  },
  {
    slug: "temporada-alta-y-baja",
    termino: "Temporada alta y temporada baja",
    pregunta: "¿Cómo manejo la temporada baja en mi hotel?",
    resumen: "El calendario que define tus tarifas y dónde está tu verdadero problema.",
    definicion:
      "La temporada alta son los periodos de mayor demanda de un destino —vacaciones, puentes, festividades— y la baja los de menor. Definirlas bien es la base del pricing: permite sostener tarifa cuando hay demanda y trabajar la ocupación cuando no la hay, en lugar de aplicar el mismo precio todo el año.",
    cuerpo: [
      "El error más común es tratar el año como si fuera parejo. Un hotel con una sola tarifa deja dinero en la mesa en temporada alta y se queda vacío en la baja.",
      "El segundo error es reaccionar a la temporada baja sólo con descuentos. Bajar precio atrae a un huésped que no vuelve y castiga tu tarifa promedio del año.",
      "La alternativa es trabajar la demanda: escribirle a tus huéspedes anteriores, armar paquetes con experiencias locales y empujar el canal directo, donde no pagas comisión y el margen aguanta más.",
    ],
    faqs: [
      {
        q: "¿Cómo defino mis temporadas?",
        a: "Mirando tu ocupación real del año anterior mes por mes, más el calendario de puentes y festividades de tu destino.",
      },
      {
        q: "¿Conviene cerrar en temporada baja?",
        a: "Casi nunca. Los costos fijos siguen corriendo y el destino te olvida. Suele rendir más trabajar demanda con margen que cerrar.",
      },
    ],
    relacionado: { texto: "Calendario de puentes y fechas fuertes", href: "/herramientas/calendario-puentes" },
  },
];

export function getTermino(slug: string): TerminoGlosario | undefined {
  return glosario.find((t) => t.slug === slug);
}
