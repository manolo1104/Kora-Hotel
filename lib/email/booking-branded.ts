// Correos WHITE-LABEL del huésped: reserva confirmada y recordatorio (carrito
// abandonado). Diseño premium provisto por Manolo (fuente Plus Jakarta Sans,
// paleta verde Kora #1B4332/#52B788 + crema), tablas + inline-styles para
// compatibilidad con clientes de correo. El NOMBRE del hotel y los datos son
// dinámicos, y desde el 31 ago 2026 también el LOGO y el COLOR de la cabecera
// (si el color es oscuro; ver `cabeceraMarca`). El resto de la paleta se
// conserva tal cual. Bilingüe es/en.
// SOLO servidor. Los usan: send-email del panel, el webhook (confirmación) y el
// cron de abandono (recordatorio) — vía lib/email/reserva.ts.

import type { TourItem } from "@/lib/notas";
import type { HotelRow } from "@/lib/tenant";
// Tipografía, paleta y piezas: TODO viene del sistema de diseño único de
// correos. Aquí solo se mantienen los alias con los nombres locales para no
// reescribir el marcado, que ya seguía este mismo estilo.
import {
  T as TOK,
  esColorOscuro,
  FONT as FONT_KORA,
  doc as docKora,
  esc as escKora,
  money as moneyKora,
  parteFecha as parteFechaKora,
  gcalUrl as gcalUrlKora,
  pieHotel as pieHotelKora,
  waLink as waLinkKora,
  type Lang as LangKora,
} from "@/lib/email/design";
import { EMAIL_FROM } from "@/lib/contacto";

export interface BookingBrand {
  nombre: string;
  color: string; // se conserva por compatibilidad; el diseño usa su propia paleta
  logoUrl?: string;
  ubicacion?: string;
  whatsapp?: string; // dígitos, sin '+'
  email?: string;
  telefono?: string;
  mapsUrl?: string; // link "Cómo llegar" (extras.mapsUrl / config.maps_url)
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Fila `hoteles` → marca del correo. */
export function bookingBrandFromHotel(h: {
  nombre: string;
  ubicacion?: string | null;
  whatsapp?: string | null;
  config?: Record<string, unknown> | null;
  extras?: Record<string, unknown> | null;
}): BookingBrand {
  const config = (h.config ?? {}) as Record<string, unknown>;
  const extras = (h.extras ?? {}) as Record<string, unknown>;
  const diseno = (extras.diseno ?? {}) as Record<string, unknown>;
  return {
    nombre: h.nombre || "el hotel",
    color: str(diseno.color) || "#1B4332",
    logoUrl: str(diseno.logoUrl),
    ubicacion: h.ubicacion || str(config.ubicacion) || undefined,
    whatsapp: (h.whatsapp || str(config.whatsapp) || "").replace(/\D/g, "") || undefined,
    email: str(config.email_from) || str(config.email),
    telefono: str(config.telefono) || (h.whatsapp ?? undefined),
    mapsUrl: str(extras.mapsUrl) || str(config.maps_url),
  };
}

/** Remitente del hotel: config.email_from → RESEND_FROM → default Kora. */
export function bookingFromHotel(h: HotelRow): string {
  const config = (h.config ?? {}) as Record<string, unknown>;
  const fromCfg = typeof config.email_from === "string" ? config.email_from : "";
  return fromCfg || process.env.RESEND_FROM || EMAIL_FROM;
}

type Lang = LangKora;

const VERDE = TOK.verde;
const VERDE_CLARO = TOK.verdeClaro;
const FONT = FONT_KORA;

const money = moneyKora;
const esc = escKora;
const parteFecha = parteFechaKora;
const doc = docKora;

function gcalUrl(nombre: string, checkin: string, checkout: string): string {
  return gcalUrlKora(`Estancia en ${nombre}`, checkin, checkout);
}

function waLink(brand: BookingBrand, texto: string): string | null {
  return waLinkKora(brand.whatsapp, texto) || null;
}

function pieHotel(brand: BookingBrand): string {
  return pieHotelKora({ nombre: brand.nombre, ubicacion: brand.ubicacion });
}

/**
 * La cabecera de marca del hotel. `BookingBrand` declaraba `logoUrl` y `color`,
 * `bookingBrandFromHotel` los llenaba desde `extras.diseno` y **ninguno de los
 * dos se pintaba jamás**: la cabecera usaba el verde fijo de Kora. Mientras
 * tanto el documento imprimible del MISMO folio sí aplicaba el color, así que el
 * PDF y el correo del mismo hotel no se parecían — y tres comentarios del repo
 * prometían un "correo PREMIUM con logo + color del hotel" que no existía.
 *
 * El color sólo se usa si es oscuro (`esColorOscuro`): encima va texto blanco.
 *
 * El logo lleva SIEMPRE su `alt` con el nombre del hotel, y el nombre en texto
 * sigue debajo: Gmail y Outlook bloquean las imágenes remotas por defecto, así
 * que una cabecera que fuera sólo logo llegaría vacía a la mayoría de la gente
 * la primera vez que abre un correo de ese remitente.
 */
function cabeceraMarca(brand: BookingBrand, eyebrow: string, check: boolean): string {
  const fondo = esColorOscuro(brand.color) ? brand.color : VERDE;
  const logo = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.nombre)}" width="120" style="display:block;max-width:120px;height:auto;margin:0 auto 14px;border:0;outline:none;text-decoration:none;">`
    : "";
  return `<tr><td style="background:${fondo};padding:${check ? "34px 40px 30px" : "32px 40px"};text-align:center;">
    ${check ? `<div style="width:62px;height:62px;border-radius:50%;background:${VERDE_CLARO};color:#0f2e21;font-family:${FONT};font-size:32px;font-weight:700;line-height:62px;margin:0 auto 16px;">✓</div>` : ""}
    ${logo}
    <div style="font-family:${FONT};font-weight:800;font-size:23px;color:#fff;letter-spacing:-.5px;">${esc(brand.nombre)}<span style="color:${VERDE_CLARO};">.</span></div>
    <div style="font-family:${FONT};font-weight:600;font-size:10.5px;letter-spacing:3.5px;text-transform:uppercase;color:rgba(255,255,255,.62);margin-top:9px;">${esc(eyebrow)}</div>
  </td></tr>`;
}

// ── Confirmación / cotización (Correo 02) ────────────────────────────────────

export interface BrandedBookingParams {
  kind: "reserva" | "cotizacion";
  lang?: Lang;
  confirmacion: string;
  cliente: string;
  suites: string[];
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  total: number;
  anticipo?: number;
  restante?: number;
  notasCliente?: string;
  tourItems?: TourItem[];
  experiencias?: string[];
  portalUrl?: string;
  nrf?: boolean;
  checkinTime?: string; // p.ej. "3:00 PM" (de la guía del hotel)
  checkoutTime?: string; // p.ej. "12:00 PM"
}

export function buildBrandedBookingEmailHtml(brand: BookingBrand, p: BrandedBookingParams): string {
  const en = p.lang === "en";
  const first = (p.cliente || "").trim().split(" ")[0] || (en ? "guest" : "huésped");
  const esReserva = p.kind === "reserva";
  const anticipo = p.anticipo || 0;
  const restante = p.restante ?? p.total - anticipo;
  const ci = parteFecha(p.checkin, en);
  const co = parteFecha(p.checkout, en);

  const T = en
    ? {
        eyebrow: esReserva ? "Booking confirmed" : "Your quote",
        titulo: esReserva ? "You're all set for your stay!" : "Here's your quote",
        hola: "Hi", folio: "Confirmation",
        intro: esReserva
          ? `Your booking is <strong>confirmed</strong>. We've reserved your room — here are the details of your stay:`
          : `We prepared this quote for your stay. Reply whenever you'd like to confirm:`,
        entrada: "Check-in", salida: "Check-out", noche: (n: number) => (n === 1 ? "night" : "nights"),
        huesp: (n: number) => (n === 1 ? "guest" : "guests"),
        total: "Total for the stay", anticipoPagado: "Deposit paid", restante: "Balance on arrival",
        aPagar: "To pay", nrf: "Non-refundable rate", experiencias: "Experiences included",
        wa: "Message us on WhatsApp 💬", confirmarWa: "Confirm on WhatsApp 💬",
        cal: "📅 Add to calendar", mapa: "📍 Directions",
        portal: (u: string) => `Manage your booking at <a href="${u}" style="color:${VERDE};font-weight:600;">this link</a> with your confirmation and email.`,
        habitacion: "Room",
      }
    : {
        eyebrow: esReserva ? "Reserva confirmada" : "Tu cotización",
        titulo: esReserva ? "¡Todo listo para tu llegada!" : "Aquí está tu cotización",
        hola: "Hola", folio: "Folio",
        intro: esReserva
          ? `Tu reserva quedó <strong>confirmada</strong>. Ya reservamos tu habitación — estos son los detalles de tu estancia:`
          : `Preparamos esta cotización para tu estancia. Cuando quieras confirmarla, respóndenos y con gusto te ayudamos:`,
        entrada: "Entrada", salida: "Salida", noche: (n: number) => (n === 1 ? "noche" : "noches"),
        huesp: (n: number) => (n === 1 ? "huésped" : "huéspedes"),
        total: "Total de la estancia", anticipoPagado: "Anticipo pagado", restante: "Restante al llegar",
        aPagar: "A pagar", nrf: "Tarifa no reembolsable", experiencias: "Experiencias incluidas",
        wa: "Escríbenos por WhatsApp 💬", confirmarWa: "Confirmar por WhatsApp 💬",
        cal: "📅 Añadir al calendario", mapa: "📍 Cómo llegar",
        portal: (u: string) => `Consulta o gestiona tu reserva en <a href="${u}" style="color:${VERDE};font-weight:600;">este enlace</a> con tu folio y tu correo.`,
        habitacion: "Habitación",
      };

  const wa = waLink(
    brand,
    `${en ? "Hi" : "Hola"}, ${en ? "about my" : "sobre mi"} ${esReserva ? (en ? "booking" : "reserva") : en ? "quote" : "cotización"} ${p.confirmacion} — ${brand.nombre}`,
  );

  const header = cabeceraMarca(brand, T.eyebrow, esReserva);

  const subLine = [p.huespedes > 0 ? `${p.huespedes} ${T.huesp(p.huespedes)}` : "", p.nrf ? T.nrf : ""]
    .filter(Boolean)
    .join(" · ");

  const expItems =
    p.tourItems && p.tourItems.length
      ? p.tourItems.map((t) => `${esc(t.nombre)} <span style="color:#a99a82;">· ${t.personas} pax</span>`)
      : p.experiencias && p.experiencias.length
        ? p.experiencias.map((e) => esc(e))
        : [];

  const dinero = esReserva
    ? `<tr><td style="padding:12px 0 0;font-family:${FONT};font-weight:400;font-size:14px;color:#8a7d6b;">${T.total}</td><td style="padding:12px 0 0;text-align:right;font-family:${FONT};font-weight:400;font-size:14px;color:#5a5142;">${money(p.total)}</td></tr>
       ${anticipo > 0 ? `<tr><td style="padding:7px 0;font-family:${FONT};font-weight:400;font-size:14px;color:#8a7d6b;">${T.anticipoPagado}</td><td style="padding:7px 0;text-align:right;font-family:${FONT};font-weight:400;font-size:14px;color:#2d7a54;">− ${money(anticipo)}</td></tr>` : ""}
       <tr><td colspan="2" style="border-top:1px solid #eee6d8;padding-top:3px;"></td></tr>
       <tr><td style="padding:6px 0 0;font-family:${FONT};font-weight:700;font-size:15px;color:#2a2218;">${anticipo > 0 ? T.restante : T.aPagar}</td><td style="padding:6px 0 0;text-align:right;font-family:${FONT};font-size:20px;font-weight:700;color:#2a2218;">${money(restante)}</td></tr>`
    : `<tr><td style="padding:12px 0 0;font-family:${FONT};font-weight:700;font-size:15px;color:#2a2218;">${T.aPagar}</td><td style="padding:12px 0 0;text-align:right;font-family:${FONT};font-size:20px;font-weight:700;color:#2a2218;">${money(p.total)}</td></tr>`;

  const inner = `
    ${header}
    <tr><td style="padding:34px 40px 0;text-align:center;">
      <h2 style="font-family:${FONT};font-size:28px;font-weight:800;letter-spacing:-1px;color:#2a2218;line-height:1.15;margin:0 0 8px;">${T.titulo}</h2>
      <div style="font-family:${FONT};font-weight:400;font-size:13px;color:#9aa0a6;">${T.folio} <strong style="color:#5a5142;letter-spacing:1px;">${esc(p.confirmacion)}</strong></div>
    </td></tr>
    <tr><td style="padding:22px 40px 0;">
      <p style="font-family:${FONT};font-weight:500;font-size:16px;color:#2a2218;margin:0 0 6px;">${T.hola}, ${esc(first)}</p>
      <p style="font-family:${FONT};font-weight:400;font-size:14.5px;color:#5a5142;line-height:1.75;margin:0;">${T.intro}</p>
    </td></tr>
    <tr><td style="padding:22px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fdfbf7;border:1px solid #eee6d8;border-radius:14px;">
        <tr><td style="padding:22px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="text-align:center;width:42%;vertical-align:top;">
              <div style="font-family:${FONT};font-weight:600;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:6px;">${T.entrada}</div>
              <div style="font-family:${FONT};font-size:26px;color:#2a2218;line-height:1;">${ci.dia}</div>
              <div style="font-family:${FONT};font-weight:500;font-size:12px;color:#8a7d6b;margin-top:4px;">${ci.diaSem} · ${ci.mesAnio}</div>
              ${p.checkinTime ? `<div style="font-family:${FONT};font-weight:500;font-size:11px;color:#a99a82;margin-top:2px;">${esc(p.checkinTime)}</div>` : ""}
            </td>
            <td style="text-align:center;vertical-align:middle;font-family:${FONT};font-weight:600;font-size:11px;color:#b3a58c;white-space:nowrap;">${p.noches} ${T.noche(p.noches)}<br>→</td>
            <td style="text-align:center;width:42%;vertical-align:top;">
              <div style="font-family:${FONT};font-weight:600;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:6px;">${T.salida}</div>
              <div style="font-family:${FONT};font-size:26px;color:#2a2218;line-height:1;">${co.dia}</div>
              <div style="font-family:${FONT};font-weight:500;font-size:12px;color:#8a7d6b;margin-top:4px;">${co.diaSem} · ${co.mesAnio}</div>
              ${p.checkoutTime ? `<div style="font-family:${FONT};font-weight:500;font-size:11px;color:#a99a82;margin-top:2px;">${esc(p.checkoutTime)}</div>` : ""}
            </td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 40px 0;">
      <div style="font-family:${FONT};font-weight:400;font-size:14.5px;color:#5a5142;line-height:1.7;"><strong style="color:#2a2218;">${p.suites.map(esc).join(", ") || T.habitacion}</strong>${subLine ? `<br><span style="color:#8a7d6b;">${subLine}</span>` : ""}</div>
    </td></tr>
    ${
      expItems.length
        ? `<tr><td style="padding:14px 40px 0;">
            <div style="font-family:${FONT};font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:8px;">${T.experiencias}</div>
            ${expItems.map((h) => `<div style="font-family:${FONT};font-weight:400;font-size:14px;color:#5a5142;padding:5px 0;border-bottom:1px solid #eee6d8;">${h}</div>`).join("")}
          </td></tr>`
        : ""
    }
    ${
      p.notasCliente && p.notasCliente.trim()
        ? `<tr><td style="padding:14px 40px 0;"><div style="background:#f3efe7;border-radius:10px;padding:13px 16px;font-family:${FONT};font-size:13px;color:#5a5142;line-height:1.6;">${esc(p.notasCliente.trim())}</div></td></tr>`
        : ""
    }
    <tr><td style="padding:20px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eee6d8;">${dinero}</table>
    </td></tr>
    ${
      wa
        ? `<tr><td style="padding:26px 40px 0;text-align:center;">
            <a href="${wa}" style="display:inline-block;background:${VERDE_CLARO};color:#0f2e21;font-family:${FONT};font-weight:700;font-size:14px;text-decoration:none;padding:15px 40px;border-radius:999px;">${esReserva ? T.wa : T.confirmarWa}</a>
          </td></tr>`
        : ""
    }
    ${
      esReserva
        ? `<tr><td style="padding:16px 40px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="width:50%;padding-right:6px;"><a href="${gcalUrl(brand.nombre, p.checkin, p.checkout)}" style="display:block;text-align:center;border:1px solid #d9cdb6;border-radius:10px;padding:11px 0;font-family:${FONT};font-weight:600;font-size:12.5px;color:#5a5142;text-decoration:none;">${T.cal}</a></td>
              ${brand.mapsUrl ? `<td style="width:50%;padding-left:6px;"><a href="${esc(brand.mapsUrl)}" style="display:block;text-align:center;border:1px solid #d9cdb6;border-radius:10px;padding:11px 0;font-family:${FONT};font-weight:600;font-size:12.5px;color:#5a5142;text-decoration:none;">${T.mapa}</a></td>` : ""}
            </tr></table>
          </td></tr>`
        : ""
    }
    ${
      esReserva && p.portalUrl
        ? `<tr><td style="padding:14px 40px 0;text-align:center;"><div style="font-family:${FONT};font-size:12px;color:#9aa0a6;line-height:1.6;">${T.portal(p.portalUrl)}</div></td></tr>`
        : ""
    }
    <tr><td style="padding:20px 0 0;"></td></tr>
    ${pieHotel(brand)}`;

  return doc(`${brand.nombre} — ${T.eyebrow}`, `${T.eyebrow} ${p.confirmacion} — ${brand.nombre}`, inner, en ? "en" : "es");
}

// ── Recordatorio / carrito abandonado (Correo 01) ────────────────────────────

export interface BrandedRecoveryParams {
  lang?: Lang;
  nombre?: string | null;
  checkin?: string | null;
  checkout?: string | null;
  reanudarUrl: string;
  suites?: string[]; // cuarto(s) del carrito
  huespedes?: number;
  noches?: number;
  total?: number; // total estimado del carrito
}

// El apartado del motor dura 35 MINUTOS (sql/kora-e3-apartado-atomico.sql,
// `p_minutos int default 35`), y este correo lo manda un cron diario que sólo
// mira carritos de entre 2 y 48 horas de antigüedad
// (app/api/cron/abandono/route.ts). O sea: cuando el huésped lo abre, su
// apartado lleva al menos hora y media muerto. Prometerle que "guardamos tu
// selección por 24 horas" —lo que decía hasta hoy— no era una imprecisión: le
// decía que no corriera prisa justo cuando su cuarto ya estaba a la venta.
export function buildBrandedRecoveryEmailHtml(brand: BookingBrand, p: BrandedRecoveryParams): string {
  const en = p.lang === "en";
  const tieneFechas = Boolean(p.checkin && p.checkout);
  const ci = tieneFechas ? parteFecha(p.checkin as string, en) : null;
  const co = tieneFechas ? parteFecha(p.checkout as string, en) : null;

  const T = en
    ? {
        eyebrow: "Almost there", titulo: "Your getaway is waiting", hola: "Hi",
        intro: "You started booking but didn't confirm. Don't worry — we saved your selection just as you left it. Only one step to go.",
        sinConfirmar: "● Not confirmed", huesp: (n: number) => (n === 1 ? "guest" : "guests"),
        noche: (n: number) => (n === 1 ? "night" : "nights"), entrada: "Check-in", salida: "Check-out",
        totalEst: "Estimated total", nota: `⏳ Your selection is still here, but <strong>it is not being held</strong> — availability and pricing are confirmed when you complete the booking.`,
        cta: "Finish my booking →", ayuda: "Prefer some help?", waTexto: "Message us on WhatsApp",
        habitacion: "Your room",
      }
    : {
        eyebrow: "Casi lo tenías", titulo: "Tu escapada te está esperando", hola: "Hola",
        intro: "Empezaste a reservar pero no llegaste a confirmar. No te preocupes — guardamos tu selección tal como la dejaste. Solo falta un paso.",
        sinConfirmar: "● Sin confirmar", huesp: (n: number) => (n === 1 ? "huésped" : "huéspedes"),
        noche: (n: number) => (n === 1 ? "noche" : "noches"), entrada: "Entrada", salida: "Salida",
        totalEst: "Total estimado", nota: `⏳ Tu selección sigue aquí, pero <strong>no está apartada</strong> — la disponibilidad y la tarifa se confirman al terminar la reserva.`,
        cta: "Terminar mi reserva →", ayuda: "¿Prefieres que te ayudemos?", waTexto: "Escríbenos por WhatsApp",
        habitacion: "Tu habitación",
      };
  const saludo = p.nombre ? `${T.hola}, ${esc(p.nombre)} 👋` : `${T.hola} 👋`;
  const sub = [
    p.huespedes && p.huespedes > 0 ? `${p.huespedes} ${T.huesp(p.huespedes)}` : "",
    p.noches && p.noches > 0 ? `${p.noches} ${T.noche(p.noches)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const wa = waLink(brand, `${en ? "Hi" : "Hola"}, ${en ? "I want to finish my booking at" : "quiero terminar mi reserva en"} ${brand.nombre}`);

  const inner = `
    ${cabeceraMarca(brand, T.eyebrow, false)}
    <tr><td style="padding:34px 40px 0;">
      <h2 style="font-family:${FONT};font-size:28px;font-weight:800;letter-spacing:-1px;color:#2a2218;line-height:1.15;margin:0 0 14px;">${T.titulo}</h2>
      <p style="font-family:${FONT};font-weight:500;font-size:16px;color:#2a2218;margin:0 0 6px;">${saludo}</p>
      <p style="font-family:${FONT};font-weight:400;font-size:14.5px;color:#5a5142;line-height:1.75;margin:0;">${T.intro}</p>
    </td></tr>
    <tr><td style="padding:22px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1.5px dashed #c9b99a;border-radius:14px;background:#fdfbf7;">
        <tr><td style="padding:20px 22px 4px;">
          <span style="display:inline-block;background:#FBEFD3;color:#946200;font-family:${FONT};font-weight:700;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:5px 11px;border-radius:999px;">${T.sinConfirmar}</span>
        </td></tr>
        <tr><td style="padding:12px 22px 0;">
          <div style="font-family:${FONT};font-size:20px;color:#2a2218;">${p.suites && p.suites.length ? p.suites.map(esc).join(", ") : T.habitacion}</div>
          ${sub ? `<div style="font-family:${FONT};font-weight:500;font-size:13px;color:#8a7d6b;margin-top:3px;">${sub}</div>` : ""}
        </td></tr>
        ${
          tieneFechas && ci && co
            ? `<tr><td style="padding:16px 22px 4px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eee6d8;"><tr>
                  <td style="padding:14px 0;text-align:center;width:42%;">
                    <div style="font-family:${FONT};font-weight:600;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:5px;">${T.entrada}</div>
                    <div style="font-family:${FONT};font-size:24px;color:#2a2218;line-height:1;">${ci.dia}</div>
                    <div style="font-family:${FONT};font-weight:500;font-size:12px;color:#8a7d6b;margin-top:3px;">${ci.mesAnio}</div>
                  </td>
                  <td style="text-align:center;vertical-align:middle;font-family:${FONT};font-weight:600;font-size:11px;color:#b3a58c;white-space:nowrap;">${p.noches ? `${p.noches} ${T.noche(p.noches)}` : ""}<br>→</td>
                  <td style="padding:14px 0;text-align:center;width:42%;">
                    <div style="font-family:${FONT};font-weight:600;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#a99a82;margin-bottom:5px;">${T.salida}</div>
                    <div style="font-family:${FONT};font-size:24px;color:#2a2218;line-height:1;">${co.dia}</div>
                    <div style="font-family:${FONT};font-weight:500;font-size:12px;color:#8a7d6b;margin-top:3px;">${co.mesAnio}</div>
                  </td>
                </tr></table>
              </td></tr>`
            : ""
        }
        ${
          p.total && p.total > 0
            ? `<tr><td style="padding:4px 22px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eee6d8;"><tr>
                  <td style="padding:14px 0 0;font-family:${FONT};font-weight:500;font-size:13.5px;color:#8a7d6b;">${T.totalEst}</td>
                  <td style="padding:14px 0 0;text-align:right;font-family:${FONT};font-size:20px;color:#2a2218;">${money(p.total)}</td>
                </tr></table>
              </td></tr>`
            : `<tr><td style="padding:0 0 12px;"></td></tr>`
        }
      </table>
    </td></tr>
    <tr><td style="padding:18px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e4f3ea;border-radius:12px;">
        <tr><td style="padding:14px 18px;font-family:${FONT};font-weight:500;font-size:13px;color:${VERDE};line-height:1.5;">${T.nota}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:26px 40px 6px;text-align:center;">
      <a href="${esc(p.reanudarUrl)}" style="display:inline-block;background:${VERDE};color:#faf8f5;font-family:${FONT};font-weight:700;font-size:14px;text-decoration:none;padding:15px 40px;border-radius:999px;">${T.cta}</a>
    </td></tr>
    ${
      wa
        ? `<tr><td style="padding:2px 40px 4px;text-align:center;"><p style="font-family:${FONT};font-weight:400;font-size:13px;color:#9a8a74;margin:0;">${T.ayuda} <a href="${wa}" style="color:${VERDE};font-weight:600;text-decoration:none;">${T.waTexto}</a></p></td></tr>`
        : ""
    }
    <tr><td style="padding:18px 0 0;"></td></tr>
    ${pieHotel(brand)}`;

  return doc(`${brand.nombre} — ${T.eyebrow}`, `${T.titulo} — ${brand.nombre}`, inner, en ? "en" : "es");
}
