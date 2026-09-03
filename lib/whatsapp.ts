// Cluster de contenido del agente de WhatsApp (Camila) — la cuña comercial de Kora.
//
// Por qué existe este archivo: las dos últimas reuniones cerradas entraron por el
// bot de WhatsApp, no por "sistema todo-en-uno". El bot no tenía ni una página
// propia en el sitio; sólo una sección de la home. Esto es la página pilar
// (/whatsapp) más su cola larga (/whatsapp/[slug]).
//
// REGLA DE HONESTIDAD (la misma de lib/comparativas.ts): sólo se afirma lo que
// Camila hace de verdad, verificado contra agentes/camila/brain.js:
//   · checar_disponibilidad → disponibilidad y total REALES, nunca inventados
//   · reservar → aparta el cuarto y genera un link de pago de Stripe
//   · responde en el idioma del huésped, escala a una persona en casos raros
// Nada de "cierra el 80% de las reservas" ni cifras sin fuente.
import type { FAQ } from "@/lib/glosario";

export interface BloqueLista {
  titulo: string;
  texto: string;
}

export interface FilaTabla {
  aspecto: string;
  otro: string;
  kora: string;
}

export interface PaginaWhatsApp {
  slug: string;
  /** H1 de la página */
  titulo: string;
  /** Pregunta-título para metadata y tarjetas ("¿Cómo…?") */
  pregunta: string;
  /** Resumen corto para la tarjeta del índice */
  resumen: string;
  /** Bloque de respuesta de 40-60 palabras: lo primero de la página y lo que citan las IA */
  respuesta: string;
  /** Párrafos de contexto */
  cuerpo: string[];
  /** Bloque de puntos (título + texto) */
  puntos?: BloqueLista[];
  /** Pasos numerados */
  pasos?: BloqueLista[];
  /** Tabla comparativa con encabezado propio */
  tabla?: { encabezado: string; filas: FilaTabla[] };
  faqs: FAQ[];
  /** Enlaces internos relacionados (cluster interno) */
  relacionados?: { texto: string; href: string }[];
}

export const paginasWhatsApp: PaginaWhatsApp[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "bot-whatsapp-hotel",
    titulo: "Bot de WhatsApp para hoteles: qué sí resuelve y qué no",
    pregunta: "¿Cómo funciona un bot de WhatsApp para un hotel?",
    resumen:
      "La diferencia entre un bot de menús y un agente que consulta tu disponibilidad real.",
    respuesta:
      "Un bot de WhatsApp para hotel contesta los mensajes de los huéspedes de forma automática. Los bots de menús sólo devuelven respuestas fijas. Un agente con IA como Camila consulta la disponibilidad y el precio reales de tu hotel, responde en lenguaje natural y genera el link de pago para cerrar la reserva.",
    cuerpo: [
      "Casi todos los hoteles pequeños en México reciben sus reservas por WhatsApp. El problema no es el canal: es que el mensaje llega a las 11 de la noche, un domingo o mientras estás atendiendo el check-in de otro huésped, y la respuesta tarda horas. Para entonces el viajero ya preguntó en tres hoteles más o se fue a Booking.",
      "La reacción común es poner un bot. Y aquí es donde la mayoría se decepciona: los bots de menú (\"escribe 1 para tarifas, 2 para ubicación\") no saben si tienes cuartos libres el 14 de febrero ni cuánto cuestan tres noches para cuatro personas. Contestan rápido y mal, y el huésped se da cuenta a los dos mensajes.",
      "La diferencia real está en si el bot está conectado a tu inventario o no. Camila, el agente de WhatsApp de Kora, no adivina: antes de dar un precio consulta la disponibilidad real de esas fechas en tu sistema y devuelve el total de la estancia con el número de personas que te dijeron. Si el huésped decide, aparta el cuarto y le manda el link de pago.",
      "Eso cambia la naturaleza de la conversación. Ya no es \"te paso información\": es \"te cierro la reserva\". Y cuando el caso se sale de lo normal —un grupo grande, una petición rara, una queja— Camila no inventa: ofrece pasar la conversación con una persona del hotel.",
    ],
    tabla: {
      encabezado: "Bot de menús vs. agente con IA conectado",
      filas: [
        {
          aspecto: "Sabe si tienes cuartos libres",
          otro: "No. Responde lo mismo siempre.",
          kora: "Sí. Consulta la disponibilidad real de esas fechas.",
        },
        {
          aspecto: "Da el precio de la estancia",
          otro: "Un precio genérico o un rango.",
          kora: "El total real por esas noches y ese número de personas.",
        },
        {
          aspecto: "Cierra la reserva",
          otro: "Te deja el mensaje para que lo atiendas tú.",
          kora: "Aparta el cuarto y manda el link de pago.",
        },
        {
          aspecto: "Entiende preguntas fuera de guion",
          otro: "Se pierde y repite el menú.",
          kora: "Responde en lenguaje natural con la info de tu hotel.",
        },
        {
          aspecto: "Cuando no sabe",
          otro: "Contesta cualquier cosa o se queda callado.",
          kora: "Ofrece pasar con una persona del hotel.",
        },
      ],
    },
    faqs: [
      {
        q: "¿El huésped se da cuenta de que habla con una IA?",
        a: "Camila escribe como una recepcionista: frases cortas, tono cálido y en el idioma del huésped. No se presenta como robot, pero tampoco miente si le preguntan directo. Lo que más nota el huésped es que le contestan en segundos.",
      },
      {
        q: "¿Puede inventar un precio o prometer un cuarto que no tengo?",
        a: "No. La regla está en su configuración: nunca da un precio ni confirma lugar sin consultar antes la disponibilidad real. Si la consulta falla, ofrece coordinar directo con el hotel en lugar de improvisar.",
      },
      {
        q: "¿Necesito un número de WhatsApp nuevo?",
        a: "Puedes usar el número que ya tienes. Durante el arranque montamos la conexión contigo; no necesitas configurar nada por tu cuenta.",
      },
    ],
    relacionados: [
      { texto: "Cómo cotiza por WhatsApp con disponibilidad real", href: "/whatsapp/cotizar-por-whatsapp" },
      { texto: "Chatbot vs. agente de IA: la diferencia que importa", href: "/whatsapp/chatbot-vs-agente-ia" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "responder-whatsapp-fuera-de-horario",
    titulo: "Cómo contestar el WhatsApp de tu hotel de noche y en fin de semana",
    pregunta: "¿Cómo contesto los WhatsApp que llegan cuando ya cerré?",
    resumen:
      "El turno de noche es cuando más se pierde. Tres formas de cubrirlo y cuánto cuesta cada una.",
    respuesta:
      "Los mensajes que llegan de noche o en fin de semana son los que más se pierden, porque el viajero está comparando hoteles en ese momento. Se cubre de tres formas: pagando a alguien de guardia, dejando una respuesta automática que sólo avisa, o con un agente de IA que sí contesta y cotiza.",
    cuerpo: [
      "El planteamiento del hotelero suele ser \"ya contestaré mañana temprano\". El problema es que el viajero no está esperando: está en la cama con el celular comparando tres o cuatro opciones a la vez. El primero que responde con un precio concreto se lleva la conversación. A la mañana siguiente tu respuesta llega a alguien que ya reservó en otro lado.",
      "La primera salida es humana: alguien de guardia. Funciona, pero un turno nocturno cuesta más que cualquier software del mercado y para un hotel de 8 a 20 cuartos no se paga solo.",
      "La segunda es la respuesta automática de WhatsApp Business: \"gracias por escribir, te contestamos de 9 a 6\". Es honesto y no cuesta nada, pero no retiene a nadie. Le confirma al viajero que ahí no le van a resolver hoy.",
      "La tercera es un agente conectado a tu inventario. Camila contesta al instante a cualquier hora, resuelve las dudas con la información real de tu hotel —cuartos, amenidades, políticas, cómo llegar—, cotiza esas fechas con disponibilidad real y, si el huésped se decide, le manda el link de pago. Tú lo ves por la mañana ya cerrado.",
    ],
    puntos: [
      {
        titulo: "Contesta en segundos, a cualquier hora",
        texto:
          "No hay horario de atención. El mensaje de las 2 de la mañana recibe respuesta a las 2 de la mañana.",
      },
      {
        titulo: "Con la información real de tu hotel",
        texto:
          "Conoce tus cuartos, capacidades, amenidades, políticas y las preguntas frecuentes que tú cargaste. No improvisa.",
      },
      {
        titulo: "Cierra sin ti",
        texto:
          "Si el huésped quiere reservar, aparta el cuarto y genera el link de pago. Amaneces con el anticipo cobrado.",
      },
      {
        titulo: "Sabe cuándo pasarte la conversación",
        texto:
          "Grupos grandes, peticiones raras o cualquier cosa que no pueda confirmar: ofrece pasar con una persona del hotel.",
      },
    ],
    faqs: [
      {
        q: "¿Y si prefiero contestar yo los mensajes de día?",
        a: "Puedes. Muchos hoteles usan a Camila sólo como turno de noche y fines de semana, y toman ellos la conversación en horario de oficina. Entras al chat cuando quieras y sigues tú.",
      },
      {
        q: "¿Cuánto cuesta comparado con pagar una guardia?",
        a: "Camila viene incluida en el plan de Kora, $550 MXN al mes con todo lo demás. Un turno nocturno humano cuesta varias veces eso al mes.",
      },
    ],
    relacionados: [
      { texto: "Cuánto cuesta cada reserva que se te va a Booking", href: "/herramientas/calculadora-comisiones" },
      { texto: "Cómo recibir reservas por WhatsApp sin pasarlas a mano", href: "/whatsapp/reservas-por-whatsapp" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "cotizar-por-whatsapp",
    titulo: "Cotizar por WhatsApp sin equivocarte en el precio",
    pregunta: "¿Cómo cotizo una estancia por WhatsApp sin errores?",
    resumen:
      "El precio que das a mano y el que cobra tu sistema tienen que ser el mismo. Así se logra.",
    respuesta:
      "Cotizar a mano por WhatsApp genera dos errores caros: dar un precio que no incluye a todos los huéspedes y prometer un cuarto que ya estaba apartado. Un agente conectado a tu inventario consulta la disponibilidad y el total reales antes de responder, así el precio que promete es el que cobra.",
    cuerpo: [
      "La cotización por WhatsApp casi siempre se hace de memoria: \"la matrimonial son $1,200\". Pero $1,200 suele ser la tarifa base de dos personas entre semana. Si van cuatro, si es puente, si son tres noches con una en fin de semana, el total real es otro. El huésped anota el primer número que le diste y ese es el que espera pagar.",
      "El segundo error es peor: prometer disponibilidad que ya no existe. Entre el mensaje de la mañana y el de la tarde alguien reservó ese cuarto por Booking, y tú ya le dijiste al huésped que sí hay.",
      "La forma de cerrar los dos huecos es la misma: que el precio salga del sistema y no de la memoria. Camila consulta la disponibilidad real de esas fechas con el número exacto de personas antes de dar cualquier cifra, y devuelve el total de la estancia. Es el mismo total que cobrará el link de pago.",
      "Si el huésped no te alcanza a dar el número de personas, se lo pregunta antes de cerrar en lugar de asumir. Y si esas fechas piden mínimo de noches, lo dice en vez de aceptar una estancia que tu sistema va a rechazar.",
    ],
    pasos: [
      {
        titulo: "1. El huésped pregunta por unas fechas",
        texto: "\"Hola, ¿tienen para el 14 y 15 de febrero para 4 personas?\"",
      },
      {
        titulo: "2. Camila consulta tu disponibilidad real",
        texto:
          "No responde de memoria: pregunta a tu sistema qué tipos de cuarto quedan libres esas noches y cuánto suman para cuatro personas.",
      },
      {
        titulo: "3. Devuelve el total, no un rango",
        texto:
          "Le da el tipo de cuarto, la capacidad y el total de la estancia. Si hay mínimo de noches o no hay lugar, lo dice ahí mismo y ofrece alternativas.",
      },
      {
        titulo: "4. Cierra con el link de pago",
        texto:
          "Con nombre, correo y teléfono, aparta el cuarto y genera el link de Stripe por el mismo total que cotizó.",
      },
    ],
    faqs: [
      {
        q: "¿Puedo cobrar sólo un anticipo y el resto a la llegada?",
        a: "Sí. El link de pago respeta la política de anticipo que tengas configurada, y Camila le explica al huésped cuánto paga ahora y cuánto al llegar.",
      },
      {
        q: "¿Qué pasa si mis tarifas cambian por temporada?",
        a: "El total sale de tus tarifas vigentes en el sistema, incluidas las de temporada. Si subes precios para Semana Santa, la cotización de esas fechas ya sale con el precio nuevo.",
      },
      {
        q: "¿Y si me equivoqué al cargar una tarifa?",
        a: "Entonces Camila cotizará ese error, porque su fuente es tu sistema. Por eso el arranque incluye que nosotros carguemos y revisemos tus tarifas contigo.",
      },
    ],
    relacionados: [
      { texto: "Calculadora de tarifa por habitación", href: "/herramientas/calculadora-tarifa" },
      { texto: "Cobrar el anticipo por WhatsApp", href: "/whatsapp/cobrar-anticipo-por-whatsapp" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "cobrar-anticipo-por-whatsapp",
    titulo: "Cobrar el anticipo por WhatsApp sin transferencias ni capturas",
    pregunta: "¿Cómo cobro un anticipo por WhatsApp de forma segura?",
    resumen:
      "Se acabó el \"mándame el comprobante\". Un link de pago que confirma solo.",
    respuesta:
      "Cobrar por transferencia obliga a pedir capturas, verificarlas a mano y confiar en que el comprobante es real. Un link de pago con tarjeta resuelve eso: el huésped paga desde el mismo chat, el sistema confirma solo y la reserva queda registrada sin que nadie capture nada.",
    cuerpo: [
      "El cobro por transferencia tiene un costo escondido que casi nadie suma: cada reserva pide mandar la CLABE, esperar, recibir una captura, abrir la app del banco a verificar, y luego capturar la reserva a mano. Son varios minutos por reserva y una puerta abierta a comprobantes falsos.",
      "Y hay un costo peor: la fricción. Entre que mandas los datos y el huésped hace la transferencia pasan horas, y en esas horas se arrepiente o encuentra otra opción. La reserva que ya estaba cerrada se cae.",
      "Con Kora, Camila cierra el ciclo dentro del chat. Cuando el huésped se decide, aparta el cuarto y genera un link de pago de Stripe por el total cotizado. El huésped paga con tarjeta desde su celular, en el mismo WhatsApp donde venía la conversación.",
      "Al pagar, la confirmación sale sola por correo y la reserva queda registrada en tu sistema con los datos del huésped. Tú no capturas nada, no verificas nada y no persigues a nadie.",
    ],
    puntos: [
      {
        titulo: "El cuarto se aparta al generar el link",
        texto:
          "No se lo puede ganar otro mientras el huésped paga. El apartado tiene tiempo límite: si no paga, el cuarto se libera solo.",
      },
      {
        titulo: "Cobra el anticipo que tú definas",
        texto:
          "El link respeta tu política: puede cobrar el total o sólo el anticipo, y Camila le explica al huésped cuánto queda por pagar al llegar.",
      },
      {
        titulo: "La confirmación se manda sola",
        texto:
          "En cuanto entra el pago, el huésped recibe su correo de confirmación y la reserva aparece en tu panel.",
      },
      {
        titulo: "Si el pago falla, no te deja colgado",
        texto:
          "Si el cobro no se puede generar, Camila ofrece coordinar el pago directo con el hotel en lugar de dejar la conversación muerta.",
      },
    ],
    faqs: [
      {
        q: "¿A qué cuenta llega el dinero?",
        a: "A tu cuenta bancaria. Kora conecta tu propia cuenta de Stripe: los cobros de tus huéspedes son tuyos y Kora no se queda comisión por reserva.",
      },
      {
        q: "¿Puedo seguir aceptando transferencias?",
        a: "Sí. El link de pago es una opción más, no un reemplazo obligatorio. Muchos hoteles dejan ambas y el huésped elige.",
      },
      {
        q: "¿Qué pasa si el huésped no paga el link?",
        a: "El apartado vence y el cuarto vuelve a estar disponible automáticamente. No se queda bloqueado por una reserva que nunca se concretó.",
      },
    ],
    relacionados: [
      { texto: "Cuánto anticipo conviene pedir", href: "/herramientas/anticipo" },
      { texto: "Cotizar por WhatsApp con el precio real", href: "/whatsapp/cotizar-por-whatsapp" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "chatbot-vs-agente-ia",
    titulo: "Chatbot vs. agente de IA: por qué uno vende y el otro no",
    pregunta: "¿Cuál es la diferencia entre un chatbot y un agente de IA?",
    resumen:
      "Un chatbot responde. Un agente hace cosas: consulta, aparta y cobra.",
    respuesta:
      "Un chatbot sigue un guion: recibe un mensaje y devuelve una respuesta escrita de antemano. Un agente de IA puede usar herramientas: consulta tu disponibilidad real, aparta un cuarto y genera un link de pago. La diferencia práctica es que el chatbot informa y el agente cierra la reserva.",
    cuerpo: [
      "La palabra \"chatbot\" se usa para todo, y por eso el hotelero que ya probó uno llega escéptico. Con razón: la mayoría de los chatbots del mercado son árboles de decisión. Alguien escribió las respuestas, el bot las repite y en cuanto la pregunta se sale del guion se rompe.",
      "Un agente de IA funciona distinto. Además de conversar en lenguaje natural, tiene herramientas que puede ejecutar. En el caso de Camila son dos, y son las dos que importan en un hotel: consultar disponibilidad y precio reales, y crear la reserva con su link de pago.",
      "Eso es lo que convierte una conversación en un ingreso. Un chatbot te deja un lead que tú tienes que atender después. Un agente te deja un anticipo cobrado y la reserva registrada.",
      "El otro cambio es la honestidad. Un chatbot de guion contesta con lo que tenga escrito aunque no aplique. Camila tiene prohibido inventar precios, disponibilidad o políticas: si la herramienta no lo confirma, no lo promete, y ofrece pasar con una persona del hotel.",
    ],
    tabla: {
      encabezado: "Las dos categorías, lado a lado",
      filas: [
        {
          aspecto: "Cómo responde",
          otro: "Respuestas escritas de antemano, por menú o palabra clave.",
          kora: "Lenguaje natural, con el conocimiento real de tu hotel.",
        },
        {
          aspecto: "Fuera del guion",
          otro: "Se pierde o repite el menú.",
          kora: "Entiende y responde; si no puede, escala a una persona.",
        },
        {
          aspecto: "Acceso a tu inventario",
          otro: "Ninguno.",
          kora: "Consulta disponibilidad y total reales antes de hablar de precio.",
        },
        {
          aspecto: "Qué te deja al final",
          otro: "Un mensaje que tú tienes que atender.",
          kora: "Una reserva apartada con su link de pago.",
        },
        {
          aspecto: "Idiomas",
          otro: "Los que hayas escrito a mano.",
          kora: "Responde en el idioma en que le escriba el huésped.",
        },
      ],
    },
    faqs: [
      {
        q: "Ya probé un bot y fue un desastre, ¿por qué esto sería distinto?",
        a: "Casi seguro probaste un bot de guion. La prueba rápida para distinguirlos: pregúntale por unas fechas concretas con un número raro de personas. Un bot de guion te da un precio genérico; un agente conectado te da el total real de esa estancia.",
      },
      {
        q: "¿Puede hacer cosas fuera de reservar?",
        a: "Responde con la información que cargaste de tu hotel: amenidades, políticas, cómo llegar, recomendaciones de la zona y tus preguntas frecuentes. Para actuar, hoy tiene dos herramientas: cotizar y reservar.",
      },
    ],
    relacionados: [
      { texto: "Bot de WhatsApp para hoteles: qué sí resuelve", href: "/whatsapp/bot-whatsapp-hotel" },
      { texto: "Qué es un agente de IA hotelero", href: "/glosario/agente-ia-hotelero" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "reservas-por-whatsapp",
    titulo: "Cómo recibir reservas por WhatsApp sin capturarlas a mano",
    pregunta: "¿Cómo convierto los WhatsApp en reservas registradas?",
    resumen:
      "El hueco entre la conversación y el sistema es donde se pierden y se duplican reservas.",
    respuesta:
      "El problema de reservar por WhatsApp no es la conversación: es el paso siguiente. Alguien tiene que capturar la reserva en el sistema, y ahí es donde se olvidan, se duplican o se sobrevende. Si el agente crea la reserva directamente, ese paso desaparece.",
    cuerpo: [
      "En la mayoría de los hoteles pequeños, WhatsApp y el sistema de reservas son dos mundos separados. La conversación pasa en el celular y la reserva se anota después en un cuaderno, un Excel o el panel. Cuando hay prisa, ese \"después\" no llega.",
      "El costo se ve en tres formas: reservas que nadie anotó y aparecen el día del check-in, cuartos vendidos dos veces porque la libreta y la OTA no se hablaban, y horas de tu día capturando datos que ya estaban escritos en el chat.",
      "Kora cierra ese hueco haciendo que la reserva nazca dentro de la conversación. Cuando Camila cierra, no te manda un resumen para que lo captures: aparta el cuarto en tu inventario, genera el link de pago y, al pagarse, la reserva ya está registrada con los datos del huésped.",
      "El mismo inventario alimenta tu página de reservas y tu panel. Una reserva cerrada por WhatsApp bloquea ese cuarto en los tres sitios, no sólo en el chat.",
    ],
    puntos: [
      {
        titulo: "Sin doble captura",
        texto: "Los datos que el huésped escribió en el chat entran directo a la reserva. Nadie los vuelve a teclear.",
      },
      {
        titulo: "Sin sobreventa",
        texto:
          "El cuarto se aparta en el momento de generar el link, así que no se puede vender otra vez mientras el huésped paga.",
      },
      {
        titulo: "Todo en el mismo panel",
        texto:
          "Las reservas de WhatsApp, las de tu página y las de las OTAs viven en la misma pantalla, no en tres listas distintas.",
      },
    ],
    faqs: [
      {
        q: "¿Y las reservas que ya cerré yo a mano?",
        a: "Las registras desde el panel en unos segundos y quedan igual de bloqueadas que las automáticas. No tienes que elegir un solo camino.",
      },
      {
        // Decía "Sí" hasta el 2 sep 2026, con la pestaña de canales retirada del
        // panel desde el 26 de agosto. Responder que no —y decir qué sí hace—
        // vende peor un minuto y mejor un año.
        q: "¿Se sincroniza con Booking y Airbnb?",
        a: "Todavía no. Kora se ocupa de tu canal directo: WhatsApp, tu página de reservas y tu calendario propio. Lo que sí hace hoy es quitarte comisión en cada reserva que entra por ahí, que es de donde sale el ahorro.",
      },
    ],
    relacionados: [
      { texto: "Qué es el overbooking y cómo evitarlo", href: "/glosario/overbooking" },
      { texto: "El caso del Hotel Paraíso Encantado", href: "/casos/paraiso-encantado" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "whatsapp-business-api-hotel",
    titulo: "WhatsApp Business, API y agente de IA: cuál necesita tu hotel",
    pregunta: "¿Necesito la API de WhatsApp Business para mi hotel?",
    resumen:
      "Los tres niveles de WhatsApp para hotel, en español y sin jerga.",
    respuesta:
      "WhatsApp tiene tres niveles para un negocio: la app normal, la app Business (gratis, con catálogo y respuestas rápidas) y la API (para conectar software). Un hotel pequeño no necesita contratar la API por su cuenta: necesita que alguien conecte su número a un sistema que sepa contestar.",
    cuerpo: [
      "El tema se vuelve confuso rápido porque mezcla producto y tecnología. Vale la pena separarlo en tres niveles.",
      "**WhatsApp normal.** El de siempre. Funciona, pero un solo dispositivo a la vez y sin ninguna herramienta de negocio. Es donde está la mayoría de los hoteles pequeños.",
      "**WhatsApp Business.** App gratuita con perfil de negocio, catálogo, etiquetas, mensaje de bienvenida y respuestas rápidas. Es un buen paso y no cuesta nada, pero todas sus automatizaciones son textos fijos: no saben si tienes cuartos libres.",
      "**La API de WhatsApp Business.** No es una app: es la vía técnica para que un software conecte con tu número, mande y reciba mensajes. Es lo que permite que un agente de IA opere tu WhatsApp. Contratarla y configurarla por tu cuenta es un proyecto técnico que ningún dueño de hotel debería tener que hacer.",
      "Por eso el planteamiento correcto no es \"¿contrato la API?\", sino \"¿quién me deja el WhatsApp contestando?\". En Kora la conexión de tu número es parte del arranque llave en mano: nosotros la montamos y tú sólo ves las conversaciones.",
    ],
    tabla: {
      encabezado: "Qué resuelve cada nivel",
      filas: [
        {
          aspecto: "Contestar fuera de horario",
          otro: "WhatsApp Business: sólo un aviso automático.",
          kora: "Responde de verdad, cotiza y cierra.",
        },
        {
          aspecto: "Saber tu disponibilidad",
          otro: "No, en ningún nivel por sí solo.",
          kora: "Sí, consulta tu inventario real.",
        },
        {
          aspecto: "Configuración técnica",
          otro: "La API la configuras tú o un proveedor.",
          kora: "Montada en el arranque, sin trabajo técnico de tu parte.",
        },
        {
          aspecto: "Costo",
          otro: "Business gratis; la API se cobra por conversación.",
          kora: "Incluido en el plan de $550 MXN/mes.",
        },
      ],
    },
    faqs: [
      {
        q: "¿Pierdo mis conversaciones anteriores?",
        a: "No. El historial de tu número sigue siendo tuyo. Lo que cambia es quién contesta los mensajes nuevos.",
      },
      {
        q: "¿Puedo seguir escribiendo yo desde mi celular?",
        a: "Sí. Entras a la conversación cuando quieras y sigues tú; el agente está para cubrirte, no para bloquearte.",
      },
      {
        q: "¿Necesito un número distinto al personal?",
        a: "Es lo recomendable: un número del hotel separado del personal. Si hoy usas el mismo, lo vemos en el arranque.",
      },
    ],
    relacionados: [
      { texto: "Qué es la API de WhatsApp Business", href: "/glosario/whatsapp-business-api" },
      { texto: "Plantillas de mensajes para hotel", href: "/herramientas/mensajes-whatsapp" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "automatizar-whatsapp-hotel",
    titulo: "Qué automatizar del WhatsApp de tu hotel (y qué no)",
    pregunta: "¿Qué partes del WhatsApp de un hotel conviene automatizar?",
    resumen:
      "No todo se automatiza. La línea entre lo que gana tiempo y lo que quema huéspedes.",
    respuesta:
      "Conviene automatizar lo repetitivo y verificable: disponibilidad, precios, políticas, cómo llegar y el cobro del anticipo. No conviene automatizar quejas, casos delicados ni grupos grandes: ahí el huésped necesita una persona, y un agente bien hecho sabe cuándo pasarte la conversación.",
    cuerpo: [
      "El error más común al automatizar WhatsApp es pensarlo como todo o nada. O el dueño contesta cada mensaje, o el bot se queda con todo. Ninguno de los dos funciona.",
      "La regla práctica: automatiza lo que sea repetitivo y tenga una respuesta verificable. Si la pregunta se contesta con un dato que está en tu sistema —hay lugar o no, cuánto cuesta, a qué hora es el check-in, si aceptan mascotas—, automatizarla te devuelve horas sin ningún riesgo.",
      "Lo que no conviene automatizar es todo lo que involucra criterio o emoción: una queja, una cancelación difícil, un huésped molesto, una cotización de grupo con condiciones especiales. Ahí el valor de tu hotel es justamente que conteste una persona.",
      "Camila está configurada con esa línea. Resuelve lo repetitivo con datos reales y, cuando el caso se sale de eso, ofrece pasar con una persona del hotel en lugar de improvisar.",
    ],
    puntos: [
      {
        titulo: "Sí automatizar: disponibilidad y precio",
        texto:
          "Es la pregunta más repetida y la que más urge. La respuesta sale de tu inventario, así que no hay riesgo de error.",
      },
      {
        titulo: "Sí automatizar: políticas y logística",
        texto:
          "Horarios de check-in, mascotas, estacionamiento, cómo llegar, qué incluye. Todo lo que hoy contestas veinte veces por semana.",
      },
      {
        titulo: "Sí automatizar: el cobro del anticipo",
        texto:
          "Mandar el link, apartar el cuarto y confirmar el pago no necesita criterio humano y quita minutos por reserva.",
      },
      {
        titulo: "No automatizar: quejas y casos delicados",
        texto:
          "Un huésped molesto necesita que le conteste alguien del hotel. El agente debe reconocerlo y pasártelo.",
      },
      {
        titulo: "No automatizar: grupos y condiciones especiales",
        texto:
          "Bloqueos grandes, bodas o tarifas negociadas se cierran hablando. Camila los deriva en lugar de improvisar un precio.",
      },
    ],
    faqs: [
      {
        q: "¿Cómo sé qué está contestando?",
        a: "Todas las conversaciones quedan en tu panel y puedes leerlas. Es la forma de ir afinando lo que Camila sabe de tu hotel.",
      },
      {
        q: "¿Puedo apagarla en ciertos horarios?",
        a: "Puedes tomar la conversación en cualquier momento. Varios hoteles la usan sólo de noche y fines de semana.",
      },
    ],
    relacionados: [
      { texto: "Cómo cubrir el turno de noche", href: "/whatsapp/responder-whatsapp-fuera-de-horario" },
      { texto: "Generador de respuestas para huéspedes", href: "/herramientas/mensajes-huesped" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "whatsapp-vs-recepcionista-nocturno",
    titulo: "Agente de IA o recepcionista de noche: qué le conviene a un hotel chico",
    pregunta: "¿Me conviene más contratar guardia nocturna o un agente de IA?",
    resumen: "La comparación honesta, incluyendo lo que la IA no puede hacer.",
    respuesta:
      "Una recepción nocturna cubre el WhatsApp y además atiende llegadas tarde, imprevistos y la seguridad del inmueble. Un agente de IA sólo cubre los mensajes, pero lo hace a cualquier hora por una fracción del costo. Para un hotel de menos de 20 cuartos, la IA suele ser el punto de entrada razonable.",
    cuerpo: [
      "Vale la pena decirlo claro: no son lo mismo y no compiten en todo. Una persona en recepción de noche hace cosas que ningún software hace —recibir a quien llega a la 1 de la mañana, resolver una fuga, estar presente si algo pasa—. Si tu hotel necesita eso, necesita a la persona.",
      "Lo que sí es comparable es la parte de mensajes. Ahí la pregunta es cuánto te cuesta cada canal de respuesta y qué tan bien responde.",
      "Un turno nocturno en México, con prestaciones, es un gasto fijo mensual que para un hotel de 8 a 20 cuartos casi nunca se justifica sólo por contestar WhatsApp. Camila viene incluida en el plan de $550 MXN al mes junto con el resto del sistema.",
      "La otra diferencia es la consistencia. Una persona cansada a las 3 de la mañana da el precio de memoria y a veces se equivoca. El agente consulta el sistema cada vez y da el mismo total que cobrará el link de pago.",
    ],
    tabla: {
      encabezado: "Lo que hace cada uno",
      filas: [
        {
          aspecto: "Contestar mensajes de madrugada",
          otro: "Sí, mientras esté despierto.",
          kora: "Sí, en segundos y siempre.",
        },
        {
          aspecto: "Recibir llegadas tarde en persona",
          otro: "Sí. Esto no lo sustituye ningún software.",
          kora: "No.",
        },
        {
          aspecto: "Dar el precio correcto",
          otro: "De memoria; se equivoca cuando hay prisa.",
          kora: "Consulta el sistema en cada cotización.",
        },
        {
          aspecto: "Cobrar el anticipo",
          otro: "Sí, si tiene acceso al sistema.",
          kora: "Sí, con link de pago automático.",
        },
        {
          aspecto: "Costo mensual",
          otro: "Sueldo más prestaciones.",
          kora: "$550 MXN/mes, con todo el sistema incluido.",
        },
      ],
    },
    faqs: [
      {
        q: "¿Puedo tener las dos cosas?",
        a: "Sí, y es lo ideal si tu hotel ya tiene recepción de noche: la persona se dedica a los huéspedes que están en casa y el agente absorbe los mensajes de los que todavía no llegan.",
      },
      {
        q: "¿Qué pasa si el agente se equivoca?",
        a: "Su regla base es no prometer nada que la herramienta no confirme. Cuando no puede resolver, ofrece pasar con una persona del hotel en lugar de inventar.",
      },
    ],
    relacionados: [
      { texto: "Calculadora de punto de equilibrio", href: "/herramientas/punto-de-equilibrio" },
      { texto: "Precios de Kora", href: "/precios" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "whatsapp-en-varios-idiomas",
    titulo: "Atender huéspedes extranjeros por WhatsApp sin hablar su idioma",
    pregunta: "¿Cómo atiendo por WhatsApp a un huésped que escribe en inglés?",
    resumen:
      "El mensaje en inglés a las 11 de la noche no tiene por qué costarte la reserva.",
    respuesta:
      "Un agente de IA responde en el idioma en que le escriba el huésped. Para un hotel en un destino con viajeros extranjeros, eso significa contestar en inglés, francés o alemán a cualquier hora, con la misma disponibilidad y los mismos precios reales, sin que nadie del equipo tenga que traducir.",
    cuerpo: [
      "En destinos como la Huasteca, Bacalar, Oaxaca o San Miguel, una parte de los mensajes llega en inglés. La reacción típica es contestar con traductor, tardarse el doble y responder algo rígido, o de plano dejarlo para cuando esté quien sepa.",
      "El costo es el mismo de siempre pero peor: el viajero extranjero suele estar planeando con más anticipación y comparando más opciones, y valora muchísimo que le contesten con claridad.",
      "Camila responde en el idioma en que le escriben. La información es la misma —tus cuartos, tus tarifas, tu disponibilidad real— pero llega en el idioma del huésped, con el tono de una recepcionista y no de un traductor automático.",
      "Y el cierre también funciona igual: el link de pago admite tarjetas internacionales, así que el huésped de fuera puede dejar su anticipo sin transferencias ni complicaciones bancarias.",
    ],
    faqs: [
      {
        q: "¿Yo puedo leer lo que contestó en inglés?",
        a: "Sí, todas las conversaciones quedan en tu panel tal cual ocurrieron. Puedes revisarlas cuando quieras.",
      },
      {
        q: "¿Qué idiomas maneja?",
        a: "Responde en el idioma en que le escriba el huésped; en la práctica, español e inglés son los que más se usan en hoteles mexicanos.",
      },
      {
        q: "¿Un extranjero puede pagar con su tarjeta?",
        a: "Sí. El cobro va por Stripe, que acepta tarjetas internacionales.",
      },
    ],
    relacionados: [
      { texto: "Para hoteles de playa", href: "/para/hoteles-de-playa" },
      { texto: "Cómo cubrir el turno de noche", href: "/whatsapp/responder-whatsapp-fuera-de-horario" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "cuanto-cuesta-un-bot-de-whatsapp",
    titulo: "Cuánto cuesta poner un bot de WhatsApp en un hotel",
    pregunta: "¿Cuánto cuesta un bot de WhatsApp para un hotel en México?",
    resumen:
      "Los tres modelos de cobro del mercado y dónde están los costos escondidos.",
    respuesta:
      "En México el rango va desde herramientas de respuestas automáticas gratuitas hasta plataformas de chatbot que cobran por conversación o por agente. El costo escondido está en la implementación y en las conversaciones facturadas por la API. En Kora, el agente viene incluido en el plan de $550 MXN al mes.",
    cuerpo: [
      "Cuando un hotelero pide cotización de \"un bot de WhatsApp\", recibe tres tipos de respuesta muy distintos y comparar se vuelve difícil.",
      "**Modelo 1 — gratis, pero de guion.** Las respuestas rápidas y el mensaje de ausencia de WhatsApp Business no cuestan nada. Tampoco resuelven nada más allá de avisar que no estás.",
      "**Modelo 2 — plataforma de chatbot.** Se cobra por mensaje, por conversación o por usuario, con una cuota mensual de plataforma. Se ve barato en la etiqueta y sube con el volumen. Y casi siempre hay que sumar la implementación: alguien tiene que escribir los flujos y conectarlos, y eso se cotiza aparte.",
      "**Modelo 3 — incluido en el sistema del hotel.** El agente es parte del software que ya opera tus reservas, así que no hay integración que pagar ni flujos que escribir: sabe de tu hotel porque vive en tu inventario.",
      "Kora está en el tercero. El agente de WhatsApp viene dentro del plan único de $550 MXN al mes, junto con el motor de reservas, el PMS, el dashboard y el CRM. Sin costo por conversación, sin costo de implementación y sin permanencia.",
    ],
    puntos: [
      {
        titulo: "Pregunta siempre por la implementación",
        texto:
          "Es el costo que no aparece en la página de precios. Escribir los flujos de un chatbot de guion es un proyecto en sí mismo.",
      },
      {
        titulo: "Pregunta si cobran por conversación",
        texto:
          "Un bot que se paga por conversación se vuelve más caro justo en temporada alta, cuando más te escriben.",
      },
      {
        titulo: "Pregunta si se conecta a tu inventario",
        texto:
          "Si no consulta disponibilidad real, estás pagando por un contestador. Es la pregunta que más filtra opciones.",
      },
    ],
    faqs: [
      {
        q: "¿Kora cobra comisión por las reservas que cierra el agente?",
        a: "No. El plan es de $550 MXN al mes y las reservas directas no pagan comisión a Kora. Sólo aplican las comisiones de la procesadora de pagos.",
      },
      {
        q: "¿Hay costo de instalación?",
        a: "No. El arranque llave en mano —cargar tu hotel, cuartos, fotos, tarifas y conectar el WhatsApp— está incluido.",
      },
      {
        q: "¿Puedo probarlo antes de pagar?",
        a: "Sí, hay 30 días gratis sin tarjeta.",
      },
    ],
    relacionados: [
      { texto: "Precios de Kora", href: "/precios" },
      { texto: "Calculadora de comisiones de OTA", href: "/herramientas/calculadora-comisiones" },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "whatsapp-y-booking",
    titulo: "Usar WhatsApp para bajar tu dependencia de Booking",
    pregunta: "¿Cómo uso WhatsApp para conseguir más reservas directas?",
    resumen:
      "El huésped que te encuentra en Booking muchas veces te escribe antes de reservar. Ahí se decide.",
    respuesta:
      "Muchos viajeros descubren tu hotel en una OTA y después te buscan en Google o Instagram para escribirte directo. Si contestas rápido y con un precio concreto, esa reserva entra sin comisión. Si tardas, vuelve a la OTA y se lleva su 15%-20%.",
    cuerpo: [
      "El patrón es más común de lo que parece: el viajero te encuentra en Booking, ve las fotos, y antes de pagar busca tu hotel por nombre para ver si hay algo mejor directo. Te escribe por WhatsApp o Instagram. Ese mensaje vale más que ningún otro, porque es una reserva que ya estaba decidida y que puede entrar sin comisión.",
      "Lo que decide el resultado es la velocidad. Si contestas en minutos con disponibilidad y un total claro, la reserva es tuya. Si contestas en horas, el viajero ya volvió a la OTA porque ahí sí podía cerrar de inmediato.",
      "Aquí está el valor real de tener el WhatsApp contestado: no es ahorrar tiempo, es interceptar reservas que hoy se te van por comisión. Cada una que se convierte en directa te ahorra el 15%-20% que cobraría la OTA.",
      "Y no exige salirte de las OTAs. La estrategia sana es usarlas para que te descubran y tener el canal directo lo bastante afilado para que quien ya te encontró cierre contigo.",
    ],
    pasos: [
      {
        titulo: "1. Haz visible tu WhatsApp",
        texto:
          "En tu página, tu Instagram y tu ficha de Google. Si el viajero no encuentra cómo escribirte, vuelve a la OTA.",
      },
      {
        titulo: "2. Contesta en minutos, no en horas",
        texto:
          "Es la variable que más pesa. Un agente 24/7 cubre las horas en que tú no puedes.",
      },
      {
        titulo: "3. Da un total concreto, no un rango",
        texto:
          "El viajero está comparando contra un precio exacto en la OTA. Un \"desde $1,200\" no compite.",
      },
      {
        titulo: "4. Cierra en el chat",
        texto:
          "Link de pago en la misma conversación. Si lo mandas a otro lado a completar la reserva, lo pierdes.",
      },
    ],
    faqs: [
      {
        q: "¿Puedo ofrecer un precio mejor que en Booking?",
        a: "Muchas OTAs tienen cláusulas de paridad tarifaria, así que conviene revisarlas. Lo que casi siempre sí puedes hacer es dar valor extra en directo: late check-out, un detalle de bienvenida o una cortesía.",
      },
      {
        q: "¿Tengo que dejar las OTAs?",
        a: "No. La meta es bajar la dependencia, no cortarla. Las OTAs siguen sirviendo para que te descubran.",
      },
    ],
    relacionados: [
      { texto: "Booking vs. reservas directas", href: "/comparativas/booking" },
      { texto: "Qué es la tarifa paritaria", href: "/glosario/tarifa-paritaria" },
    ],
  },
];

export function getPaginaWhatsApp(slug: string): PaginaWhatsApp | undefined {
  return paginasWhatsApp.find((p) => p.slug === slug);
}
