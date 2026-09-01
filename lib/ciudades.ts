// Páginas programáticas por ciudad (pSEO "sistema de reservas para hoteles en {ciudad}").
// Beachhead: la Huasteca Potosina. Cada ciudad lleva contenido LOCAL único (no plantilla
// duplicada) para tener valor real de SEO. Fuente única para /hoteles-en, /hoteles-en/[ciudad],
// el sitemap y los llms.txt.
import type { FAQ } from "@/lib/glosario";

export interface FilaCiudad {
  aspecto: string;
  ota: string;
  kora: string;
}

export interface Ciudad {
  slug: string;
  ciudad: string;
  estado: string;
  /** H1 de la página */
  titulo: string;
  /** Pregunta-título para metadata/tarjetas */
  pregunta: string;
  /** Resumen para la tarjeta del hub */
  resumen: string;
  /** Bloque de respuesta de 40-60 palabras (lo primero, citable por IA) */
  intro: string;
  /** Párrafos de contexto local (uno por entrada) */
  cuerpo: string[];
  faqs: FAQ[];
}

// Tabla OTA vs directo: factual y común a toda la región (la unicidad vive en intro/cuerpo/faqs).
export const TABLA_OTA_DIRECTO: FilaCiudad[] = [
  { aspecto: "Comisión por reserva", ota: "15%–20% aprox.", kora: "$0 (reserva directa)" },
  { aspecto: "Relación con el huésped", ota: "La plataforma", kora: "Tu hotel (para que regrese)" },
  { aspecto: "Datos del huésped (correo/teléfono)", ota: "Limitados", kora: "Tuyos" },
  { aspecto: "Atención fuera de horario", ota: "Reglas de la OTA", kora: "WhatsApp con IA 24/7" },
  { aspecto: "Cobro", ota: "Según la plataforma", kora: "Anticipo con tarjeta, directo" },
  { aspecto: "Puesta en marcha", ota: "—", kora: "Llave en mano en 24 horas" },
];

export const ciudades: Ciudad[] = [
  {
    slug: "xilitla",
    ciudad: "Xilitla",
    estado: "San Luis Potosí",
    titulo: "Sistema de reservas directas para hoteles en Xilitla",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Xilitla?",
    resumen:
      "Software de reservas directas, WhatsApp con IA y operación simple para hoteles y cabañas en Xilitla, SLP.",
    intro:
      "Xilitla, Pueblo Mágico famoso por Las Pozas de Edward James, recibe visitantes todo el año que reservan sobre todo por Booking y Airbnb. Kora le da a tu hotel o cabaña un motor de reservas directas sin comisión y un recepcionista de IA en WhatsApp, para que te quedes con el 100% de cada reserva.",
    cuerpo: [
      "El turismo de Xilitla es de fin de semana y puentes: viajeros que llegan por el jardín surrealista de Las Pozas, el café de altura y la selva. Muchos descubren tu hotel en una OTA y reservan ahí, dejándote una comisión del 15% al 20% en cada noche — justo cuando la ocupación se concentra en pocas fechas y cada reserva cuenta el doble.",
      "La mayoría de los hospedajes en Xilitla son pequeños y operados por su dueño: cabañas, posadas y hoteles boutique donde el mismo dueño contesta el WhatsApp. El problema es que las consultas llegan a cualquier hora —de noche, entre semana— y si nadie responde a tiempo, el huésped termina reservando por Booking de todos modos.",
      "Con Kora pones un motor de reservas en tu propia página o en tu Instagram para captar directo, y Camila —tu recepcionista de IA— contesta 24/7, cotiza y reúne los datos de la reserva mientras tú atiendes el hotel. Nosotros te lo montamos llave en mano en 24 horas; tú solo empiezas a recibir reservas que no pagan comisión.",
    ],
    faqs: [
      {
        q: "¿Kora sirve para una cabaña o un hotel pequeño en Xilitla?",
        a: "Sí. Está pensado justamente para hospedajes independientes operados por su dueño en la Huasteca. Lo instalamos y capacitamos nosotros; si sabes usar tu celular, sabes usar Kora.",
      },
      {
        q: "¿Tengo que dejar Booking o Airbnb?",
        a: "No. Kora convive con tus OTAs: sigues recibiendo huéspedes nuevos por ahí y, a la vez, capturas de forma directa (sin comisión) las reservas que hoy se pierden o que de todos modos te buscarían.",
      },
      {
        q: "¿Cuánto puedo ahorrar en comisiones en temporada alta?",
        a: "Depende de tu tarifa y ocupación. Cada reserva que mueves a directo te ahorra el 15%–20% que cobraría la OTA. Puedes estimarlo con nuestra calculadora de comisiones gratis.",
      },
    ],
  },
  {
    slug: "ciudad-valles",
    ciudad: "Ciudad Valles",
    estado: "San Luis Potosí",
    titulo: "Sistema de reservas directas para hoteles en Ciudad Valles",
    pregunta: "¿Qué software de reservas necesita un hotel en Ciudad Valles?",
    resumen:
      "Reservas directas sin comisión, WhatsApp con IA y PMS para hoteles en Ciudad Valles, el corazón de la Huasteca.",
    intro:
      "Ciudad Valles es la puerta y el corazón de la Huasteca Potosina: base para las Cascadas de Micos, el río Tampaón, el rafting y Tamul. Sus hoteles reciben mucho turismo de aventura que reserva por OTAs. Kora te da reservas directas 0% comisión y atención 24/7 por WhatsApp con IA.",
    cuerpo: [
      "Al ser la ciudad más grande de la región, Valles concentra desde hoteles de paso sobre la carretera hasta hospedajes turísticos para quienes salen a los ríos y cascadas. Ese volumen también significa que las OTAs se llevan una tajada considerable cada mes: en un hotel con buena ocupación, la comisión de Booking y Expedia puede sumar decenas de miles de pesos al año.",
      "El huésped de aventura planea con anticipación y compara precios; muchas veces te escribe por WhatsApp para preguntar disponibilidad y tours antes de reservar. Si no le contestas rápido y no puede reservar y pagar directo, la venta se enfría o se va a una OTA. Ese momento es donde más reservas directas se pierden.",
      "Kora te da un motor de reservas con cobro de anticipo por tarjeta para cerrar esas consultas en el momento, y Camila contesta al instante 24/7 en español. Además operas todo el hotel —calendario, huéspedes, tarifas por temporada— desde una sola pantalla. Lo dejamos listo en 24 horas, sin que toques nada técnico.",
    ],
    faqs: [
      {
        q: "¿Kora funciona para un hotel de varios cuartos en Ciudad Valles?",
        a: "Sí, con habitaciones ilimitadas en un solo plan. Incluye PMS, calendario, tarifas por temporada y un dashboard con tu ocupación y tus ingresos por canal.",
      },
      {
        q: "¿Puedo cobrar el anticipo de la reserva directa?",
        a: "Sí. El motor de reservas cobra el anticipo con tarjeta al confirmar, para que asegures la reserva y bajes los no-shows, sin depender de la OTA.",
      },
      {
        q: "¿Sirve para un hotel que también recibe huéspedes de paso?",
        a: "Sí. Kora te ayuda a capturar reservas directas por WhatsApp y web, y a operar el día a día; convive con Booking/Expedia para el turismo de paso que llega por esas plataformas.",
      },
    ],
  },
  {
    slug: "aquismon",
    ciudad: "Aquismón",
    estado: "San Luis Potosí",
    titulo: "Sistema de reservas directas para hoteles y cabañas en Aquismón",
    pregunta: "¿Cuál es el mejor sistema de reservas para hospedajes en Aquismón?",
    resumen:
      "Motor de reservas directas y WhatsApp con IA para hoteles, cabañas y ecolodges en Aquismón, SLP.",
    intro:
      "Aquismón concentra algunos de los grandes atractivos de la Huasteca: la Cascada de Tamul, el Sótano de las Golondrinas y el Puente de Dios. Sus hospedajes —muchos ecolodges y cabañas— dependen de las OTAs. Kora te da reservas directas sin comisión y atención 24/7 por WhatsApp con IA.",
    cuerpo: [
      "El turismo de Aquismón es de naturaleza y aventura: viajeros que van a Tamul en lancha, al Sótano de las Golondrinas de madrugada o a nadar al Puente de Dios. Muchos hospedajes son cabañas y ecolodges en zonas de baja señal, operados por familias, que reciben la mayoría de sus reservas por Airbnb y Booking pagando comisión.",
      "Ese perfil de huésped pregunta mucho antes de reservar: cómo llegar, qué tours hay, si hay que madrugar. Esas consultas caen por WhatsApp a toda hora y, si no se contestan, se pierde la reserva. Para un ecolodge pequeño, cada reserva directa que se convierte vale mucho más que su comisión.",
      "Con Kora montas un motor de reservas propio y Camila contesta esas dudas 24/7, cotiza y reúne los datos para cerrar la reserva directa. Sincroniza con tus OTAs para no tener overbooking y te deja operar todo desde el celular. Lo instalamos llave en mano en 24 horas, incluso si eres una cabaña familiar sin experiencia técnica.",
    ],
    faqs: [
      {
        q: "¿Kora sirve para un ecolodge o cabañas en Aquismón?",
        a: "Sí. Está diseñado para hospedajes independientes de la Huasteca, incluyendo cabañas y ecolodges. Habitaciones (o unidades) ilimitadas en un solo plan, instalado y con soporte por WhatsApp.",
      },
      {
        q: "¿Camila puede contestar dudas de cómo llegar o de los tours?",
        a: "Camila contesta 24/7 con la información que tú le cargues (precios, políticas, cómo llegar, qué incluye) y reúne los datos del huésped para cerrar la reserva. Los casos especiales los pasa contigo.",
      },
      {
        q: "¿Evita el overbooking entre mi cabaña y las OTAs?",
        a: "Sí. Kora sincroniza tu disponibilidad con Booking y Airbnb para que no vendas dos veces la misma noche.",
      },
    ],
  },
  {
    slug: "tamasopo",
    ciudad: "Tamasopo",
    estado: "San Luis Potosí",
    titulo: "Sistema de reservas directas para hoteles y cabañas en Tamasopo",
    pregunta: "¿Qué sistema de reservas conviene a un hospedaje en Tamasopo?",
    resumen:
      "Reservas directas sin comisión y WhatsApp con IA para hoteles, cabañas y balnearios en Tamasopo, SLP.",
    intro:
      "Tamasopo es famoso por sus cascadas de agua turquesa, el Puente de Dios y El Trampolín. Es un destino de temporada alta muy marcada, donde los hospedajes llenan en Semana Santa y verano. Kora te da reservas directas 0% comisión para quedarte con más de cada reserva en tus mejores fechas.",
    cuerpo: [
      "El turismo de Tamasopo se dispara en puentes, Semana Santa y verano, cuando las familias llegan a las cascadas y balnearios. Esa estacionalidad hace que la comisión de las OTAs pese aún más: si la mayor parte de tu ingreso anual entra en pocas semanas, cada 18% que se lleva Booking en esas fechas es dinero que ya no recuperas.",
      "Muchos hospedajes en Tamasopo son cabañas y hoteles familiares que además manejan tarifas distintas según la temporada. Llevar eso a mano en un cuaderno o en varias apps es un lío, y contestar el WhatsApp en plena temporada alta —mientras atiendes a los huéspedes— es casi imposible.",
      "Kora te da un motor de reservas con tarifas por temporada, para que cobres el precio correcto en cada fecha automáticamente, y Camila contesta 24/7 para no perder reservas en tus semanas fuertes. Todo en una sola pantalla, montado llave en mano en 24 horas.",
    ],
    faqs: [
      {
        q: "¿Kora maneja tarifas distintas por temporada?",
        a: "Sí. Configuras precios por fecha (temporada alta, puentes, entre semana) y el motor cobra la tarifa correcta en cada reserva, sin que tengas que cambiarlo a mano.",
      },
      {
        q: "¿Sirve para una cabaña o balneario con hospedaje en Tamasopo?",
        a: "Sí. Está pensado para hospedajes independientes de la Huasteca. Lo instalamos y capacitamos nosotros; se opera desde el celular.",
      },
      {
        q: "¿Me ayuda a no saturarme el WhatsApp en Semana Santa?",
        a: "Camila contesta al instante 24/7, cotiza y reúne los datos de la reserva, para que no pierdas consultas en tus semanas de mayor demanda.",
      },
    ],
  },
  {
    slug: "tamazunchale",
    ciudad: "Tamazunchale",
    estado: "San Luis Potosí",
    titulo: "Sistema de reservas directas para hoteles en Tamazunchale",
    pregunta: "¿Qué software de reservas necesita un hotel en Tamazunchale?",
    resumen:
      "Reservas directas, WhatsApp con IA y PMS para hoteles en Tamazunchale, la puerta sur de la Huasteca.",
    intro:
      "Tamazunchale, la puerta sur de la Huasteca sobre la carretera México-Laredo, mezcla turismo de naturaleza con mucho huésped de paso y de negocios. Sus hoteles reciben reservas por OTAs y por teléfono. Kora te da reservas directas sin comisión y atención 24/7 por WhatsApp con IA.",
    cuerpo: [
      "Por su ubicación sobre una carretera de mucho tránsito, los hoteles de Tamazunchale combinan huésped de paso, viajeros de negocios y turistas que exploran la Huasteca. Ese flujo constante hace fácil depender de las OTAs y de las llamadas, y perder de vista cuánto se va en comisiones cada mes.",
      "El huésped de paso muchas veces busca en Google o en Booking a última hora y reserva desde el celular. Si tu hotel no aparece con una opción de reservar directo —o nadie contesta el WhatsApp— la reserva se va a la OTA y pagas su comisión por un huésped que ya te había encontrado.",
      "Kora te da un motor de reservas directas para captar esas reservas de último minuto sin comisión, y Camila contesta 24/7 para cerrar las consultas por WhatsApp. Operas el hotel completo —calendario, huéspedes, cobros— desde una pantalla, y lo dejamos listo en 24 horas.",
    ],
    faqs: [
      {
        q: "¿Kora sirve para un hotel con mucho huésped de paso?",
        a: "Sí. Te ayuda a captar reservas directas de último minuto por web y WhatsApp, y a operar el día a día. Convive con las OTAs para el tráfico que llega por esas plataformas.",
      },
      {
        q: "¿Necesito una página web para usar el motor de reservas?",
        a: "No necesariamente. Puedes crear gratis una mini-página de reservas con tu marca, o embeber el motor en la página que ya tengas. Si quieres, también te hacemos un sitio profesional como servicio aparte.",
      },
      {
        q: "¿Qué tan rápido queda funcionando?",
        a: "Lo montamos llave en mano en 24 horas: cargamos tus cuartos, fotos y tarifas, y te capacitamos. Tú no tocas nada técnico.",
      },
    ],
  },
  {
    slug: "el-naranjo",
    ciudad: "El Naranjo",
    estado: "San Luis Potosí",
    titulo: "Sistema de reservas directas para hoteles y cabañas en El Naranjo",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hospedaje en El Naranjo?",
    resumen:
      "Motor de reservas directas y WhatsApp con IA para hoteles, cabañas y ecolodges en El Naranjo, SLP.",
    intro:
      "El Naranjo es un destino de naturaleza en la Huasteca, con las cascadas El Salto, El Meco, El Trampolín y Minas Viejas. Sus hospedajes —cabañas y ecolodges— viven del turismo de fin de semana que reserva por OTAs. Kora te da reservas directas 0% comisión y atención 24/7 por WhatsApp con IA.",
    cuerpo: [
      "El turismo de El Naranjo gira alrededor de sus cascadas y ríos, con visitantes que llegan en puentes y vacaciones a acampar o quedarse en cabañas. Muchos hospedajes son pequeños, en entornos naturales, y reciben la mayoría de sus reservas por Airbnb y Booking pagando comisión sobre cada noche.",
      "Como en el resto de la Huasteca, el huésped pregunta primero por WhatsApp: disponibilidad, cómo llegar, qué cascadas visitar. Si esas consultas no se contestan a tiempo —o no hay forma de reservar y pagar directo— la reserva se enfría o termina en una OTA con su comisión.",
      "Kora te da un motor de reservas propio con cobro de anticipo y Camila contestando 24/7, para convertir esas consultas en reservas directas. Sincroniza con tus OTAs para evitar overbooking y te deja operar desde el celular. Lo montamos llave en mano en 24 horas.",
    ],
    faqs: [
      {
        q: "¿Kora sirve para cabañas o un ecolodge en El Naranjo?",
        a: "Sí. Está diseñado para hospedajes independientes de la Huasteca, incluyendo cabañas y ecolodges, con unidades ilimitadas en un solo plan.",
      },
      {
        q: "¿Puedo cobrar anticipo para asegurar la reserva?",
        a: "Sí. El motor cobra el anticipo con tarjeta al confirmar, lo que reduce los no-shows tan comunes en destinos de fin de semana.",
      },
      {
        q: "¿Convive con Airbnb y Booking?",
        a: "Sí. Kora sincroniza tu disponibilidad con las OTAs para no tener overbooking, mientras tú haces crecer el canal directo sin comisión.",
      },
    ],
  },
  {
    slug: "huasteca-potosina",
    ciudad: "la Huasteca Potosina",
    estado: "San Luis Potosí",
    titulo: "Kora para hoteles de la Huasteca: guía por destino y temporada",
    pregunta: "¿Kora funciona para hoteles en toda la Huasteca Potosina?",
    resumen:
      "Guía regional: por qué los hospedajes de la Huasteca —de Xilitla a El Naranjo— ganan con reservas directas, y cómo Kora se adapta a su temporada.",
    intro:
      "La Huasteca Potosina —Xilitla, Ciudad Valles, Aquismón, Tamasopo, El Naranjo y más— es uno de los destinos de naturaleza que más crecen en México. Sus hospedajes dependen fuerte de las OTAs y de una temporada muy marcada. Kora le da a tu hotel reservas directas 0% comisión y un recepcionista de IA en WhatsApp 24/7.",
    cuerpo: [
      "El turismo de la Huasteca es estacional y de aventura: cascadas, ríos, grutas y pueblos mágicos que se llenan en Semana Santa, puentes y verano. Esa concentración hace que cada reserva de temporada alta valga mucho, y que la comisión del 15% al 20% de Booking, Airbnb o Expedia sea un costo enorme en las semanas que sostienen todo el año.",
      "La mayoría de los hospedajes de la región son independientes y operados por su dueño —hoteles boutique, cabañas, ecolodges— donde el mismo dueño contesta el WhatsApp mientras atiende a los huéspedes. El resultado son consultas que se pierden fuera de horario, tarifas por temporada llevadas a mano y una dependencia cara de las plataformas.",
      "Kora reúne en un solo sistema, en español y montado llave en mano en 24 horas, todo lo que un hospedaje de la Huasteca necesita: motor de reservas directas sin comisión, Camila (WhatsApp con IA 24/7), tarifas por temporada, sincronía con las OTAs para evitar overbooking y un dashboard para ver tu ocupación y tus ingresos. Es el mismo sistema que ya opera al Hotel Paraíso Encantado en Xilitla.",
    ],
    faqs: [
      {
        q: "¿Kora funciona para cualquier tipo de hospedaje en la Huasteca?",
        a: "Sí: hoteles boutique, posadas, cabañas y ecolodges independientes, operados por su dueño. Un solo plan con habitaciones (o unidades) ilimitadas, instalado y con soporte por WhatsApp.",
      },
      {
        q: "¿Me ayuda con la temporada alta de la Huasteca?",
        a: "Sí. Con tarifas por temporada cobras el precio correcto en cada fecha, y Camila contesta 24/7 para no perder reservas en Semana Santa, puentes y verano.",
      },
      {
        q: "¿Tengo que dejar Booking o Airbnb?",
        a: "No. Kora convive con tus OTAs y sincroniza tu disponibilidad; la idea es hacer crecer el canal directo (sin comisión) sin renunciar a la visibilidad de las plataformas.",
      },
      {
        q: "¿Hay un caso real en la Huasteca?",
        a: "Sí. El Hotel Paraíso Encantado, en Xilitla, opera con Kora y en sus primeros 3 meses recibió $120,000 en reservas directas. Puedes ver el caso en el sitio.",
      },
    ],
  },
  // ─── Expansión fuera de la Huasteca ────────────────────────────────────────
  // Criterio: sólo destinos con hotelería boutique independiente real y un
  // ángulo local propio. Nada de plantillas por ciudad donde no hay a quién
  // venderle: eso son doorway pages y Google las castiga desde 2024.
  {
    slug: "san-miguel-de-allende",
    ciudad: "San Miguel de Allende",
    estado: "Guanajuato",
    titulo: "Sistema de reservas directas para hoteles boutique en San Miguel de Allende",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel boutique en San Miguel de Allende?",
    resumen:
      "Motor de reservas sin comisión y WhatsApp con IA para hoteles boutique y casas de huéspedes en San Miguel.",
    intro:
      "San Miguel de Allende concentra una de las mayores densidades de hotelería boutique independiente de México, con mucho huésped extranjero que reserva por OTA. Kora te da un motor de reservas directas sin comisión y un agente de WhatsApp con IA que responde en el idioma del huésped, para quedarte con el 100% de cada reserva.",
    cuerpo: [
      "San Miguel vive de un huésped que planea con anticipación, compara mucho y llega con expectativas altas de servicio. Ese perfil es exactamente el que reserva por OTA: descubre el hotel en la plataforma, ve reseñas, y cierra ahí. Cada una de esas noches deja entre 15% y 20% en comisión.",
      "El otro rasgo del destino es el peso del visitante extranjero, sobre todo estadounidense y canadiense. Muchos mensajes llegan en inglés y a horarios que no coinciden con la recepción, y responder tarde o con un traductor rígido cuesta reservas de ticket alto.",
      "Con Kora tu hotel toma reservas directas desde su propia página con cobro de anticipo con tarjeta —incluidas tarjetas internacionales— y Camila contesta el WhatsApp las 24 horas en el idioma en que le escriban, con tu disponibilidad y tus precios reales. Nosotros lo montamos llave en mano.",
    ],
    faqs: [
      {
        q: "¿Sirve para una casa de huéspedes de pocas habitaciones?",
        a: "Sí. El plan es único e incluye habitaciones ilimitadas, así que un hospedaje de 5 cuartos paga lo mismo que uno de 30: $550 MXN al mes.",
      },
      {
        q: "¿Puede atender a mis huéspedes en inglés?",
        a: "Sí. Camila responde en el idioma en que le escriba el huésped, con la misma disponibilidad y los mismos precios reales de tu hotel.",
      },
      {
        q: "¿Tengo que salirme de Booking o Airbnb?",
        a: "No. Kora convive con las OTAs y sincroniza el calendario para evitar overbooking. La idea es bajar tu dependencia, no cortarla de golpe.",
      },
    ],
  },
  {
    slug: "bacalar",
    ciudad: "Bacalar",
    estado: "Quintana Roo",
    titulo: "Sistema de reservas directas para hoteles y cabañas en Bacalar",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Bacalar?",
    resumen:
      "Reservas directas sin comisión y WhatsApp con IA para hospedajes frente a la Laguna de los Siete Colores.",
    intro:
      "Bacalar creció como destino de hospedaje pequeño e independiente —cabañas, hoteles boutique y proyectos ecológicos frente a la laguna— con altísima dependencia de OTAs. Kora te da motor de reservas directas sin comisión, agente de WhatsApp con IA 24/7 y sincronización con Booking y Airbnb para evitar overbooking.",
    cuerpo: [
      "La hotelería de Bacalar es mayoritariamente pequeña y de dueño, y creció rápido apoyada en las plataformas. Eso dejó a muchos hospedajes con casi todo su volumen entrando por OTA: buena ocupación, margen delgado y ninguna relación propia con el huésped que ya vino.",
      "Al ser un destino de estancias cortas y alta rotación entre semana, el WhatsApp se vuelve el canal donde se decide todo: disponibilidad de esta noche, si queda cabaña para dos, si aceptan mascotas. Cuando el mensaje llega a las once de la noche y nadie contesta, el viajero reserva en la app.",
      "Con Kora ese mensaje sí recibe respuesta: Camila consulta tu disponibilidad real, da el total de la estancia y manda el link de pago. Y como el inventario es uno solo, la reserva que entra por WhatsApp cierra esa fecha también en las OTAs.",
    ],
    faqs: [
      {
        q: "¿Funciona para cabañas y hospedajes ecológicos?",
        a: "Sí. El sistema no asume un tipo de propiedad: cargamos tus unidades como las tengas —cabañas, domos, habitaciones— con su capacidad y tarifa.",
      },
      {
        q: "¿Cómo evito el overbooking con Booking y Airbnb?",
        a: "Kora sincroniza el calendario con las OTAs, así una reserva directa bloquea esa fecha en todos los canales.",
      },
      {
        q: "¿Cuánto tarda el arranque?",
        a: "Montamos tu hotel completo —unidades, fotos, tarifas, motor y WhatsApp— en 24 horas, sin costo de instalación.",
      },
    ],
  },
  {
    slug: "valle-de-bravo",
    ciudad: "Valle de Bravo",
    estado: "Estado de México",
    titulo: "Sistema de reservas directas para hoteles en Valle de Bravo",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Valle de Bravo?",
    resumen:
      "Motor de reservas sin comisión y WhatsApp con IA para hoteles boutique y cabañas de Valle.",
    intro:
      "Valle de Bravo concentra su demanda en fines de semana y puentes desde la Ciudad de México, con reservas que se deciden por WhatsApp a última hora. Kora te da motor de reservas directas sin comisión y un agente con IA que contesta al instante, cotiza con disponibilidad real y cobra el anticipo.",
    cuerpo: [
      "Valle es un destino de escapada corta: el huésped decide el jueves para el viernes, pregunta por WhatsApp y quiere respuesta ya. Quien contesta primero con un precio concreto se lleva la reserva; quien contesta el sábado ya perdió.",
      "Esa concentración en fines de semana y puentes hace que cada fecha fuerte pese muchísimo en el mes. Una noche mal vendida —o una reserva que se cayó por no contestar— no se recupera entre semana.",
      "Kora ataca justo ese momento: Camila responde en segundos a cualquier hora, consulta qué queda libre ese fin de semana, da el total real y manda el link de pago para apartar. Y el calendario de puentes del panel te deja ver con anticipación qué fechas vienen flojas.",
    ],
    faqs: [
      {
        q: "¿Sirve para cabañas y casas completas?",
        a: "Sí. Cargamos cada unidad con su capacidad, tarifa y mínimo de noches, que en Valle suele aplicar en fines de semana y puentes.",
      },
      {
        q: "¿Puedo poner mínimo de noches en fechas fuertes?",
        a: "Sí, y el agente lo respeta: si el huésped pide una sola noche en una fecha con mínimo, se lo dice en vez de aceptar algo que el sistema va a rechazar.",
      },
    ],
  },
  {
    slug: "oaxaca",
    ciudad: "Oaxaca de Juárez",
    estado: "Oaxaca",
    titulo: "Sistema de reservas directas para hoteles boutique en Oaxaca",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Oaxaca?",
    resumen:
      "Reservas directas sin comisión y WhatsApp con IA para hoteles boutique del centro histórico de Oaxaca.",
    intro:
      "Oaxaca combina turismo internacional durante todo el año con picos muy fuertes en Guelaguetza y Día de Muertos. Kora le da a tu hotel boutique un motor de reservas directas sin comisión, tarifas por temporada y un agente de WhatsApp con IA que responde en el idioma del huésped.",
    cuerpo: [
      "La hotelería del centro histórico de Oaxaca es sobre todo boutique e independiente, con casonas convertidas en hoteles de pocas habitaciones. Es exactamente el perfil donde la comisión de OTA duele más: pocas llaves, margen que sostiene la experiencia, y cada reserva pesa.",
      "El calendario del destino es muy marcado. Guelaguetza en julio y Día de Muertos a fines de octubre disparan la demanda y permiten sostener tarifa; el resto del año exige trabajar la demanda directa. Cobrar lo mismo todo el año deja dinero en la mesa en las fechas fuertes.",
      "Con Kora manejas tarifas por temporada, tomas reservas directas desde tu propia página con anticipo con tarjeta, y Camila contesta el WhatsApp en español o inglés a cualquier hora con tu disponibilidad real. El CRM guarda a cada huésped para que vuelva sin pagar comisión otra vez.",
    ],
    faqs: [
      {
        q: "¿Puedo tener tarifas distintas para Día de Muertos?",
        a: "Sí. Las tarifas por temporada son parte del plan, y el agente cotiza con la tarifa vigente de esas fechas.",
      },
      {
        q: "¿Atiende a huéspedes extranjeros?",
        a: "Sí, responde en el idioma en que le escriban y el link de pago acepta tarjetas internacionales.",
      },
    ],
  },
  {
    slug: "san-cristobal-de-las-casas",
    ciudad: "San Cristóbal de las Casas",
    estado: "Chiapas",
    titulo: "Sistema de reservas directas para hoteles en San Cristóbal de las Casas",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en San Cristóbal?",
    resumen:
      "Motor de reservas sin comisión y WhatsApp con IA para hoteles y posadas del centro de San Cristóbal.",
    intro:
      "San Cristóbal de las Casas recibe viajeros nacionales e internacionales que se hospedan en posadas y hoteles boutique independientes, casi todos con fuerte dependencia de OTAs. Kora te da reservas directas sin comisión, WhatsApp con IA 24/7 y toda la operación del hotel en una sola pantalla.",
    cuerpo: [
      "El hospedaje de San Cristóbal es predominantemente pequeño y de dueño: posadas, hostales boutique y hoteles de pocas habitaciones en el centro y sus alrededores. La visibilidad la dan las plataformas, y con ella llega la comisión.",
      "Buena parte del viajero llega mochileando o en ruta hacia Palenque y la selva, lo que produce muchas consultas de último minuto y estancias cortas. Ese tráfico se decide en WhatsApp y en horarios impredecibles.",
      "Kora te deja capturar directo ese flujo: página propia con motor de reservas, agente de WhatsApp que cotiza con disponibilidad real las 24 horas y cobro de anticipo con tarjeta, sin comisión por reserva.",
    ],
    faqs: [
      {
        q: "¿Sirve para una posada de pocas habitaciones?",
        a: "Sí. Un solo plan de $550 MXN al mes con habitaciones ilimitadas, sin permanencia.",
      },
      {
        q: "¿Necesito saber de tecnología?",
        a: "No. Kora está en español, se opera desde el celular y el arranque lo hacemos nosotros: cargamos tu hotel, tus fotos y tus tarifas.",
      },
    ],
  },
  {
    slug: "sayulita",
    ciudad: "Sayulita",
    estado: "Nayarit",
    titulo: "Sistema de reservas directas para hoteles en Sayulita",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Sayulita?",
    resumen:
      "Reservas directas sin comisión y WhatsApp con IA para hoteles boutique y hospedajes de surf en Sayulita.",
    intro:
      "Sayulita concentra hospedaje pequeño e independiente con mucho huésped extranjero y alta dependencia de plataformas. Kora te da un motor de reservas directas sin comisión, cobro con tarjetas internacionales y un agente de WhatsApp con IA que contesta en inglés o español las 24 horas.",
    cuerpo: [
      "El perfil de Sayulita es de hospedaje boutique pequeño con temporada marcada por el invierno norteamericano y por los meses de surf. Una parte grande de la demanda es extranjera y llega por plataformas internacionales.",
      "Eso deja dos costos: la comisión de cada noche y la barrera del idioma cuando el huésped escribe directo. Contestar en inglés a deshoras, con precios correctos, no es algo que un hospedaje de dueño pueda sostener a mano.",
      "Con Kora la conversación se atiende sola: Camila responde en el idioma del huésped, consulta la disponibilidad real y manda un link de pago que acepta tarjetas internacionales. El calendario sigue sincronizado con las OTAs para no sobrevender.",
    ],
    faqs: [
      {
        q: "¿Acepta tarjetas de huéspedes extranjeros?",
        a: "Sí. El cobro va por Stripe, que acepta tarjetas internacionales, y el dinero llega a tu propia cuenta.",
      },
      {
        q: "¿Puedo manejar temporada alta y baja?",
        a: "Sí, con tarifas por temporada. El agente cotiza siempre con la tarifa vigente de esas fechas.",
      },
    ],
  },
  {
    slug: "tequisquiapan",
    ciudad: "Tequisquiapan",
    estado: "Querétaro",
    titulo: "Sistema de reservas directas para hoteles en Tequisquiapan",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Tequisquiapan?",
    resumen:
      "Motor de reservas sin comisión y WhatsApp con IA para hoteles boutique de la ruta del vino y el queso.",
    intro:
      "Tequisquiapan vive de escapadas de fin de semana desde el Bajío y la Ciudad de México, con demanda concentrada en la ruta del vino y el queso. Kora te da reservas directas sin comisión, tarifas por temporada y un agente de WhatsApp con IA que cotiza y cierra a cualquier hora.",
    cuerpo: [
      "La demanda de Tequisquiapan se concentra en fines de semana, puentes y la temporada de vendimia. Entre semana el hotel respira; los viernes y sábados es donde se hace el mes.",
      "Ese patrón vuelve críticas dos cosas: sostener la tarifa en las fechas fuertes y no perder ninguna consulta. Un mensaje de jueves por la noche que se contesta el sábado es una reserva regalada al hotel de al lado.",
      "Con Kora tomas reservas directas desde tu propia página, manejas tarifas distintas por temporada y Camila contesta al instante con tu disponibilidad real, cerrando con link de pago para apartar el cuarto.",
    ],
    faqs: [
      {
        q: "¿Puedo cobrar distinto en fin de semana?",
        a: "Sí. Las tarifas por temporada y por día son parte del plan, y el agente cotiza con la vigente.",
      },
      {
        q: "¿Sirve si vendo paquetes con experiencias?",
        a: "Puedes cargar tus unidades y tarifas; para paquetes con experiencias lo vemos contigo en el arranque.",
      },
    ],
  },
  {
    slug: "real-de-catorce",
    ciudad: "Real de Catorce",
    estado: "San Luis Potosí",
    titulo: "Sistema de reservas directas para hoteles en Real de Catorce",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Real de Catorce?",
    resumen:
      "Reservas directas sin comisión y WhatsApp con IA para hoteles y posadas del Pueblo Mágico potosino.",
    intro:
      "Real de Catorce es un Pueblo Mágico de hospedaje pequeño, con demanda muy concentrada en fines de semana, puentes y la peregrinación de octubre. Kora te da motor de reservas directas sin comisión y un agente de WhatsApp con IA que contesta, cotiza y aparta a cualquier hora.",
    cuerpo: [
      "El hospedaje de Real de Catorce es de pocas habitaciones y operado por su dueño, con una demanda que se dispara en fechas concretas y baja fuerte el resto del tiempo. Cada fecha fuerte pesa desproporcionadamente en el año.",
      "Con ese patrón, perder una consulta duele el doble: no hay entre semana que compense. Y como el pueblo tiene cobertura irregular, el hotelero muchas veces contesta con horas de retraso sin querer.",
      "Kora cubre ese hueco desde el servidor, no desde tu celular: el motor de reservas de tu página y Camila en WhatsApp siguen operando aunque tú estés sin señal, con tu disponibilidad y tus tarifas reales.",
    ],
    faqs: [
      {
        q: "¿Funciona si tengo mala señal en el pueblo?",
        a: "El motor de reservas y el agente viven en internet, no en tu teléfono: siguen tomando reservas aunque tú no tengas señal en ese momento.",
      },
      {
        q: "¿Puedo subir tarifas en fechas de alta demanda?",
        a: "Sí, con tarifas por temporada, y el agente cotiza con la que esté vigente.",
      },
    ],
  },
  {
    slug: "puebla",
    ciudad: "Puebla",
    estado: "Puebla",
    titulo: "Sistema de reservas directas para hoteles boutique en Puebla",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Puebla?",
    resumen:
      "Motor de reservas sin comisión y WhatsApp con IA para hoteles boutique del centro histórico de Puebla.",
    intro:
      "Puebla mezcla turismo de fin de semana desde la Ciudad de México con viajero de negocios entre semana, en un centro histórico lleno de hoteles boutique independientes. Kora te da reservas directas sin comisión, WhatsApp con IA 24/7 y toda la operación en una sola pantalla.",
    cuerpo: [
      "El centro histórico de Puebla concentra casonas convertidas en hoteles boutique de pocas llaves. Compiten contra cadenas con presupuesto de marketing, y su ventaja es la experiencia y el trato directo —justo lo que una OTA no transmite.",
      "La demanda tiene dos caras: fin de semana turístico desde la capital y entre semana corporativo. Eso significa que el hotel recibe consultas todo el tiempo y de perfiles muy distintos, con preguntas muy concretas sobre disponibilidad y factura.",
      "Con Kora capturas ese flujo directo: motor de reservas en tu página, agente de WhatsApp que cotiza con disponibilidad real las 24 horas, cobro de anticipo con tarjeta y un CRM que guarda a cada huésped para que vuelva sin comisión.",
    ],
    faqs: [
      {
        q: "¿Sirve para huésped de negocios que pide factura?",
        a: "El sistema guarda los datos de cada reserva y su cobro. La emisión de CFDI se revisa contigo según cómo factures hoy.",
      },
      {
        q: "¿Puedo tener tarifas distintas entre semana y fin de semana?",
        a: "Sí, con tarifas por temporada y por día.",
      },
    ],
  },
  {
    slug: "todos-santos",
    ciudad: "Todos Santos",
    estado: "Baja California Sur",
    titulo: "Sistema de reservas directas para hoteles en Todos Santos",
    pregunta: "¿Cuál es el mejor sistema de reservas para un hotel en Todos Santos?",
    resumen:
      "Reservas directas sin comisión y WhatsApp con IA para hoteles boutique del Pueblo Mágico de BCS.",
    intro:
      "Todos Santos tiene hotelería boutique pequeña, mucho huésped extranjero y una temporada marcada por el invierno norteamericano. Kora te da motor de reservas directas sin comisión, cobro con tarjetas internacionales y un agente de WhatsApp con IA que responde en inglés o español.",
    cuerpo: [
      "El perfil del destino es de hospedaje boutique de pocas llaves con ticket alto y huésped mayoritariamente extranjero. Ese ticket hace que cada punto de comisión de OTA represente una cantidad importante por noche.",
      "La temporada está marcada por el invierno del norte, con meses fuertes y meses de mucha calma. Sostener tarifa en los fuertes y trabajar demanda propia en los flojos es la diferencia entre un buen año y uno apretado.",
      "Kora te deja capturar directo: página con motor de reservas, cobro con tarjetas internacionales a tu propia cuenta, tarifas por temporada, y Camila contestando el WhatsApp en el idioma del huésped a cualquier hora con tu disponibilidad real.",
    ],
    faqs: [
      {
        q: "¿El huésped extranjero puede pagar con su tarjeta?",
        a: "Sí. El cobro va por Stripe y acepta tarjetas internacionales; el dinero llega a tu propia cuenta.",
      },
      {
        q: "¿Puedo bajar tarifas sólo en temporada baja?",
        a: "Sí, con tarifas por temporada. Y el panel te muestra el forecast de 30 días para decidir con anticipación.",
      },
    ],
  },
];

export function getCiudad(slug: string): Ciudad | undefined {
  return ciudades.find((c) => c.slug === slug);
}
