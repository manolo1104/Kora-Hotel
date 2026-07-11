// Correo WHITE-LABEL de reserva/cotización: usa la marca de CADA hotel (nombre,
// logo, color) en vez de estar hardcodeado a un hotel. Reemplaza al viejo
// buildBookingHtml (100% Paraíso) para los correos. Diseño premium, responsive,
// inline-styles (compatibilidad de email). Pie discreto "Enviado con Kora".
// SOLO servidor (lo llaman las rutas send-email).

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

/** Fila `hoteles` → marca del correo (color/logo desde extras.diseno). */
export function bookingBrandFromHotel(h: HotelRow): BookingBrand {
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

export interface BrandedBookingParams {
  kind: "reserva" | "cotizacion";
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
}

const money = (n: number) => `$${Math.round(n || 0).toLocaleString("es-MX")} MXN`;
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildBrandedBookingEmailHtml(brand: BookingBrand, p: BrandedBookingParams): string {
  const color = brand.color || COLOR_DEFAULT;
  const ink = inkFor(color); // texto legible sobre el color de marca
  const first = (p.cliente || "").trim().split(" ")[0] || "huésped";
  const esReserva = p.kind === "reserva";
  const anticipo = p.anticipo || 0;
  const restante = p.restante ?? p.total - anticipo;
  const eyebrow = esReserva ? "Reserva confirmada" : "Tu cotización";
  const titulo = esReserva ? "¡Todo listo para tu llegada!" : "Aquí está tu cotización";
  const intro = esReserva
    ? `Tu reserva en <strong>${esc(brand.nombre)}</strong> quedó confirmada. Estos son los detalles de tu estancia:`
    : `Preparamos esta cotización para tu estancia en <strong>${esc(brand.nombre)}</strong>. Cuando quieras confirmarla, respóndenos y con gusto te ayudamos:`;

  const cabecera = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.nombre)}" style="max-height:44px;width:auto;display:block;margin:0 auto;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:600;color:${ink};letter-spacing:0.5px;">${esc(brand.nombre)}</div>`;

  const noche = (n: number) => (n === 1 ? "noche" : "noches");
  const huesp = (n: number) => (n === 1 ? "huésped" : "huéspedes");

  const cell = (label: string, big: string, small: string) => `
    <td style="padding:0 8px;text-align:center;vertical-align:top;">
      <div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9aa0a6;margin-bottom:6px;">${label}</div>
      <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1;">${big}</div>
      <div style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;margin-top:4px;">${small}</div>
    </td>`;

  const tours =
    p.tourItems && p.tourItems.length
      ? `<tr><td style="padding:0 40px 8px;">
          <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9aa0a6;margin:8px 0 8px;">Experiencias incluidas</div>
          ${p.tourItems
            .map(
              (t) =>
                `<div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;padding:6px 0;border-bottom:1px solid #f0f0ee;">${esc(t.nombre)} <span style="color:#9aa0a6;">· ${t.personas} pax</span></div>`,
            )
            .join("")}
        </td></tr>`
      : "";

  const notas =
    p.notasCliente && p.notasCliente.trim()
      ? `<tr><td style="padding:8px 40px 0;">
          <div style="background:#faf9f6;border-radius:10px;padding:14px 18px;font-family:Arial,sans-serif;font-size:13px;color:#4b5563;line-height:1.6;">
            <strong style="color:#374151;">Notas:</strong> ${esc(p.notasCliente.trim())}
          </div>
        </td></tr>`
      : "";

  const dineroFila = (label: string, valor: string, fuerte = false) => `
    <tr>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:${fuerte ? "#1a1a1a" : "#6b7280"};padding:7px 0;${fuerte ? "font-weight:700;" : ""}">${label}</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:${fuerte ? "#1a1a1a" : "#374151"};padding:7px 0;text-align:right;${fuerte ? "font-weight:700;" : ""}">${valor}</td>
    </tr>`;

  const bloqueDinero = esReserva
    ? `${dineroFila("Total de la estancia", money(p.total))}
       ${anticipo > 0 ? dineroFila("Anticipo pagado", `− ${money(anticipo)}`) : ""}
       <tr><td colspan="2" style="border-top:1px solid #eeece7;padding-top:4px;"></td></tr>
       ${dineroFila(anticipo > 0 ? "Restante al llegar" : "A pagar", money(restante), true)}`
    : `${dineroFila("Total cotizado", money(p.total), true)}`;

  const cta = brand.whatsapp
    ? `<tr><td style="padding:24px 40px 8px;text-align:center;">
        <a href="https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(`Hola, sobre mi ${esReserva ? "reserva" : "cotización"} ${p.confirmacion} en ${brand.nombre}`)}"
           style="display:inline-block;background:${color};color:${ink};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:999px;">
          ${esReserva ? "Escríbenos por WhatsApp" : "Confirmar por WhatsApp"}
        </a>
      </td></tr>`
    : "";

  const contactoPie = [brand.ubicacion, brand.telefono, brand.email].filter(Boolean).map(esc).join(" · ");

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand.nombre)} — ${eyebrow}</title></head>
<body style="margin:0;padding:0;background:#f0eee9;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${eyebrow} ${esc(p.confirmacion)} — ${esc(brand.nombre)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0eee9;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
      <!-- Cabecera con marca del hotel -->
      <tr><td style="background:${color};padding:26px 40px;text-align:center;">
        ${cabecera}
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${ink};opacity:0.75;margin-top:10px;">${eyebrow}</div>
      </td></tr>
      <!-- Título + folio -->
      <tr><td style="padding:34px 40px 8px;text-align:center;">
        <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.25;">${titulo}</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#9aa0a6;margin-top:8px;">Folio <strong style="color:#4b5563;letter-spacing:1px;">${esc(p.confirmacion)}</strong></div>
      </td></tr>
      <!-- Saludo -->
      <tr><td style="padding:14px 40px 0;">
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:20px;color:#1a1a1a;">Hola, ${esc(first)}</p>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#4b5563;line-height:1.7;">${intro}</p>
      </td></tr>
      <!-- Tarjeta de fechas -->
      <tr><td style="padding:22px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;border-radius:12px;">
          <tr><td style="padding:22px 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              ${cell("Entrada", getDay(p.checkin), getMonthYear(p.checkin))}
              <td style="text-align:center;vertical-align:middle;font-family:Arial,sans-serif;font-size:11px;color:#9aa0a6;white-space:nowrap;">${p.noches} ${noche(p.noches)}<br/>→</td>
              ${cell("Salida", getDay(p.checkout), getMonthYear(p.checkout))}
            </tr></table>
          </td></tr>
        </table>
      </td></tr>
      <!-- Habitaciones + huéspedes -->
      <tr><td style="padding:14px 40px 0;">
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.7;">
          <strong style="color:#1a1a1a;">${p.suites.map(esc).join(", ") || "Habitación"}</strong><br/>
          <span style="color:#6b7280;">${p.huespedes} ${huesp(p.huespedes)}</span>
        </div>
      </td></tr>
      ${tours}
      ${notas}
      <!-- Dinero -->
      <tr><td style="padding:20px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eeece7;padding-top:6px;">
          ${bloqueDinero}
        </table>
      </td></tr>
      ${cta}
      <!-- Pie -->
      <tr><td style="padding:26px 40px 30px;text-align:center;border-top:1px solid #f0efe9;margin-top:20px;">
        <div style="font-family:Georgia,serif;font-size:16px;color:#1a1a1a;font-weight:600;">${esc(brand.nombre)}</div>
        ${contactoPie ? `<div style="font-family:Arial,sans-serif;font-size:12px;color:#9aa0a6;margin-top:6px;">${contactoPie}</div>` : ""}
        <div style="font-family:Arial,sans-serif;font-size:11px;color:#c4c4bd;margin-top:16px;">Enviado con <a href="https://kora-hotel.com" style="color:#9aa0a6;text-decoration:none;">Kora</a> · sistema de reservas para hoteles</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
