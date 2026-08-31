// El catálogo de TODO lo que Kora manda por correo, con datos de ejemplo, para
// poder VERLO en localhost sin enviar nada y sin desplegar.
//
// Por qué existe: en local `RESEND_API_KEY` está comentada a propósito, así que
// hasta ahora la única forma de ver un correo era subirlo a producción y
// provocarlo de verdad. Eso hacía imposible revisar lo que DICEN: la mitad de
// los hallazgos de la auditoría son "el correo promete X y el sistema hace Y",
// y no se pueden comprobar sin leer el correo.
//
// Cada entrada declara también QUIÉN lo recibe, QUÉ lo dispara y DÓNDE vive ese
// disparador. Esa ficha es la mitad del valor: sin ella no se puede contrastar
// la promesa del texto contra la conducta real del código.
//
// SOLO SERVIDOR y SOLO DESARROLLO. `lib/email/reserva.ts` arrastra el cliente
// service-role de Supabase, así que este módulo no puede llegar al navegador;
// la pantalla lo consume desde un route handler. Ver app/dev/correos.
//
// No importa ni un solo `send*`: aquí sólo se llaman los constructores puros de
// HTML. Este archivo no puede enviar un correo aunque se quiera.

import {
  buildConfirmacionEmailHtml,
  buildAvisoReservaHotelHtml,
  buildAvisoCancelacionHotelHtml,
  buildPagoSinCuartoHuespedHtml,
  buildPagoSinCuartoHotelHtml,
  buildAbandonoEmailHtml,
  buildCancelacionHuespedHtml,
  buildModificacionHuespedHtml,
} from "@/lib/email/reserva";
import {
  buildBienvenidaHotelHtml,
  buildRecordatorioPruebaHtml,
  buildPruebaPausadaHtml,
} from "@/lib/email/prueba";
import {
  emailBienvenida,
  emailHotelNuevo,
  emailLeadNuevo,
  emailLeadSecuencia,
  emailPagoVencido,
  emailDigest,
} from "@/lib/email/templates";
import { emailGuia } from "@/lib/email/guia";
import {
  buildRestaurantEmailHtml,
  buildWelcomeGuideEmailHtml,
  buildSurveyEmailHtml,
  buildReviewEmailHtml,
  buildReturnOfferEmailHtml,
  buildPersonalOfferEmailHtml,
} from "@/lib/email-sequences";
import { buildCotizacionDoc, buildReservaDoc } from "@/lib/docs/documento-branded";
import type { BookingBrand } from "@/lib/email/booking-branded";

export type Lang = "es" | "en";

/** Un correo (o documento) del catálogo, con su ficha. */
export interface EntradaPreview {
  /** Slug estable: va en la URL de la vista previa. */
  id: string;
  nombre: string;
  /** A quién le llega. */
  quien: "Huésped" | "Hotelero" | "Manolo";
  /** Qué lo dispara, en una línea. Con la hora del cron si lo manda un cron. */
  cuando: string;
  /** Archivo que lo dispara, para ir a leer la condición real. */
  origen: string;
  /** true si la plantilla acepta `lang` y cambia de idioma de verdad. */
  bilingue?: boolean;
  render(lang: Lang): { subject?: string; html: string };
}

export interface GrupoPreview {
  titulo: string;
  /** Por qué este grupo existe / qué tienen en común. */
  nota: string;
  entradas: EntradaPreview[];
}

// ─── Datos de ejemplo ────────────────────────────────────────────────────────
// Ficticios a propósito y reconocibles como tales, para que nadie confunda una
// vista previa con una reserva real. Las fechas son relativas a hoy para que los
// correos que hablan de "tu llegada se acerca" se lean como se leerían de verdad.

function dia(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const CHECKIN = dia(12);
const CHECKOUT = dia(15);

const MARCA: BookingBrand = {
  nombre: "Hotel de Ejemplo",
  color: "#1B4332",
  ubicacion: "Xilitla, San Luis Potosí",
  whatsapp: "5215500000000",
  email: "hola@ejemplo.test",
  telefono: "481 000 0000",
  mapsUrl: "https://maps.google.com/?q=Xilitla",
};

/**
 * El juego SUCIO: todo lo que un hotelero puede teclear en su onboarding y que
 * acaba dentro del correo de un huésped de OTRO hotel. Comillas (rompen los
 * atributos `href`), `&` (delata el doble escapado) y una etiqueta HTML (delata
 * lo que se interpola crudo). Si algo de esto se renderiza como marcado en vez
 * de leerse como texto, es una inyección; si sale un `&amp;` VISIBLE, es doble
 * escapado. Ver el contrato de quién escapa qué en lib/email/design.ts.
 */
const MARCA_SUCIA: BookingBrand = {
  nombre: 'Hotel "Río" & Sol <b>MALO</b>',
  color: "#1B4332",
  ubicacion: 'Xilitla "centro" & alrededores',
  whatsapp: "5215500000000",
  email: 'a"b@ejemplo.test',
  telefono: "481 000 0000",
  mapsUrl: 'https://maps.google.com/?q="Xilitla"&z=12',
};

const CLIENTE_SUCIO = 'J&J <b>Pérez</b> "el bueno"';

/** El hotel de ejemplo CON logo y color propios, para ver la cabecera branded. */
const MARCA_CON_LOGO: BookingBrand = {
  nombre: "Hotel de Ejemplo",
  color: "#2D1B44", // morado oscuro: pasa `esColorOscuro`, así que sí se aplica
  logoUrl: "https://kora-hotel.com/opengraph-image",
  ubicacion: "Xilitla, San Luis Potosí",
  whatsapp: "5215500000000",
  email: "hola@ejemplo.test",
  telefono: "481 000 0000",
  mapsUrl: "https://maps.google.com/?q=Xilitla",
};

/** Y con un color CLARO: la cabecera debe conservar el verde de Kora. */
const MARCA_COLOR_CLARO: BookingBrand = { ...MARCA_CON_LOGO, color: "#FFE27A", logoUrl: undefined };

const HOTEL_SEQ = {
  nombre: MARCA.nombre,
  baseUrl: "http://localhost:3000/h/hotel-de-ejemplo",
  ubicacion: MARCA.ubicacion,
  telefono: MARCA.telefono,
  whatsapp: MARCA.whatsapp,
  email: MARCA.email,
  reviewUrl: "https://g.page/r/ejemplo/review",
  mapsUrl: MARCA.mapsUrl,
  promoCode: "VUELVE10",
  promoDiscount: "10%",
};

const CLIENTE = "María Ejemplo";
const CONFIRMACION = "KORA-DEMO-01";
const HABS = ["Suite Jungla", "Cabaña Ceiba"];
const PORTAL = "http://localhost:3000/reserva/consultar";
const PANEL = "http://localhost:3000/panel/hotel-de-ejemplo/reservas";

// Conceptos compartidos por los dos documentos.
const CONCEPTOS = [
  {
    nombre: "Suite Jungla",
    descripcion: "3 noches · 2 huéspedes",
    cantidad: "3",
    precio_unitario: "$2,500.00",
    importe: "$7,500.00",
  },
  {
    nombre: "Tour Sótano de las Huahuas",
    descripcion: "Salida 5:00 AM · 2 personas",
    cantidad: "2",
    precio_unitario: "$650.00",
    importe: "$1,300.00",
  },
];

// ─── El catálogo ─────────────────────────────────────────────────────────────

export const GRUPOS: GrupoPreview[] = [
  {
    titulo: "El huésped que reserva",
    nota: "Los dispara el motor de reservas. Los tres primeros salen del webhook de Stripe, así que sólo existen si el webhook llegó.",
    entradas: [
      {
        id: "confirmacion",
        nombre: "Confirmación de reserva",
        quien: "Huésped",
        cuando: "Al confirmarse el pago (webhook de Stripe), al crearla el hotelero a mano, y al pedir reenvío desde el portal.",
        origen: "app/api/h/webhooks/stripe/route.ts",
        bilingue: true,
        render: (lang) => ({
          subject: lang === "en" ? "Your booking is confirmed" : "Tu reserva está confirmada",
          html: buildConfirmacionEmailHtml({
            hotelNombre: MARCA.nombre,
            confirmacion: CONFIRMACION,
            habitaciones: HABS,
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            pendiente: 6300,
            cliente: CLIENTE,
            huespedes: 2,
            experiencias: ["Tour Sótano de las Huahuas ×2"],
            portalUrl: PORTAL,
            lang,
            brand: MARCA,
            checkinTime: "3:00 PM",
            checkoutTime: "12:00 PM",
          }),
        }),
      },
      {
        id: "confirmacion-nrf",
        nombre: "Confirmación — tarifa NO reembolsable",
        quien: "Huésped",
        cuando: "Igual que la anterior, pero con `ratePlan: 'nrf'`. Es el caso donde el texto de cancelación cambia.",
        origen: "app/api/h/webhooks/stripe/route.ts",
        bilingue: true,
        render: (lang) => ({
          subject: lang === "en" ? "Your booking is confirmed" : "Tu reserva está confirmada",
          html: buildConfirmacionEmailHtml({
            hotelNombre: MARCA.nombre,
            confirmacion: CONFIRMACION,
            habitaciones: [HABS[0]],
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 7500,
            pendiente: 0,
            cliente: CLIENTE,
            huespedes: 2,
            ratePlan: "nrf",
            portalUrl: PORTAL,
            lang,
            brand: MARCA,
          }),
        }),
      },
      {
        id: "confirmacion-sin-marca",
        nombre: "Confirmación — hotel SIN marca cargada",
        quien: "Huésped",
        cuando: "El mismo correo cuando el hotel no tiene logo ni color: cae a la plantilla genérica. Es lo que ve un hotel recién dado de alta.",
        origen: "lib/email/reserva.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildConfirmacionEmailHtml({
            hotelNombre: MARCA.nombre,
            confirmacion: CONFIRMACION,
            habitaciones: HABS,
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            pendiente: 6300,
            cliente: CLIENTE,
            huespedes: 2,
            portalUrl: PORTAL,
            lang,
          }),
        }),
      },
      {
        id: "confirmacion-sucia",
        nombre: "Confirmación — con datos SUCIOS (escapado)",
        quien: "Huésped",
        cuando: "El mismo correo con comillas, `&` y una etiqueta HTML en el nombre del hotel y del huésped. No es un caso real: es la prueba del escapado.",
        origen: "lib/email/design.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildConfirmacionEmailHtml({
            hotelNombre: MARCA_SUCIA.nombre,
            confirmacion: CONFIRMACION,
            habitaciones: ['Suite "Jungla" & Río'],
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            pendiente: 6300,
            cliente: CLIENTE_SUCIO,
            huespedes: 2,
            portalUrl: PORTAL,
            lang,
            brand: MARCA_SUCIA,
          }),
        }),
      },
      {
        id: "confirmacion-logo",
        nombre: "Confirmación — hotel CON logo y color propios",
        quien: "Huésped",
        cuando: "El hotel puso logo y un color oscuro en su editor: la cabecera los usa, igual que el documento imprimible del mismo folio.",
        origen: "lib/email/booking-branded.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildConfirmacionEmailHtml({
            hotelNombre: MARCA_CON_LOGO.nombre,
            confirmacion: CONFIRMACION,
            habitaciones: HABS,
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            pendiente: 6300,
            cliente: CLIENTE,
            huespedes: 2,
            portalUrl: PORTAL,
            lang,
            brand: MARCA_CON_LOGO,
          }),
        }),
      },
      {
        id: "confirmacion-color-claro",
        nombre: "Confirmación — hotel con color CLARO (se ignora)",
        quien: "Huésped",
        cuando: "Un color pastel encima del texto blanco sería ilegible, así que la cabecera conserva el verde de Kora. Ese es el caso a mirar.",
        origen: "lib/email/design.ts",
        render: (lang) => ({
          html: buildConfirmacionEmailHtml({
            hotelNombre: MARCA_COLOR_CLARO.nombre,
            confirmacion: CONFIRMACION,
            habitaciones: HABS,
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            pendiente: 6300,
            cliente: CLIENTE,
            huespedes: 2,
            portalUrl: PORTAL,
            lang,
            brand: MARCA_COLOR_CLARO,
          }),
        }),
      },
      {
        id: "abandono",
        nombre: "Reserva incompleta (carrito abandonado)",
        quien: "Huésped",
        cuando: "Cron diario 16:00 UTC. Sólo a quien dejó correo y no completó el pago.",
        origen: "app/api/cron/abandono/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildAbandonoEmailHtml({
            hotelNombre: MARCA.nombre,
            nombre: CLIENTE,
            checkin: CHECKIN,
            checkout: CHECKOUT,
            reanudarUrl: "http://localhost:3000/h/hotel-de-ejemplo/reservar",
            lang,
            brand: MARCA,
            suites: [HABS[0]],
            huespedes: 2,
            noches: 3,
            total: 7500,
          }),
        }),
      },
      {
        id: "cancelacion-huesped",
        nombre: "Cancelación — dentro del plazo (reembolsable)",
        quien: "Huésped",
        cuando: "Al cancelar el huésped desde el portal, o el hotelero desde el panel.",
        origen: "app/api/reserva/cancelar/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildCancelacionHuespedHtml({
            hotelNombre: MARCA.nombre,
            confirmacion: CONFIRMACION,
            cliente: CLIENTE,
            habitaciones: HABS.join(", "),
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            reembolsable: true,
            lang,
            brand: MARCA,
          }),
        }),
      },
      {
        id: "cancelacion-huesped-nrf",
        nombre: "Cancelación — fuera del plazo (NO reembolsable)",
        quien: "Huésped",
        cuando: "Mismo disparador, con `reembolsable: false`. Aquí es donde el texto habla de dinero que quizá nadie devuelve.",
        origen: "app/api/reserva/cancelar/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildCancelacionHuespedHtml({
            hotelNombre: MARCA.nombre,
            confirmacion: CONFIRMACION,
            cliente: CLIENTE,
            habitaciones: HABS.join(", "),
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            reembolsable: false,
            lang,
            brand: MARCA,
          }),
        }),
      },
      {
        id: "modificacion",
        nombre: "Reserva modificada",
        quien: "Huésped",
        cuando: "Al cambiar el hotelero fechas, cuarto o total desde el panel.",
        origen: "app/api/admin/reservas/[id]/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildModificacionHuespedHtml({
            hotelNombre: MARCA.nombre,
            confirmacion: CONFIRMACION,
            cliente: CLIENTE,
            habitaciones: HABS.join(", "),
            checkin: CHECKIN,
            checkout: CHECKOUT,
            noches: 3,
            huespedes: 2,
            total: 8800,
            anticipo: 2500,
            anterior: { habitaciones: "Suite Jungla", checkin: dia(10), checkout: dia(12) },
            portalUrl: PORTAL,
            lang,
            brand: MARCA,
          }),
        }),
      },
      {
        id: "pago-sin-cuarto-huesped",
        nombre: "Pagó y ya no había cuarto",
        quien: "Huésped",
        cuando: "El webhook cobró pero el inventario ya no tenía la habitación. Es el correo de la sobreventa.",
        origen: "app/api/h/webhooks/stripe/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildPagoSinCuartoHuespedHtml({
            hotelNombre: MARCA.nombre,
            cliente: CLIENTE,
            email: "maria@ejemplo.test",
            telefono: "481 000 0000",
            habitaciones: [HABS[0]],
            checkin: CHECKIN,
            checkout: CHECKOUT,
            monto: 2500,
            reembolsado: true,
            lang,
          }),
        }),
      },
      {
        id: "pago-sin-cuarto-huesped-sin-reembolso",
        nombre: "Pagó y ya no había cuarto — SIN reembolso automático",
        quien: "Huésped",
        cuando: "Mismo caso con `reembolsado: false`: el reembolso en Stripe falló y el correo tiene que decirlo sin mentir.",
        origen: "app/api/h/webhooks/stripe/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildPagoSinCuartoHuespedHtml({
            hotelNombre: MARCA.nombre,
            cliente: CLIENTE,
            email: "maria@ejemplo.test",
            habitaciones: [HABS[0]],
            checkin: CHECKIN,
            checkout: CHECKOUT,
            monto: 2500,
            reembolsado: false,
            lang,
          }),
        }),
      },
    ],
  },
  {
    titulo: "El huésped, antes y después de la estancia",
    nota: "Las cinco secuencias del cron de las 15:00 UTC. Cada una sale UNA vez por reserva (dedup atómico en `email_log`).",
    entradas: [
      {
        id: "seq-pre-day3",
        nombre: "3 días antes de llegar",
        quien: "Huésped",
        cuando: "Cron 15:00 UTC, ventana [check-in −3, check-in).",
        origen: "app/api/cron/email-sequences/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildRestaurantEmailHtml({
            hotel: HOTEL_SEQ,
            customerName: CLIENTE,
            confirmacion: CONFIRMACION,
            checkin: CHECKIN,
            lang,
          }),
        }),
      },
      {
        id: "seq-pre-checkin",
        nombre: "El día de la llegada",
        quien: "Huésped",
        cuando: "Cron 15:00 UTC, el día del check-in.",
        origen: "app/api/cron/email-sequences/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildWelcomeGuideEmailHtml({
            hotel: HOTEL_SEQ,
            customerName: CLIENTE,
            confirmacion: CONFIRMACION,
            checkin: CHECKIN,
            habitaciones: HABS.join(", "),
            checkinHora: "3:00 PM",
            checkoutHora: "12:00 PM",
            direccion: "Carretera Xilitla km 3, San Luis Potosí",
            lang,
          }),
        }),
      },
      {
        id: "seq-post-day1",
        nombre: "Encuesta, 1 día después de salir",
        quien: "Huésped",
        cuando: "Cron 15:00 UTC, ventana [check-out +1, +3].",
        origen: "app/api/cron/email-sequences/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildSurveyEmailHtml({
            hotel: HOTEL_SEQ,
            customerName: CLIENTE,
            confirmacion: CONFIRMACION,
            checkin: CHECKIN,
            checkout: CHECKOUT,
            habitaciones: HABS.join(", "),
            resenaUrl: "http://localhost:3000/h/hotel-de-ejemplo/resena?r=demo",
            lang,
          }),
        }),
      },
      {
        id: "seq-post-day7",
        nombre: "Petición de reseña, 7 días después",
        quien: "Huésped",
        cuando: "Cron 15:00 UTC, ventana [check-out +7, +9].",
        origen: "app/api/cron/email-sequences/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildReviewEmailHtml({
            hotel: HOTEL_SEQ,
            customerName: CLIENTE,
            confirmacion: CONFIRMACION,
            checkin: CHECKIN,
            resenaUrl: "http://localhost:3000/h/hotel-de-ejemplo/resena?r=demo",
            lang,
          }),
        }),
      },
      {
        id: "seq-post-day30",
        nombre: "Oferta de regreso, 30 días después",
        quien: "Huésped",
        cuando: "Cron 15:00 UTC, ventana [check-out +30, +32]. La promo SÓLO va si el hotelero configuró una real.",
        origen: "app/api/cron/email-sequences/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildReturnOfferEmailHtml({
            hotel: HOTEL_SEQ,
            customerName: CLIENTE,
            confirmacion: CONFIRMACION,
            promoExpiry: dia(45),
            lang,
          }),
        }),
      },
      {
        id: "seq-post-day30-sin-promo",
        nombre: "Oferta de regreso — hotel SIN promo configurada",
        quien: "Huésped",
        cuando: "El mismo correo sin `promoCode`. Es el caso normal, y el que hay que leer para ver si promete un descuento que no existe.",
        origen: "app/api/cron/email-sequences/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildReturnOfferEmailHtml({
            hotel: { ...HOTEL_SEQ, promoCode: undefined, promoDiscount: undefined },
            customerName: CLIENTE,
            confirmacion: CONFIRMACION,
            lang,
          }),
        }),
      },
      {
        id: "oferta-personal",
        nombre: "Oferta personal (la escribe el hotelero)",
        quien: "Huésped",
        cuando: "A mano, desde el panel. El cuerpo lo teclea el hotelero.",
        origen: "app/api/admin/send-offer/route.ts",
        bilingue: true,
        render: (lang) => ({
          html: buildPersonalOfferEmailHtml({
            hotel: HOTEL_SEQ,
            customerName: CLIENTE,
            paragraphs: [
              "Te escribo porque tenemos la Suite Jungla libre el puente de noviembre y me acordé de tu estancia.",
              "Si te animas, te la dejo al mismo precio que pagaste.",
            ],
            ctaText: lang === "en" ? "Book again" : "Reservar otra vez",
            promoExpiry: dia(20),
            lang,
          }),
        }),
      },
    ],
  },
  {
    titulo: "El hotelero",
    nota: "Avisos operativos y el ciclo de la prueba gratis. Van al correo del hotel, no al del huésped.",
    entradas: [
      {
        id: "aviso-reserva",
        nombre: "Nueva reserva",
        quien: "Hotelero",
        cuando: "Al confirmarse el pago, o al crearla a mano en el panel.",
        origen: "app/api/h/webhooks/stripe/route.ts",
        render: () => ({
          html: buildAvisoReservaHotelHtml({
            hotelNombre: MARCA.nombre,
            panelUrl: PANEL,
            confirmacion: CONFIRMACION,
            cliente: CLIENTE,
            telefono: "481 000 0000",
            email: "maria@ejemplo.test",
            habitaciones: HABS,
            checkin: CHECKIN,
            checkout: CHECKOUT,
            huespedes: 2,
            total: 8800,
            anticipo: 2500,
            experiencias: ["Tour Sótano de las Huahuas ×2"],
          }),
        }),
      },
      {
        id: "aviso-reserva-garantia",
        nombre: "Nueva reserva — tarjeta en garantía, sin anticipo",
        quien: "Hotelero",
        cuando: "Mismo disparador con `pagoEnHotel: true` y anticipo 0. Es el caso que confunde: nadie cobró nada todavía.",
        origen: "app/api/h/webhooks/stripe/route.ts",
        render: () => ({
          html: buildAvisoReservaHotelHtml({
            hotelNombre: MARCA.nombre,
            panelUrl: PANEL,
            confirmacion: CONFIRMACION,
            cliente: CLIENTE,
            telefono: "481 000 0000",
            habitaciones: [HABS[0]],
            checkin: CHECKIN,
            checkout: CHECKOUT,
            huespedes: 2,
            total: 7500,
            anticipo: 0,
            pagoEnHotel: true,
          }),
        }),
      },
      {
        id: "aviso-cancelacion-portal",
        nombre: "Cancelación — la hizo el huésped",
        quien: "Hotelero",
        cuando: "El huésped canceló desde el portal. Aquí el hotelero se entera.",
        origen: "app/api/reserva/cancelar/route.ts",
        render: () => ({
          html: buildAvisoCancelacionHotelHtml({
            hotelNombre: MARCA.nombre,
            panelUrl: PANEL,
            confirmacion: CONFIRMACION,
            cliente: CLIENTE,
            email: "maria@ejemplo.test",
            habitaciones: HABS.join(", "),
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            origen: "portal",
          }),
        }),
      },
      {
        id: "aviso-cancelacion-panel",
        nombre: "Cancelación — la hizo el propio hotel",
        quien: "Hotelero",
        cuando: "El hotelero canceló desde su panel. No es un aviso: es el recordatorio de que ÉL debe devolver el anticipo.",
        origen: "app/api/admin/reservas/[id]/route.ts",
        render: () => ({
          html: buildAvisoCancelacionHotelHtml({
            hotelNombre: MARCA.nombre,
            panelUrl: PANEL,
            confirmacion: CONFIRMACION,
            cliente: CLIENTE,
            email: "maria@ejemplo.test",
            habitaciones: HABS.join(", "),
            checkin: CHECKIN,
            checkout: CHECKOUT,
            anticipo: 2500,
            origen: "panel",
          }),
        }),
      },
      {
        id: "pago-sin-cuarto-hotel",
        nombre: "Sobreventa: cobraron y no había cuarto",
        quien: "Hotelero",
        cuando: "Gemelo del correo al huésped. Le dice al hotel qué acaba de pasar.",
        origen: "app/api/h/webhooks/stripe/route.ts",
        render: () => ({
          html: buildPagoSinCuartoHotelHtml({
            hotelNombre: MARCA.nombre,
            cliente: CLIENTE,
            email: "maria@ejemplo.test",
            telefono: "481 000 0000",
            habitaciones: [HABS[0]],
            checkin: CHECKIN,
            checkout: CHECKOUT,
            monto: 2500,
            reembolsado: true,
          }),
        }),
      },
      {
        id: "bienvenida-hotel",
        nombre: "Bienvenida al crear su hotel",
        quien: "Hotelero",
        cuando: "Al terminar el alta del hotel en el panel.",
        origen: "app/api/panel/crear-hotel/route.ts",
        render: () => ({
          html: buildBienvenidaHotelHtml({
            hotelNombre: MARCA.nombre,
            slug: "hotel-de-ejemplo",
            nombreUsuario: "Manolo",
            diasPrueba: 30,
          }),
        }),
      },
      {
        id: "recordatorio-prueba",
        nombre: "A la prueba le quedan N días",
        quien: "Hotelero",
        cuando: "Cron diario 16:30 UTC, en los días de aviso antes de que venza la prueba.",
        origen: "app/api/cron/prueba/route.ts",
        render: () => ({
          html: buildRecordatorioPruebaHtml({ hotelNombre: MARCA.nombre, diasRestantes: 3 }),
        }),
      },
      {
        id: "prueba-pausada",
        nombre: "La prueba venció y el hotel se apagó",
        quien: "Hotelero",
        cuando: "Cron diario 16:30 UTC, el día que vence sin plan.",
        origen: "app/api/cron/prueba/route.ts",
        render: () => ({ html: buildPruebaPausadaHtml({ hotelNombre: MARCA.nombre }) }),
      },
      {
        id: "plan-activo",
        nombre: "Su plan quedó activo",
        quien: "Hotelero",
        cuando: "Webhook de suscripciones de Stripe, al primer cobro.",
        origen: "app/api/stripe/webhook/route.ts",
        render: () => emailBienvenida({ plan: "Kora", precio: 550 }),
      },
      {
        id: "pago-vencido",
        nombre: "Su pago falló (aviso 1 de 3)",
        quien: "Hotelero",
        cuando: "Cron diario 14:30 UTC mientras Stripe siga reintentando el cobro.",
        origen: "app/api/cron/dunning/route.ts",
        render: () => emailPagoVencido({ intento: 1 }),
      },
      {
        id: "pago-vencido-ultimo",
        nombre: "Su pago falló (último aviso)",
        quien: "Hotelero",
        cuando: "Mismo cron, tercer intento. Es el que amenaza con pausar el servicio.",
        origen: "app/api/cron/dunning/route.ts",
        render: () => emailPagoVencido({ intento: 3 }),
      },
    ],
  },
  {
    titulo: "Los que le llegan a Manolo",
    nota: "Correos internos del fundador: nadie más los ve. Salen a NOTIFY_EMAIL.",
    entradas: [
      {
        id: "hotel-nuevo",
        nombre: "Se dio de alta un hotel",
        quien: "Manolo",
        cuando: "Al crearse un hotel nuevo.",
        origen: "app/api/panel/crear-hotel/route.ts",
        render: () =>
          emailHotelNuevo({
            hotel: MARCA.nombre,
            ubicacion: MARCA.ubicacion,
            whatsapp: MARCA.whatsapp,
            email: MARCA.email,
            slug: "hotel-de-ejemplo",
            usuario: "Manolo",
            count: 11,
          }),
      },
      {
        id: "lead-nuevo",
        nombre: "Entró un lead",
        quien: "Manolo",
        cuando: "Al enviarse el formulario de contacto.",
        origen: "app/api/leads/route.ts",
        render: () =>
          emailLeadNuevo({
            nombre: "Luis Ejemplo",
            whatsapp: "5215500000000",
            email: "luis@ejemplo.test",
            hotel: "Posada de Ejemplo",
            origen: "/precios",
            detalles: "12 habitaciones, quiere dejar Booking.",
          }),
      },
      {
        id: "digest",
        nombre: "Resumen diario del CRM",
        quien: "Manolo",
        cuando: "Cron diario 14:00 UTC.",
        origen: "app/api/cron/digest/route.ts",
        render: () =>
          emailDigest({
            titulo: "Kora — 2 leads sin contactar",
            secciones: [
              {
                encabezado: "Leads sin contactar",
                lineas: [
                  "<strong>Luis Ejemplo</strong> — Posada de Ejemplo · hace 2 días",
                  "<strong>Ana Ejemplo</strong> — Hotel de Ejemplo · hace 1 día",
                ],
              },
              {
                encabezado: "Pagos con problema",
                lineas: ["<strong>Hotel de Ejemplo</strong> — 2º intento fallido"],
              },
            ],
          }),
      },
    ],
  },
  {
    titulo: "Los dos carriles de captación",
    nota: "Distintos a propósito: al lead se le vende desde el primer renglón porque pidió que le hablen; al suscriptor de la guía no se le vende hasta el quinto correo.",
    entradas: [
      {
        id: "lead-day0",
        nombre: "Lead · día 0",
        quien: "Hotelero",
        cuando: "Al instante, desde el propio formulario.",
        origen: "app/api/leads/route.ts",
        render: () => emailLeadSecuencia("lead_day0", { nombre: "Luis", hotel: "Posada de Ejemplo" }),
      },
      {
        id: "lead-day3",
        nombre: "Lead · día 3",
        quien: "Hotelero",
        cuando: "Cron diario 17:00 UTC. Se salta a quien ya ganaste, perdiste o pausaste.",
        origen: "app/api/cron/leads/route.ts",
        render: () => emailLeadSecuencia("lead_day3", { nombre: "Luis", hotel: "Posada de Ejemplo" }),
      },
      {
        id: "lead-day7",
        nombre: "Lead · día 7 (el último)",
        quien: "Hotelero",
        cuando: "Cron diario 17:00 UTC. Después de éste la secuencia se cierra sola.",
        origen: "app/api/cron/leads/route.ts",
        render: () => emailLeadSecuencia("lead_day7", { nombre: "Luis" }),
      },
      {
        id: "guia-0",
        nombre: "Guía · día 0 — la entrega",
        quien: "Hotelero",
        cuando: "Al instante, al suscribirse en /guia.",
        origen: "app/api/suscribir/route.ts",
        render: () => emailGuia("guia_0", { nombre: "Luis", token: "TOKEN-DE-EJEMPLO" }),
      },
      {
        id: "guia-2",
        nombre: "Guía · día 2",
        quien: "Hotelero",
        cuando: "Cron diario 17:30 UTC.",
        origen: "app/api/cron/suscriptores/route.ts",
        render: () => emailGuia("guia_2", { nombre: "Luis", token: "TOKEN-DE-EJEMPLO" }),
      },
      {
        id: "guia-5",
        nombre: "Guía · día 5",
        quien: "Hotelero",
        cuando: "Cron diario 17:30 UTC.",
        origen: "app/api/cron/suscriptores/route.ts",
        render: () => emailGuia("guia_5", { nombre: "Luis", token: "TOKEN-DE-EJEMPLO" }),
      },
      {
        id: "guia-9",
        nombre: "Guía · día 9",
        quien: "Hotelero",
        cuando: "Cron diario 17:30 UTC.",
        origen: "app/api/cron/suscriptores/route.ts",
        render: () => emailGuia("guia_9", { nombre: "Luis", token: "TOKEN-DE-EJEMPLO" }),
      },
      {
        id: "guia-14",
        nombre: "Guía · día 14 — la invitación",
        quien: "Hotelero",
        cuando: "Cron diario 17:30 UTC. El único de los cinco que vende.",
        origen: "app/api/cron/suscriptores/route.ts",
        render: () => emailGuia("guia_14", { nombre: "Luis", token: "TOKEN-DE-EJEMPLO" }),
      },
    ],
  },
  {
    titulo: "Documentos (no son correos)",
    nota: "Los descarga o imprime el hotelero desde el panel. Comparten la marca del hotel con los correos, y su plantilla es otra.",
    entradas: [
      {
        id: "doc-cotizacion",
        nombre: "Cotización",
        quien: "Hotelero",
        cuando: "Al pulsar imprimir/descargar en una cotización del panel.",
        origen: "app/api/admin/cotizaciones/[id]/render/route.ts",
        render: () => ({
          html: buildCotizacionDoc(MARCA, {
            folio: "COT-DEMO-01",
            fecha_emision: dia(0),
            valida_hasta: dia(7),
            cliente_nombre: CLIENTE,
            cliente_email: "maria@ejemplo.test",
            cliente_telefono: "481 000 0000",
            habitacion: HABS[0],
            huespedes: "2",
            noches: "3",
            entrada_dia: CHECKIN,
            entrada_detalle: "a partir de las 3:00 PM",
            salida_dia: CHECKOUT,
            salida_detalle: "antes de las 12:00 PM",
            conceptos: CONCEPTOS,
            subtotal: "$8,800.00",
            total: "$8,800.00",
            moneda: "MXN",
            anticipo_pct: "30%",
            anticipo: "$2,640.00",
            saldo: "$6,160.00",
          }),
        }),
      },
      {
        id: "doc-reserva",
        nombre: "Comprobante de reserva",
        quien: "Hotelero",
        cuando: "Al pulsar imprimir/descargar en una reserva del panel.",
        origen: "app/api/admin/reservas/[id]/render/route.ts",
        render: () => ({
          html: buildReservaDoc(MARCA, {
            folio: CONFIRMACION,
            fecha_reserva: dia(0),
            cliente_nombre: CLIENTE,
            cliente_email: "maria@ejemplo.test",
            cliente_telefono: "481 000 0000",
            habitacion: HABS[0],
            huespedes: "2",
            noches: "3",
            entrada_dia: CHECKIN,
            entrada_detalle: "a partir de las 3:00 PM",
            salida_dia: CHECKOUT,
            salida_detalle: "antes de las 12:00 PM",
            conceptos: CONCEPTOS,
            total_estancia: "$8,800.00",
            moneda: "MXN",
            anticipo_pagado: "$2,500.00",
            restante: "$6,300.00",
            metodo_pago: "Tarjeta (Stripe)",
            fecha_pago: dia(0),
          }),
        }),
      },
    ],
  },
];

/** Todas las entradas en una sola lista, en el orden en que se muestran. */
export const ENTRADAS: EntradaPreview[] = GRUPOS.flatMap((g) => g.entradas);

export function buscarEntrada(id: string): EntradaPreview | undefined {
  return ENTRADAS.find((e) => e.id === id);
}
