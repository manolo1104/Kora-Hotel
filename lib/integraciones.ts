// Fuente única de con qué se integra Kora de verdad.
//
// 🔴 POR QUÉ EXISTE ESTE ARCHIVO. Hasta el 2 sep 2026 la rejilla de la portada
// estaba escrita a mano en `components/landing/IntegracionesSection.tsx` y decía
// exactamente lo contrario de la realidad:
//
//   • «Airbnb — Activo».   Airbnb NUNCA ha existido como canal. El único sitio
//     donde se declaran los canales es `canales/CanalesClient.tsx`, y su tipo
//     `Platform` sólo conoce 'booking_com' | 'expedia'.
//   • «Expedia — Activo».  Existió por iCal, y está apagado desde el 26 ago:
//     `CANALES_OTA_DISPONIBLES = false` retiró la pestaña entera del panel.
//   • «Booking.com — Próximamente». Es el único de los tres que sí llegó a
//     funcionar. O sea: la rejilla estaba al revés.
//
// Y la prosa de alrededor prometía «tus reservas de Booking […] todo
// sincronizado», mientras `/precios` cobraba $2,500 por «Migración + sync
// Booking/Expedia» — un servicio cuya pestaña ya no está en el panel.
//
// La confianza del hotelero mexicano es el activo que no se recupera. Una
// promesa que se descubre falsa en el tercer mes cuesta más que la venta que
// ganó en el primero.
//
// 👉 REGLA: nadie escribe «Activo» a mano. Sale de aquí, y
// `tests/integraciones-congruente.test.ts` falla si alguien lo intenta o si esta
// lista vuelve a contradecir a `CANALES_OTA_DISPONIBLES`.
import { CANALES_OTA_DISPONIBLES } from "@/lib/panel/canales-ota";

export type EstadoIntegracion = "active" | "soon";

export type Integracion = {
  name: string;
  status: EstadoIntegracion;
  /** Logo en /public/integraciones. Si falta, se pinta `abbr` sobre `color`. */
  logo?: string;
  color?: string;
  abbr?: string;
};

/**
 * Las OTAs se enlazan por iCal desde el 18 nov 2026 (lib/canales/ical.ts). Salen
 * de `CANALES_OTA_DISPONIBLES`, no se escriben a mano: si el interruptor se
 * apaga, desaparecen de la rejilla solas.
 *
 * «Expedia (Vrbo)» y no «Expedia» a secas: Expedia Group sólo ofrece iCal en los
 * anuncios de Vrbo; Expedia Partner Central (hoteles) no tiene iCal.
 */
const OTAS_ICAL: Integracion[] = [
  { name: "Airbnb", status: "active", logo: "/integraciones/airbnb.svg" },
  { name: "Booking.com", status: "active", logo: "/integraciones/bookingdotcom.svg" },
  { name: "Expedia (Vrbo)", status: "active", logo: "/integraciones/expedia.svg" },
  { name: "Calendario iCal", status: "active", logo: "/integraciones/googlecalendar.svg" },
];

export const INTEGRACIONES: Integracion[] = [
  ...(CANALES_OTA_DISPONIBLES ? OTAS_ICAL : []),
  // ── Lo que funciona hoy, comprobado en el código ──────────────────────────
  {
    // El agente de WhatsApp. `agentes/camila` + /api/agent.
    name: "WhatsApp Business",
    status: "active",
    logo: "/integraciones/whatsapp.svg",
  },
  {
    // Stripe Connect: el cobro del huésped cae en la cuenta del hotel.
    name: "Stripe",
    status: "active",
    logo: "/integraciones/stripe.svg",
  },
  {
    // OXXO va DENTRO de Stripe (`oxxo` como método de pago). Es real: el motor
    // lo ofrece y tiene sus propios textos de voucher en lib/booking/i18n.ts.
    // No hay logo en /public/integraciones, así que usa insignia como Conekta.
    name: "OXXO",
    status: "active",
    color: "#E1251B",
    abbr: "OXXO",
  },

  // ── Decisión de Manolo del 2 sep 2026 ─────────────────────────────────────
  // 🔴 OJO ANTES DE «ARREGLAR» ESTO. Mercado Pago y Gmail están marcados
  // «Activo» y NO existen en el código: un grep de `mercadopago` o de `gmail`
  // fuera de este archivo y de la rejilla no devuelve ninguna integración.
  //
  // Se le planteó a Manolo que marcarlos «Activo» añade dos promesas nuevas
  // justo en el cambio que quita las otras, y su respuesta fue explícita:
  // «ponlos Activo igual, yo sé lo que hago». Queda escrito para que nadie lo
  // cambie sin saber que fue una decisión, no un descuido — y para que el día
  // que se decida al revés, se sepa qué se está deshaciendo.
  {
    name: "Mercado Pago",
    status: "active",
    logo: "/integraciones/mercadopago.svg",
  },
  {
    name: "Gmail",
    status: "active",
    logo: "/integraciones/gmail.svg",
  },

  // ── En camino, y dicho como tal ───────────────────────────────────────────
  {
    // Conekta no tiene logo en la librería: insignia de color.
    name: "Conekta",
    status: "soon",
    color: "#1A1A2E",
    abbr: "CK",
  },
];

/**
 * ¿Puede alguna superficie prometer sincronización con OTAs? Hoy no. Existe
 * para que la respuesta viva en un solo sitio y no en la memoria de quien
 * escriba el próximo texto de marketing.
 */
export const SINCRONIA_OTA_DISPONIBLE = CANALES_OTA_DISPONIBLES;

/**
 * Cómo se dice el enlace con OTAs en TODAS las superficies (landing, FAQs,
 * llms.txt, soporte). Una sola redacción para que nadie prometa de más —un
 * channel manager— ni de menos —«todavía no se sincroniza»—.
 */
export const ENLACE_OTA = {
  /** La promesa, en una frase. */
  corto:
    "Kora se enlaza por iCal con Airbnb, Booking.com y Expedia (Vrbo): lo que vendes allá se bloquea solo en Kora cada 15 minutos, y lo que vendes en Kora se cierra allá.",
  /** Los límites, dichos antes de que el hotelero los descubra. */
  limites:
    "No es un channel manager: iCal mueve sólo las fechas ocupadas (las tarifas se siguen poniendo en cada OTA), cada OTA lee el calendario de Kora a su ritmo (de 30 minutos a 3 horas) y Booking sólo ofrece iCal si cada tipo de habitación tiene una unidad y no usas otro channel manager.",
} as const;
