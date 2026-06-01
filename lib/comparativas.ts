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
      { aspecto: "Facturación CFDI 4.0", ota: "Por tu cuenta", kora: "Integrada" },
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
      { aspecto: "Facturación CFDI 4.0", ota: "Por tu cuenta", kora: "Integrada" },
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
];

export function getComparativa(slug: string): Comparativa | undefined {
  return comparativas.find((c) => c.slug === slug);
}
