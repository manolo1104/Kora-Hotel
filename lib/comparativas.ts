// Comparativas honestas "OTA vs reservas directas con Kora" (pSEO Comparisons).
// Regla de honestidad: comparamos el MODELO de negocio (comisión vs directo),
// no inventamos features ni defectos de la otra plataforma.
import type { FAQ } from "@/lib/glosario";

export interface FilaComparativa {
  aspecto: string;
  ota: string;
  kora: string;
}

export interface Comparativa {
  slug: string;
  competidor: string;
  /**
   * Contra qué se compara, para el titular de la tarjeta del índice.
   * Por defecto "reservas directas": es lo correcto para las OTAs, que fueron
   * las primeras 4 comparativas. Las de categoría (un chatbot de guion, la app
   * de WhatsApp Business, la hoja de cálculo) no compiten contra el canal
   * directo sino contra Kora, y con esto el titular deja de mentir.
   */
  contra?: string;
  titulo: string;
  pregunta: string;
  resumen: string;
  /** Bloque de respuesta de 40-60 palabras al inicio */
  intro: string;
  cuerpo: string[];
  tabla: FilaComparativa[];
  cuandoOta: string[];
  cuandoKora: string[];
  faqs: FAQ[];
}

export const comparativas: Comparativa[] = [
  {
    slug: "booking",
    competidor: "Booking.com",
    titulo: "Booking vs reservas directas: cómo dejar de pagar comisión",
    pregunta: "¿Conviene depender de Booking o tomar reservas directas?",
    resumen:
      "La diferencia real entre vender por Booking y captar reservas directas con tu propia página.",
    intro:
      "Booking llena tu hotel pero cobra una comisión del 15% al 20% por reserva y se queda con la relación con el huésped. Captar reservas directas con tu propia página (como hace Kora) elimina esa comisión y te da los datos del huésped. Lo ideal no es elegir uno: es equilibrarlos.",
    cuerpo: [
      "Booking.com es una OTA excelente para que viajeros que no te conocen te descubran. El costo es la comisión por cada reserva y que el huésped queda registrado como cliente de Booking, no tuyo: su correo y teléfono los controla la plataforma.",
      "Las reservas directas invierten esa ecuación: el huésped reserva en tu página, pagas $0 de comisión y te quedas con sus datos para fidelizarlo. La desventaja es que tienes que atraer tú el tráfico (redes, WhatsApp, recomendaciones, SEO).",
      "Por eso la estrategia sana no es salirte de Booking, sino reducir tu dependencia: usar Booking para captar huéspedes nuevos y mover todo lo que puedas a reservas directas para que tu comisión promedio baje. Kora existe para facilitar justamente ese segundo canal.",
    ],
    tabla: [
      { aspecto: "Comisión por reserva", ota: "15%–20% aprox.", kora: "$0 (reserva directa)" },
      { aspecto: "Dueño de la relación con el huésped", ota: "La plataforma", kora: "Tu hotel" },
      { aspecto: "Datos del huésped (correo/teléfono)", ota: "Limitados", kora: "Tuyos" },
      { aspecto: "Visibilidad ante viajeros nuevos", ota: "Alta", kora: "La generas tú" },
      { aspecto: "Atención", ota: "Reglas de la plataforma", kora: "WhatsApp directo con IA 24/7" },
    ],
    cuandoOta: [
      "Quieres visibilidad ante viajeros que no te conocen.",
      "Estás empezando y aún no tienes tráfico propio.",
      "Buscas llenar fechas de baja ocupación rápido.",
    ],
    cuandoKora: [
      "Quieres dejar de pagar comisión en las reservas que ya eran tuyas.",
      "Te escriben por WhatsApp o redes y quieres cerrar la reserva ahí mismo.",
      "Quieres los datos del huésped para que vuelva.",
    ],
    faqs: [
      {
        q: "¿Tengo que salirme de Booking para usar Kora?",
        a: "No. Kora convive con Booking. La idea es capturar de forma directa (sin comisión) las reservas que hoy se pierden o que de todos modos te buscarían, sin renunciar a la visibilidad de las OTAs.",
      },
      {
        q: "¿Cuánto puedo ahorrar en comisiones?",
        a: "Depende de cuántas reservas muevas a directo. Cada reserva directa te ahorra el 15%–20% que cobraría la OTA. Puedes estimarlo con nuestra calculadora de comisiones gratis.",
      },
    ],
  },
  {
    slug: "airbnb",
    competidor: "Airbnb",
    titulo: "Airbnb vs reservas directas para tu hotel boutique",
    pregunta: "¿Conviene depender de Airbnb o tomar reservas directas?",
    resumen:
      "Qué ganas y qué cedes al vender por Airbnb frente a captar reservas directas.",
    intro:
      "Airbnb te da visibilidad ante viajeros que buscan estancias con carácter, a cambio de comisiones por reserva y de operar bajo sus reglas. Captar reservas directas con tu propia página elimina la comisión y te devuelve el control de precios, atención y la relación con el huésped. Lo mejor es combinar ambos.",
    cuerpo: [
      "Airbnb funciona muy bien para hoteles boutique y propiedades con personalidad, porque su audiencia busca justo eso. El costo es la comisión por reserva y que la comunicación, los precios y las reseñas viven dentro de la plataforma.",
      "Con reservas directas, tú pones las reglas: tarifas, política de anticipo, atención por WhatsApp y la relación de largo plazo con el huésped. A cambio, el tráfico lo generas tú.",
      "Como con cualquier OTA, no se trata de abandonar Airbnb, sino de no depender solo de él. Kora te ayuda a construir el canal directo para bajar tu comisión promedio sin perder lo que Airbnb aporta.",
    ],
    tabla: [
      { aspecto: "Comisión por reserva", ota: "Comisión por reserva", kora: "$0 (reserva directa)" },
      { aspecto: "Control de precios y reglas", ota: "Dentro de la plataforma", kora: "100% tuyo" },
      { aspecto: "Relación con el huésped", ota: "La plataforma", kora: "Tu hotel" },
      { aspecto: "Atención al huésped", ota: "Mensajería de Airbnb", kora: "WhatsApp con IA 24/7" },
      { aspecto: "Visibilidad ante viajeros nuevos", ota: "Alta", kora: "La generas tú" },
    ],
    cuandoOta: [
      "Tu propiedad tiene carácter y encaja con la audiencia de Airbnb.",
      "Quieres alcance internacional sin invertir en marketing propio.",
      "Estás validando demanda para fechas nuevas.",
    ],
    cuandoKora: [
      "Quieres quedarte con la comisión de las reservas directas.",
      "Quieres controlar precios, anticipos y reglas a tu manera.",
      "Quieres atender por WhatsApp y fidelizar al huésped.",
    ],
    faqs: [
      {
        q: "¿Kora reemplaza a Airbnb?",
        a: "No. Lo complementa. Sigues recibiendo reservas de Airbnb mientras construyes tu canal directo sin comisión para bajar lo que pagas en total.",
      },
      {
        q: "¿Puedo cobrar el anticipo en reservas directas?",
        a: "Sí. El motor de reservas de Kora cobra el anticipo en línea para confirmar la reserva, igual que esperarías de una plataforma profesional.",
      },
    ],
  },
  {
    slug: "expedia",
    competidor: "Expedia",
    titulo: "Expedia vs reservas directas para tu hotel",
    pregunta: "¿Conviene depender de Expedia o tomar reservas directas?",
    resumen:
      "Qué ganas y qué cedes al vender por Expedia frente a captar reservas directas sin comisión.",
    intro:
      "Expedia (y su red: Hotels.com, Vrbo) te da alcance ante viajeros internacionales y de paquetes, a cambio de comisiones por reserva y de operar bajo sus reglas y su modelo de pago. Captar reservas directas con tu propio motor elimina la comisión y te devuelve el control de precios y la relación con el huésped. Lo ideal es combinar ambos.",
    cuerpo: [
      "Expedia funciona bien para llegar a viajeros que reservan hotel dentro de un paquete (vuelo + hotel) o que comparan en su buscador, sobre todo del extranjero. El costo es una comisión que suele ir del 15% al 25%, y que los precios, la comunicación y los datos del huésped vivan dentro de su ecosistema.",
      "Además, Expedia maneja modelos de cobro (comisionable o de mercado) y tiempos de pago que a un hotel pequeño le complican el flujo de efectivo. Cada reserva que logras mover a directo no solo te ahorra la comisión: te paga al momento y te deja el contacto del huésped para que regrese.",
      "Con Kora tomas reservas directas desde tu web o WhatsApp, cobras el anticipo con tarjeta al instante y respondes 24/7 con IA. No se trata de salir de Expedia, sino de no depender solo de ella: bajas tu comisión promedio sin perder el alcance que aporta.",
    ],
    tabla: [
      { aspecto: "Comisión por reserva", ota: "15%–25% aprox.", kora: "$0 (reserva directa)" },
      { aspecto: "Tiempo de pago al hotel", ota: "Según el modelo de Expedia", kora: "Anticipo inmediato con tarjeta" },
      { aspecto: "Datos del huésped", ota: "Limitados", kora: "Tuyos" },
      { aspecto: "Control de precios y reglas", ota: "Dentro de la plataforma", kora: "100% tuyo" },
      { aspecto: "Atención al huésped", ota: "Reglas de Expedia", kora: "WhatsApp con IA 24/7" },
    ],
    cuandoOta: [
      "Quieres alcance ante viajeros internacionales y de paquetes.",
      "Buscas visibilidad en un buscador grande sin invertir en marketing propio.",
      "Estás validando demanda para temporadas o mercados nuevos.",
    ],
    cuandoKora: [
      "Quieres quedarte con la comisión de las reservas que ya eran tuyas.",
      "Necesitas que te paguen al momento, no en los tiempos de la OTA.",
      "Quieres los datos del huésped para que vuelva directo.",
    ],
    faqs: [
      {
        q: "¿Tengo que salirme de Expedia para usar Kora?",
        a: "No. Kora convive con Expedia y las demás OTAs. La idea es capturar de forma directa (sin comisión) las reservas que hoy se pierden o que de todos modos te buscarían, sin renunciar al alcance de la plataforma.",
      },
      {
        q: "¿Kora evita el overbooking entre Expedia y mis reservas directas?",
        a: "Sí. Kora sincroniza tu disponibilidad para que no vendas dos veces la misma noche entre tus canales.",
      },
    ],
  },
  {
    slug: "vrbo",
    competidor: "Vrbo",
    titulo: "Vrbo vs reservas directas para tu hospedaje",
    pregunta: "¿Conviene depender de Vrbo o tomar reservas directas?",
    resumen:
      "Qué ganas y qué cedes al vender por Vrbo frente a captar reservas directas con tu propio motor.",
    intro:
      "Vrbo es fuerte para propiedades completas —cabañas, casas y villas— que buscan estancias familiares o de grupo, a cambio de comisiones y de operar bajo sus reglas. Captar reservas directas con tu propio motor elimina la comisión y te da el control de precios y de la relación con el huésped. Lo mejor es combinar ambos canales.",
    cuerpo: [
      "Vrbo (parte de Expedia Group) atrae viajeros que quieren rentar una propiedad completa para su familia o grupo, un perfil muy común en cabañas y ecolodges de destinos de naturaleza. El costo es una comisión por reserva y que la comunicación, los precios y las reseñas vivan dentro de la plataforma.",
      "Para una cabaña o un conjunto de unidades, cada reserva directa vale mucho: además de ahorrarte la comisión, te deja el contacto del huésped y te permite ofrecer estancias más largas o repetidas sin intermediario. El problema suele ser no tener una forma profesional de reservar y cobrar directo.",
      "Kora te da un motor de reservas propio con cobro de anticipo, sincronía con tus OTAs para evitar overbooking y un asistente de IA que contesta 24/7. Así construyes el canal directo sin renunciar al alcance de Vrbo para el grupo que llega por ahí.",
    ],
    tabla: [
      { aspecto: "Comisión por reserva", ota: "Comisión por reserva", kora: "$0 (reserva directa)" },
      { aspecto: "Tipo de propiedad", ota: "Propiedad completa", kora: "Cuartos o unidades, como prefieras" },
      { aspecto: "Datos del huésped", ota: "Limitados", kora: "Tuyos" },
      { aspecto: "Control de precios y reglas", ota: "Dentro de la plataforma", kora: "100% tuyo" },
      { aspecto: "Atención al huésped", ota: "Mensajería de Vrbo", kora: "WhatsApp con IA 24/7" },
    ],
    cuandoOta: [
      "Rentas propiedades completas para familias o grupos.",
      "Quieres alcance ante viajeros que buscan casas y cabañas.",
      "Estás validando demanda para fechas o unidades nuevas.",
    ],
    cuandoKora: [
      "Quieres quedarte con la comisión de las reservas directas.",
      "Ofreces estancias repetidas o de grupo y quieres fidelizar sin intermediario.",
      "Quieres cobrar el anticipo y tener los datos del huésped.",
    ],
    faqs: [
      {
        q: "¿Kora sirve para cabañas que hoy rento por Vrbo?",
        a: "Sí. Kora maneja cuartos o unidades ilimitadas y te da un motor de reservas directas con cobro de anticipo, ideal para cabañas y ecolodges. Convive con Vrbo mientras haces crecer tu canal directo.",
      },
      {
        q: "¿Puedo evitar el overbooking entre Vrbo y mis reservas directas?",
        a: "Sí. Kora sincroniza tu disponibilidad para que no vendas dos veces la misma unidad.",
      },
    ],
  },
  // ─── Comparativas de categoría (no OTAs) ───────────────────────────────────
  // Regla de honestidad: se comparan CATEGORÍAS de solución, sin nombrar
  // proveedores concretos ni atribuirles defectos que no podemos comprobar.
  {
    slug: "chatbot-generico",
    competidor: "Un chatbot genérico",
    contra: "un agente conectado",
    titulo: "Chatbot genérico vs. agente conectado a tu inventario",
    pregunta: "¿Me sirve un chatbot genérico para mi hotel?",
    resumen:
      "Los dos contestan rápido. Sólo uno sabe si tienes cuartos libres esas fechas.",
    intro:
      "Un chatbot genérico responde con textos escritos de antemano y no tiene acceso al inventario del hotel. Un agente conectado consulta la disponibilidad y el precio reales antes de contestar, y puede apartar el cuarto y generar el cobro. La diferencia se nota en la primera pregunta concreta.",
    cuerpo: [
      "Las plataformas de chatbot resuelven bien un problema general: automatizar respuestas repetitivas en cualquier negocio. El costo de esa generalidad es que no saben nada del negocio en particular, y en un hotel lo que el huésped pregunta casi siempre es específico: si hay lugar, cuánto cuesta, para cuántas personas.",
      "Para que un chatbot genérico responda eso, alguien tiene que construir la integración con el sistema del hotel. Eso convierte una compra de software en un proyecto: hay que escribir los flujos, conectarlos y mantenerlos cuando cambien las tarifas.",
      "Un agente que ya vive dentro del sistema hotelero se salta ese paso. Sabe de tu hotel porque consulta el mismo inventario que opera tus reservas, y no hay integración que pagar ni flujos que mantener.",
      "Vale decir lo obvio: si tu necesidad es sólo contestar horarios y ubicación, un chatbot genérico basta. La diferencia importa cuando quieres que la conversación termine en una reserva.",
    ],
    tabla: [
      { aspecto: "Tiempo de respuesta", ota: "Inmediato", kora: "Inmediato" },
      { aspecto: "Sabe tu disponibilidad", ota: "Sólo si alguien construye la integración", kora: "Sí, consulta tu inventario real" },
      { aspecto: "Da el total de una estancia", ota: "Un precio genérico o un rango", kora: "El total real por esas fechas y personas" },
      { aspecto: "Cierra la reserva", ota: "Deja el mensaje para que lo atiendas", kora: "Aparta el cuarto y manda el link de pago" },
      { aspecto: "Implementación", ota: "Proyecto aparte: escribir y conectar flujos", kora: "Incluida en el arranque llave en mano" },
      { aspecto: "Modelo de cobro", ota: "Suele cobrarse por conversación o por agente", kora: "Incluido en el plan de $550 MXN/mes" },
    ],
    cuandoOta: [
      "Sólo necesitas contestar preguntas fijas: horarios, ubicación, si aceptan mascotas.",
      "Tienes quien construya y mantenga la integración con tu sistema.",
      "Quieres automatizar varios negocios distintos con la misma herramienta.",
    ],
    cuandoKora: [
      "Quieres que la conversación termine en una reserva, no en un pendiente.",
      "No tienes equipo técnico para construir y mantener integraciones.",
      "Necesitas que el precio que promete el bot sea el mismo que cobra el sistema.",
    ],
    faqs: [
      {
        q: "Ya probé un chatbot y no funcionó, ¿por qué esto sería distinto?",
        a: "La prueba rápida para distinguirlos: pregúntale por unas fechas concretas con un número raro de personas. Un chatbot de guion da un precio genérico; un agente conectado da el total real de esa estancia y puede cerrarla.",
      },
      {
        q: "¿Puedo tener los dos?",
        a: "Podrías, pero rara vez tiene sentido: un mismo número de WhatsApp lo atiende un solo sistema, y el agente conectado cubre también las preguntas fijas.",
      },
    ],
  },
  {
    slug: "whatsapp-business",
    competidor: "WhatsApp Business",
    contra: "un agente con IA",
    titulo: "WhatsApp Business vs. un agente con IA para tu hotel",
    pregunta: "¿Me basta con WhatsApp Business para atender a mis huéspedes?",
    resumen:
      "La app gratuita es un buen primer paso. Sus automatizaciones avisan, no contestan.",
    intro:
      "WhatsApp Business es la app gratuita de Meta con perfil de negocio, catálogo, etiquetas y respuestas rápidas. Sus automatizaciones son textos fijos: el mensaje de ausencia avisa que no estás, pero no consulta disponibilidad ni cierra reservas. Un agente con IA sí hace ambas cosas.",
    cuerpo: [
      "Todo hotel debería tener WhatsApp Business: es gratis, da perfil de negocio, catálogo y etiquetas para ordenar conversaciones. No hay razón para no usarlo.",
      "El límite aparece en el turno de noche. El mensaje de ausencia —\"gracias por escribir, te contestamos de 9 a 6\"— es honesto, pero le confirma al viajero que ahí no le van a resolver hoy. Y el viajero está comparando en ese momento, no mañana.",
      "Las respuestas rápidas ayudan a escribir más rápido, pero siguen exigiendo que alguien esté ahí para elegirlas. No responden solas ni saben si el cuarto está libre.",
      "Un agente con IA conectado al inventario cubre justo eso: responde a cualquier hora, con los datos reales del hotel, y cierra la reserva con su link de pago. No sustituye a WhatsApp Business: opera sobre el mismo número.",
    ],
    tabla: [
      { aspecto: "Costo", ota: "Gratis", kora: "Incluido en el plan de $550 MXN/mes" },
      { aspecto: "Perfil de negocio y catálogo", ota: "Sí", kora: "Sí (usa el mismo número)" },
      { aspecto: "Contestar fuera de horario", ota: "Un aviso automático", kora: "Responde de verdad, con datos reales" },
      { aspecto: "Consultar disponibilidad", ota: "No", kora: "Sí" },
      { aspecto: "Cotizar una estancia", ota: "A mano, cuando alguien esté", kora: "Automático, con el total real" },
      { aspecto: "Cobrar el anticipo", ota: "Transferencia y comprobante", kora: "Link de pago en el chat" },
    ],
    cuandoOta: [
      "Estás empezando y quieres perfil de negocio sin costo.",
      "Contestas tú y te alcanza el tiempo para responder rápido.",
      "Tu volumen de mensajes todavía es bajo.",
    ],
    cuandoKora: [
      "Se te acumulan mensajes de noche y en fin de semana.",
      "Cotizas de memoria y a veces el precio no cuadra con lo que cobras.",
      "Quieres cobrar el anticipo sin perseguir comprobantes.",
    ],
    faqs: [
      {
        q: "¿Tengo que dejar de usar WhatsApp Business?",
        a: "No. El agente opera sobre tu número de siempre; tu perfil, catálogo y etiquetas siguen igual. Lo que cambia es quién contesta cuando tú no puedes.",
      },
      {
        q: "¿Puedo seguir escribiendo yo desde mi celular?",
        a: "Sí, en cualquier momento. Muchos hoteles usan el agente sólo de noche y fines de semana.",
      },
    ],
  },
  {
    slug: "excel-y-cuaderno",
    competidor: "Excel y el cuaderno",
    contra: "un sistema hotelero",
    titulo: "Excel o cuaderno vs. un sistema hotelero: cuándo dejar de improvisar",
    pregunta: "¿Cuándo deja de alcanzar el Excel para llevar mi hotel?",
    resumen:
      "El método que funciona hasta que llegan dos canales de venta al mismo tiempo.",
    intro:
      "Llevar las reservas en Excel o en cuaderno funciona con pocos cuartos y un solo canal de venta. Deja de funcionar cuando entran reservas por WhatsApp, por tu página y por las OTAs a la vez: nadie puede mantener tres listas sincronizadas a mano, y ahí empieza el overbooking.",
    cuerpo: [
      "Conviene reconocerle a la hoja de cálculo lo que sí hace: es gratis, la entiende cualquiera y no obliga a aprender nada. Muchos hoteles pequeños operan años así sin problema.",
      "El punto de quiebre no es el número de cuartos, es el número de canales. Con un solo canal, una lista basta. Con tres, alguien tiene que copiar cada reserva a las otras dos, y ese alguien un día está manejando o durmiendo.",
      "El costo de ese hueco no se ve en el Excel, se ve en el mostrador: un huésped con reserva y sin cuarto. Un overbooking cuesta la reserva, la reseña y la relación con la OTA.",
      "El segundo costo es más silencioso: sin sistema no hay datos. No sabes tu ocupación real por mes, tu tarifa promedio ni qué canal te trae los huéspedes que sí vuelven.",
    ],
    tabla: [
      { aspecto: "Costo", ota: "Gratis", kora: "$550 MXN/mes, todo incluido" },
      { aspecto: "Varios canales a la vez", ota: "Copiar a mano en cada lista", kora: "Un solo inventario para todos" },
      { aspecto: "Riesgo de overbooking", ota: "Alto en cuanto hay dos canales", kora: "El cuarto se bloquea en todos lados" },
      { aspecto: "Reservas mientras duermes", ota: "No", kora: "Motor de reservas y agente de WhatsApp 24/7" },
      { aspecto: "Métricas del hotel", ota: "Las que armes tú", kora: "Ocupación, ADR, RevPAR y forecast" },
      { aspecto: "Datos del huésped", ota: "Sueltos en la hoja", kora: "CRM que se llena solo" },
    ],
    cuandoOta: [
      "Tienes muy pocos cuartos y vendes por un solo canal.",
      "Tu ocupación es baja y estable, sin temporadas fuertes.",
      "Prefieres no cambiar nada mientras el método no falle.",
    ],
    cuandoKora: [
      "Ya te pasó un overbooking o estuviste cerca.",
      "Vendes por WhatsApp, por tu página y por OTAs a la vez.",
      "Quieres saber tu ocupación y tu tarifa promedio sin armarlas a mano.",
    ],
    faqs: [
      {
        q: "¿Puedo migrar mis reservas actuales?",
        a: "Sí. La migración de tus reservas vigentes es parte del arranque llave en mano; no tienes que capturarlas tú.",
      },
      {
        q: "¿Y si no soy bueno con la tecnología?",
        a: "Kora está hecho para dueños de hotel sin equipo técnico, en español y operable desde el celular. Además el hotel te lo dejamos cargado nosotros.",
      },
    ],
  },
];

export function getComparativa(slug: string): Comparativa | undefined {
  return comparativas.find((c) => c.slug === slug);
}
