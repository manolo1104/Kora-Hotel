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
      "Un hotel boutique necesita un sistema que cuide la experiencia personal sin volverse complejo: reservas directas sin comisión, atención rápida por WhatsApp y una operación que se maneje desde el celular. Kora reúne motor de reservas, PMS, CRM y facturación CFDI en una sola pantalla, en español, instalado llave en mano.",
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
          "Calendario, PMS, CRM de huéspedes, precios y CFDI 4.0 en un solo lugar. Si sabes usar tu celular, sabes usar Kora.",
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
      "Un hotel pequeño o independiente necesita dejar atrás el cuaderno y el Excel sin caer en un sistema caro y complicado. Lo esencial: tomar reservas directas, evitar el overbooking, contestar rápido y facturar en regla. Kora junta todo eso en un solo sistema en español, instalado y con soporte por WhatsApp.",
    dolor: [
      "Llevar las reservas en cuaderno o Excel termina en errores y, tarde o temprano, en overbooking.",
      "Pagar varias herramientas sueltas (motor, chatbot, facturación) sale caro y no se hablan entre sí.",
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
          "Reservas, atención con IA, PMS, CRM y CFDI por un solo precio, en vez de juntar (y pagar) cinco apps distintas.",
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
        a: "Hay un solo plan de $550 MXN/mes, mes a mes y sin permanencia, con habitaciones ilimitadas y todo incluido: el motor de reservas directo (0% de comisión), el PMS, Camila (agente de WhatsApp con IA 24/7), el dashboard, el CRM y la facturación CFDI. Lo pruebas 30 días gratis. Además, si quieres, te creamos tu sitio web profesional con motor de reservas como servicio aparte.",
      },
    ],
  },
];

export function getPersona(slug: string): Persona | undefined {
  return personas.find((p) => p.slug === slug);
}
