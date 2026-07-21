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
  { aspecto: "Puesta en marcha", ota: "—", kora: "Llave en mano en 48 horas" },
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
      "Con Kora pones un motor de reservas en tu propia página o en tu Instagram para captar directo, y Camila —tu recepcionista de IA— contesta 24/7, cotiza y reúne los datos de la reserva mientras tú atiendes el hotel. Nosotros te lo montamos llave en mano en 48 horas; tú solo empiezas a recibir reservas que no pagan comisión.",
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
      "Kora te da un motor de reservas con cobro de anticipo por tarjeta para cerrar esas consultas en el momento, y Camila contesta al instante 24/7 en español. Además operas todo el hotel —calendario, huéspedes, tarifas por temporada— desde una sola pantalla. Lo dejamos listo en 48 horas, sin que toques nada técnico.",
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
      "Con Kora montas un motor de reservas propio y Camila contesta esas dudas 24/7, cotiza y reúne los datos para cerrar la reserva directa. Sincroniza con tus OTAs para no tener overbooking y te deja operar todo desde el celular. Lo instalamos llave en mano en 48 horas, incluso si eres una cabaña familiar sin experiencia técnica.",
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
      "Kora te da un motor de reservas con tarifas por temporada, para que cobres el precio correcto en cada fecha automáticamente, y Camila contesta 24/7 para no perder reservas en tus semanas fuertes. Todo en una sola pantalla, montado llave en mano en 48 horas.",
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
      "Kora te da un motor de reservas directas para captar esas reservas de último minuto sin comisión, y Camila contesta 24/7 para cerrar las consultas por WhatsApp. Operas el hotel completo —calendario, huéspedes, cobros— desde una pantalla, y lo dejamos listo en 48 horas.",
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
        a: "Lo montamos llave en mano en 48 horas: cargamos tus cuartos, fotos y tarifas, y te capacitamos. Tú no tocas nada técnico.",
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
      "Kora te da un motor de reservas propio con cobro de anticipo y Camila contestando 24/7, para convertir esas consultas en reservas directas. Sincroniza con tus OTAs para evitar overbooking y te deja operar desde el celular. Lo montamos llave en mano en 48 horas.",
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
      "Kora reúne en un solo sistema, en español y montado llave en mano en 48 horas, todo lo que un hospedaje de la Huasteca necesita: motor de reservas directas sin comisión, Camila (WhatsApp con IA 24/7), tarifas por temporada, sincronía con las OTAs para evitar overbooking y un dashboard para ver tu ocupación y tus ingresos. Es el mismo sistema que ya opera al Hotel Paraíso Encantado en Xilitla.",
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
];

export function getCiudad(slug: string): Ciudad | undefined {
  return ciudades.find((c) => c.slug === slug);
}
