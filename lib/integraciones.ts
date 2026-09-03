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
 * Las OTAs (Booking, Airbnb, Expedia) NO están en la lista, y no es un olvido:
 * mientras `CANALES_OTA_DISPONIBLES` sea `false` el hotelero no puede conectar
 * ninguna desde el panel. Volverán cuando exista el channel manager, y entonces
 * bastará con añadirlas aquí.
 */
export const INTEGRACIONES: Integracion[] = [
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
