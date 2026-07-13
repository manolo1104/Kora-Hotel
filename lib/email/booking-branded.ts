// Correos WHITE-LABEL del huésped: usan la marca de CADA hotel (nombre, logo,
// color). Diseño premium, responsive, inline-styles (compatibilidad de email).
// Comparten un SHELL de marca (cabecera con logo/color + pie). Bilingüe es/en.
// SOLO servidor. Los usan: send-email del panel, el webhook (confirmación
// automática) y el cron de abandono (recuperación) — vía lib/email/reserva.ts.

import { inkFor, COLOR_DEFAULT } from "@/lib/mini";
import { fmtDateFull, getDay, getMonthYear, type TourItem } from "@/lib/booking-html";
import type { HotelRow } from "@/lib/tenant";

export interface BookingBrand {
  nombre: string;
  color: string;
  logoUrl?: string;
  ubicacion?: string;
  whatsapp?: string; // dígitos, sin '+'
  email?: string;
  telefono?: string;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Fila `hoteles` → marca del correo (color/logo desde extras.diseno). Acepta
 *  cualquier objeto con estos campos (la fila completa o un select parcial). */
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
    color: str(diseno.color) || COLOR_DEFAULT,
    logoUrl: str(diseno.logoUrl),
    ubicacion: h.ubicacion || str(config.ubicacion) || undefined,
    whatsapp: (h.whatsapp || str(config.whatsapp) || "").replace(/\D/g, "") || undefined,
    email: str(config.email_from) || str(config.email),
    telefono: str(config.telefono) || (h.whatsapp ?? undefined),
  };
}

/** Remitente del hotel: config.email_from → RESEND_FROM → default Kora. */
export function bookingFromHotel(h: HotelRow): string {
  const config = (h.config ?? {}) as Record<string, unknown>;
  const fromCfg = typeof config.email_from === "string" ? config.email_from : "";
  return fromCfg || process.env.RESEND_FROM || "Kora <hola@kora-hotel.com>";
}

type Lang = "es" | "en";

const money = (n: number) => `$${Math.round(n || 0).toLocaleString("es-MX")} MXN`;
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Shell de marca compartido ────────────────────────────────────────────────
// Cabecera (logo o nombre sobre el color de marca) + eyebrow + cuerpo + pie.
function brandedShell(
  brand: BookingBrand,
  opts: { eyebrow: string; preheader: string; inner: string },
): string {
  const color = brand.color || COLOR_DEFAULT;
  const ink = inkFor(color);
  const cabecera = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.nombre)}" style="max-height:44px;width:auto;display:block;margin:0 auto;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:600;color:${ink};letter-spacing:0.5px;">${esc(brand.nombre)}</div>`;
  const contactoPie = [brand.ubicacion, brand.telefono, brand.email].filter(Boolean).map(esc).join(" · ");
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand.nombre)} — ${esc(opts.eyebrow)}</title></head>
<body style="margin:0;padding:0;background:#f0eee9;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0eee9;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:${color};padding:26px 40px;text-align:center;">
        ${cabecera}
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${ink};opacity:0.75;margin-top:10px;">${esc(opts.eyebrow)}</div>
      </td></tr>
      ${opts.inner}
      <tr><td style="padding:26px 40px 30px;text-align:center;border-top:1px solid #f0efe9;">
        <div style="font-family:Georgia,serif;font-size:16px;color:#1a1a1a;font-weight:600;">${esc(brand.nombre)}</div>
        ${contactoPie ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:#9aa0a6;margin-top:6px;">${contactoPie}</div>` : ""}
        <div style="font-family:Arial,sans-serif;font-size:11px;color:#c4c4bd;margin-top:16px;">Enviado con <a href="https://kora-hotel.com" style="color:#9aa0a6;text-decoration:none;">Kora</a> · sistema de reservas para hoteles</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Confirmación / cotización ────────────────────────────────────────────────

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
  experiencias?: string[]; // alternativa simple a tourItems (texto ya formateado)
  portalUrl?: string; // link a /reserva/consultar
  nrf?: boolean; // tarifa no reembolsable
}

export function buildBrandedBookingEmailHtml(brand: BookingBrand, p: BrandedBookingParams): string {
  const en = p.lang === "en";
  const first = (p.cliente || "").trim().split(" ")[0] || (en ? "guest" : "huésped");
  const esReserva = p.kind === "reserva";
  const anticipo = p.anticipo || 0;
  const restante = p.restante ?? p.total - anticipo;

  const T = en
    ? {
        eyebrow: esReserva ? "Booking confirmed" : "Your quote",
        titulo: esReserva ? "You're all set for your stay!" : "Here's your quote",
        intro: esReserva
          ? `Your booking at <strong>${esc(brand.nombre)}</strong> is confirmed. Here are the details of your stay:`
          : `We prepared this quote for your stay at <strong>${esc(brand.nombre)}</strong>. Reply whenever you'd like to confirm:`,
        hola: "Hi", folio: "Confirmation", entrada: "Check-in", salida: "Check-out",
        noche: (n: number) => (n === 1 ? "night" : "nights"), huesp: (n: number) => (n === 1 ? "guest" : "guests"),
        experiencias: "Experiences included", notas: "Notes",
        total: "Total for the stay", anticipoPagado: "Deposit paid", restante: "Balance on arrival",
        aPagar: "To pay", totalCotizado: "Quoted total", nrf: "Non-refundable rate",
        cta: esReserva ? "Message us on WhatsApp" : "Confirm on WhatsApp",
        portal: (u: string) => `Manage your booking at <a href="${u}" style="color:${brand.color};">${u}</a> with your confirmation number and email.`,
        habitacion: "Room",
      }
    : {
        eyebrow: esReserva ? "Reserva confirmada" : "Tu cotización",
        titulo: esReserva ? "¡Todo listo para tu llegada!" : "Aquí está tu cotización",
        intro: esReserva
          ? `Tu reserva en <strong>${esc(brand.nombre)}</strong> quedó confirmada. Estos son los detalles de tu estancia:`
          : `Preparamos esta cotización para tu estancia en <strong>${esc(brand.nombre)}</strong>. Cuando quieras confirmarla, respóndenos y con gusto te ayudamos:`,
        hola: "Hola", folio: "Folio", entrada: "Entrada", salida: "Salida",
        noche: (n: number) => (n === 1 ? "noche" : "noches"), huesp: (n: number) => (n === 1 ? "huésped" : "huéspedes"),
        experiencias: "Experiencias incluidas", notas: "Notas",
        total: "Total de la estancia", anticipoPagado: "Anticipo pagado", restante: "Restante al llegar",
        aPagar: "A pagar", totalCotizado: "Total cotizado", nrf: "Tarifa no reembolsable",
        cta: esReserva ? "Escríbenos por WhatsApp" : "Confirmar por WhatsApp",
        portal: (u: string) => `Consulta o gestiona tu reserva en <a href="${u}" style="color:${brand.color};">${u}</a> con tu folio y tu correo.`,
        habitacion: "Habitación",
      };

  const cell = (label: string, big: string, small: string) => `
    <td style="padding:0 8px;text-align:center;vertical-align:top;">
      <div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9aa0a6;margin-bottom:6px;">${label}</div>
      <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1;">${big}</div>
      <div style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:4px;">${small}</div>
    </td>`;

  const expItems =
    p.tourItems && p.tourItems.length
      ? p.tourItems.map((t) => `${esc(t.nombre)} <span style="color:#9aa0a6;">· ${t.personas} pax</span>`)
      : p.experiencias && p.experiencias.length
        ? p.experiencias.map((e) => esc(e))
        : [];
  const tours = expItems.length
    ? `<tr><td style="padding:0 40px 8px;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9aa0a6;margin:8px 0 8px;">${T.experiencias}</div>
        ${expItems.map((h) => `<div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;padding:6px 0;border-bottom:1px solid #f0f0ee;">${h}</div>`).join("")}
      </td></tr>`
    : "";

  const notas =
    p.notasCliente && p.notasCliente.trim()
      ? `<tr><td style="padding:8px 40px 0;">
          <div style="background:#faf9f6;border-radius:10px;padding:14px 18px;font-family:Arial,sans-serif;font-size:13px;color:#4b5563;line-height:1.6;">
            <strong style="color:#374151;">${T.notas}:</strong> ${esc(p.notasCliente.trim())}
          </div>
        </td></tr>`
      : "";

  const dineroFila = (label: string, valor: string, fuerte = false) => `
    <tr>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:${fuerte ? "#1a1a1a" : "#6b7280"};padding:7px 0;${fuerte ? "font-weight:700;" : ""}">${label}</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:${fuerte ? "#1a1a1a" : "#374151"};padding:7px 0;text-align:right;${fuerte ? "font-weight:700;" : ""}">${valor}</td>
    </tr>`;

  const bloqueDinero = esReserva
    ? `${dineroFila(T.total, money(p.total))}
       ${anticipo > 0 ? dineroFila(T.anticipoPagado, `− ${money(anticipo)}`) : ""}
       <tr><td colspan="2" style="border-top:1px solid #eeece7;padding-top:4px;"></td></tr>
       ${dineroFila(anticipo > 0 ? T.restante : T.aPagar, money(restante), true)}`
    : `${dineroFila(T.totalCotizado, money(p.total), true)}`;

  const cta = brand.whatsapp
    ? `<tr><td style="padding:24px 40px 8px;text-align:center;">
        <a href="https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(`${en ? "Hi" : "Hola"}, ${en ? "about my" : "sobre mi"} ${esReserva ? (en ? "booking" : "reserva") : (en ? "quote" : "cotización")} ${p.confirmacion} — ${brand.nombre}`)}"
           style="display:inline-block;background:${brand.color};color:${inkFor(brand.color)};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:999px;">
          ${T.cta}
        </a>
      </td></tr>`
    : "";

  const portal =
    esReserva && p.portalUrl
      ? `<tr><td style="padding:10px 40px 0;text-align:center;">
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#9aa0a6;line-height:1.6;">${T.portal(p.portalUrl)}</div>
        </td></tr>`
      : "";

  const subLine = [p.huespedes > 0 ? `${p.huespedes} ${T.huesp(p.huespedes)}` : "", p.nrf ? T.nrf : ""]
    .filter(Boolean)
    .join(" · ");

  const inner = `
      <tr><td style="padding:34px 40px 8px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.25;">${T.titulo}</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#9aa0a6;margin-top:8px;">${T.folio} <strong style="color:#4b5563;letter-spacing:1px;">${esc(p.confirmacion)}</strong></div>
      </td></tr>
      <tr><td style="padding:14px 40px 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:20px;color:#1a1a1a;">${T.hola}, ${esc(first)}</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#4b5563;line-height:1.7;">${T.intro}</p>
      </td></tr>
      <tr><td style="padding:22px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;border-radius:12px;">
          <tr><td style="padding:22px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              ${cell(T.entrada, getDay(p.checkin), getMonthYear(p.checkin))}
              <td style="text-align:center;vertical-align:middle;font-family:Arial,sans-serif;font-size:11px;color:#9aa0a6;white-space:nowrap;">${p.noches} ${T.noche(p.noches)}<br/>→</td>
              ${cell(T.salida, getDay(p.checkout), getMonthYear(p.checkout))}
            </tr></table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 40px 0;">
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.7;">
          <strong style="color:#1a1a1a;">${p.suites.map(esc).join(", ") || T.habitacion}</strong>${subLine ? `<br/><span style="color:#6b7280;">${subLine}</span>` : ""}
        </div>
      </td></tr>
      ${tours}
      ${notas}
      <tr><td style="padding:20px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eeece7;padding-top:6px;">
          ${bloqueDinero}
        </table>
      </td></tr>
      ${cta}
      ${portal}`;

  return brandedShell(brand, {
    eyebrow: T.eyebrow,
    preheader: `${T.eyebrow} ${p.confirmacion} — ${brand.nombre}`,
    inner,
  });
}

// ── Recuperación de reserva (carrito abandonado) ─────────────────────────────

export interface BrandedRecoveryParams {
  lang?: Lang;
  nombre?: string | null;
  checkin?: string | null;
  checkout?: string | null;
  reanudarUrl: string;
}

export function buildBrandedRecoveryEmailHtml(brand: BookingBrand, p: BrandedRecoveryParams): string {
  const en = p.lang === "en";
  const T = en
    ? {
        eyebrow: "Your booking is waiting",
        titulo: "You're one step from your stay",
        hola: "Hi",
        intro: (h: string) => `we saved your search at <strong>${esc(h)}</strong> so you can pick up right where you left off.`,
        fechas: "Your dates",
        cta: "Complete my booking",
        scarcity: "Availability isn't held until you finish — rooms are released to other guests.",
      }
    : {
        eyebrow: "Tu reserva te espera",
        titulo: "Estás a un paso de tu estancia",
        hola: "Hola",
        intro: (h: string) => `guardamos tu búsqueda en <strong>${esc(h)}</strong> para que la retomes justo donde te quedaste.`,
        fechas: "Tus fechas",
        cta: "Completar mi reserva",
        scarcity: "La disponibilidad no se aparta hasta terminar: los cuartos se liberan a otros huéspedes.",
      };
  const saludo = p.nombre ? `${T.hola}, ${esc(p.nombre)}` : `${T.hola}`;
  const fechas =
    p.checkin && p.checkout
      ? `<tr><td style="padding:16px 40px 0;text-align:center;">
          <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9aa0a6;margin-bottom:6px;">${T.fechas}</div>
          <div style="font-family:Georgia,serif;font-size:18px;color:#1a1a1a;">${esc(fmtDateFull(p.checkin))} → ${esc(fmtDateFull(p.checkout))}</div>
        </td></tr>`
      : "";

  const inner = `
      <tr><td style="padding:34px 40px 8px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.25;">${T.titulo}</div>
      </td></tr>
      <tr><td style="padding:14px 40px 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:20px;color:#1a1a1a;">${saludo}</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#4b5563;line-height:1.7;">${T.intro(brand.nombre)}</p>
      </td></tr>
      ${fechas}
      <tr><td style="padding:24px 40px 4px;text-align:center;">
        <a href="${esc(p.reanudarUrl)}" style="display:inline-block;background:${brand.color};color:${inkFor(brand.color)};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:999px;">${T.cta}</a>
      </td></tr>
      <tr><td style="padding:12px 40px 0;text-align:center;">
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#9aa0a6;line-height:1.6;">${T.scarcity}</div>
      </td></tr>`;

  return brandedShell(brand, {
    eyebrow: T.eyebrow,
    preheader: `${T.titulo} — ${brand.nombre}`,
    inner,
  });
}
