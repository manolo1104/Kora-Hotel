// Templates HTML para las 5 secuencias de email automatizadas (multi-tenant).
// Portado de mi-hotel/lib/email-sequences.ts. El branding (nombre del hotel,
// teléfono, WhatsApp, URL de reseñas, ubicación, código promo) NO está
// hardcodeado a Paraíso: cada constructor recibe un objeto `hotel` con esos
// datos. Lo que el hotel no provea cae a defaults neutros de Kora.
//
// Mismo diseño/ventanas que el origen: Cormorant Garamond + Jost, hero oscuro,
// crema. SOLO se generan strings HTML (sin acceso a BD ni a env).

// ── BRANDING POR HOTEL ──────────────────────────────────────────────────────
// Datos de marca que cada plantilla necesita. El cron (route.ts) lo arma a
// partir de la fila `hoteles` (nombre, slug, whatsapp, config jsonb).
export interface HotelBrand {
  nombre: string; // p.ej. "Paraíso Encantado" — reemplaza el hardcode
  baseUrl?: string; // sitio público del hotel (para enlaces de reserva)
  ubicacion?: string; // p.ej. "Xilitla, San Luis Potosí · México"
  telefono?: string; // tel sin formato, p.ej. "524891007679"
  whatsapp?: string; // número de WhatsApp sin "+", p.ej. "524891007679"
  email?: string; // correo de contacto / reservas
  reviewUrl?: string; // URL de Google Maps "escribir reseña"
  mapsUrl?: string; // URL de Google Maps del hotel
  promoCode?: string; // código de la oferta de regreso
  promoDiscount?: string; // texto del descuento, p.ej. "10%"
}

// Defaults neutros de Kora cuando el hotel no provee un dato.
function brandDefaults(hotel: HotelBrand) {
  const nombre = hotel.nombre || "el hotel";
  const ubicacion = hotel.ubicacion || "";
  const telefono = hotel.telefono || "";
  const whatsapp = hotel.whatsapp || telefono || "";
  const email = hotel.email || "";
  const baseUrl = hotel.baseUrl || "https://kora-hotel.com";
  const reviewUrl =
    hotel.reviewUrl || "https://search.google.com/local/writereview";
  const mapsUrl =
    hotel.mapsUrl ||
    `https://maps.google.com/?q=${encodeURIComponent(nombre)}`;
  const promoCode = hotel.promoCode || "REGRESA10";
  const promoDiscount = hotel.promoDiscount || "10%";
  return {
    nombre,
    ubicacion,
    telefono,
    whatsapp,
    email,
    baseUrl,
    reviewUrl,
    mapsUrl,
    promoCode,
    promoDiscount,
  };
}

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap');
  *{margin:0;padding:0;}
  body{font-family:'Jost','Helvetica Neue',Arial,sans-serif;background-color:#f0ebe3;line-height:1.6;}
  table{border-collapse:collapse;}
  a{color:#2a2218;text-decoration:none;}
  .wrapper{background-color:#f0ebe3;padding:20px 0;}
  .container{max-width:620px;margin:0 auto;background-color:#faf8f5;}
  @media only screen and (max-width:640px){
    .wrapper{padding:0!important;}
    .container{width:100%!important;max-width:100%!important;}
    .mp{padding-left:24px!important;padding-right:24px!important;}
    .mplg{padding:34px 24px!important;}
  }
`;

function formatDateEs(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  const f = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function hero(eyebrow: string, title: string, sub: string, badge?: string) {
  return `
  <tr><td class="mplg" style="padding:34px 40px 38px;background-color:#2f281f;">
    <p style="margin:0 0 8px;font-family:'Jost','Helvetica Neue',Arial;font-size:11px;letter-spacing:3.5px;text-transform:uppercase;color:rgba(255,255,255,0.72);">${eyebrow}</p>
    <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:42px;font-style:italic;font-weight:300;color:#fff;line-height:1.1;">${title}</h1>
    <p style="margin:14px 0 0;font-family:'Jost','Helvetica Neue',Arial;font-size:14px;font-weight:300;color:rgba(255,255,255,0.8);line-height:1.7;">${sub}</p>
    ${badge ? `<div style="display:inline-block;margin-top:14px;background:${badge.startsWith("#") ? badge : "#2d7a34"};color:#fff;font-family:'Jost',sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;padding:5px 14px;">${badge.startsWith("#") ? "" : badge}</div>` : ""}
  </td></tr>`;
}

function greeting(name: string) {
  const first = name.trim().split(" ")[0];
  return `<p style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;color:#2a2218;line-height:1.2;">Hola, <span style="font-style:italic;color:#7a6a52;">${first}</span></p>`;
}

function divider() {
  return `<table role="presentation" width="48" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;"><tr><td style="height:1px;background-color:#c9b99a;"></td></tr></table>`;
}

function ctaButton(text: string, url: string, color = "#2a2218") {
  return `
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px auto;">
    <tr><td style="background-color:${color};padding:16px 38px;">
      <a href="${url}" style="font-family:'Jost','Helvetica Neue',Arial;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#faf8f5;text-decoration:none;display:block;">${text}</a>
    </td></tr>
  </table>`;
}

// Bloque de contacto: solo muestra las líneas que el hotel sí tiene.
function contact(b: ReturnType<typeof brandDefaults>) {
  const rows: string[] = [];
  if (b.telefono) {
    const display = b.telefono.replace(/^52/, "+52 ");
    rows.push(`<p style="margin:0 0 8px;font-family:'Jost','Helvetica Neue',Arial;font-size:13px;color:#2a2218;">📞 <a href="tel:+${b.telefono}" style="color:#2a2218;">${display}</a></p>`);
  }
  if (b.email) {
    rows.push(`<p style="margin:0 0 8px;font-family:'Jost','Helvetica Neue',Arial;font-size:13px;color:#2a2218;">📧 <a href="mailto:${b.email}" style="color:#2a2218;">${b.email}</a></p>`);
  }
  if (b.whatsapp) {
    rows.push(`<p style="margin:0;font-family:'Jost','Helvetica Neue',Arial;font-size:13px;color:#2a2218;">💬 <a href="https://wa.me/${b.whatsapp}" style="color:#2a2218;">WhatsApp directo</a></p>`);
  }
  if (rows.length === 0) return "";
  return `
  <tr><td class="mp" style="background-color:#faf8f5;padding:32px 48px;border-top:1px solid #e4ddd3;">
    ${rows.join("\n    ")}
  </td></tr>`;
}

function footer(b: ReturnType<typeof brandDefaults>) {
  const ubic = b.ubicacion
    ? `<p style="margin:0 0 16px;font-family:'Jost','Helvetica Neue',Arial;font-size:11px;color:#a09080;line-height:1.6;">${b.ubicacion}</p>`
    : "";
  return `
  <tr><td class="mplg" style="background-color:#f0ebe3;padding:44px 48px;text-align:center;">
    <p style="margin:0 0 12px;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;letter-spacing:3px;text-transform:uppercase;color:#8a7d6b;">${b.nombre}</p>
    ${ubic}
    <p style="margin:0;font-family:'Jost','Helvetica Neue',Arial;font-size:10px;color:#b8aa9a;">© ${new Date().getFullYear()} ${b.nombre} · Todos los derechos reservados</p>
  </td></tr>`;
}

function wrap(b: ReturnType<typeof brandDefaults>, subject: string, body: string) {
  const topbar = b.ubicacion
    ? `<tr><td style="padding:16px 0;text-align:center;">
      <p style="margin:0;font-family:'Jost','Helvetica Neue',Arial;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8a7d6b;">${b.ubicacion}</p>
    </td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
<style>${BASE_CSS}</style>
</head><body>
<div class="wrapper">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    ${topbar}
  </table>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center">
      <table class="container" role="presentation" width="620" cellspacing="0" cellpadding="0" border="0">
        ${body}
        ${contact(b)}
        ${footer(b)}
      </table>
    </td></tr>
  </table>
</div></body></html>`;
}

// ── 1. Post-stay +1 día: Encuesta de satisfacción ──────────────────────────
export function buildSurveyEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
  checkout: string;
  habitaciones: string;
}): string {
  const b = brandDefaults(data.hotel);
  const first = data.customerName.trim().split(" ")[0];
  const starsHtml = [1, 2, 3, 4, 5]
    .map((n) => {
      const url = `${b.baseUrl}/api/feedback?conf=${encodeURIComponent(data.confirmacion)}&rating=${n}`;
      return `<td style="padding:0 4px;">
      <a href="${url}" style="display:block;background:#2a2218;padding:14px 16px;text-decoration:none;">
        <span style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;color:#c9b99a;">★</span>
      </a>
    </td>`;
    })
    .join("");

  const body = `
    ${hero(`Tu estancia en ${b.nombre}`, "¿Cómo fue tu escapada?", "Tu opinión nos ayuda a crear experiencias cada vez mejores.")}
    <tr><td class="mplg" style="background-color:#faf8f5;padding:52px 48px;">
      ${greeting(data.customerName)}
      <p style="margin:16px 0 8px;font-family:'Jost','Helvetica Neue',Arial;font-size:15px;font-weight:300;color:#4a3f30;line-height:1.85;">
        Tu estancia del <strong>${formatDateEs(data.checkin)}</strong> al <strong>${formatDateEs(data.checkout)}</strong> en ${data.habitaciones} terminó hace un día. ¿Cómo fue tu experiencia?
      </p>
      ${divider()}
      <p style="margin:0 0 20px;font-family:'Jost','Helvetica Neue',Arial;font-size:13px;color:#9a8a74;text-align:center;letter-spacing:0.05em;">HAZ CLIC EN LAS ESTRELLAS PARA CALIFICARNOS</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
        <tr>${starsHtml}</tr>
      </table>
      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-style:italic;color:#5a4e3c;text-align:center;line-height:1.7;margin:0 0 32px;">
        "Cada opinión nos ayuda a hacer de ${b.nombre} un lugar mejor<br>para quienes vienen después de ti."
      </p>
      <p style="font-family:'Jost','Helvetica Neue',Arial;font-size:13px;color:#9a8a74;text-align:center;margin:0;">
        También puedes respondernos directamente a este correo. 🌿
      </p>
    </td></tr>`;
  return wrap(b, `${first}, ¿cómo fue tu estancia en ${b.nombre}?`, body);
}

// ── 2. Post-stay +7 días: Invitación Google Maps ───────────────────────────
export function buildReviewEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
}): string {
  const b = brandDefaults(data.hotel);
  const first = data.customerName.trim().split(" ")[0];
  const body = `
    ${hero("Una semana después", "Tu opinión llega más lejos de lo que imaginas.", `Hace 7 días dejaste ${b.nombre}. ¿Nos dejas una reseña en Google?`)}
    <tr><td class="mplg" style="background-color:#faf8f5;padding:52px 48px;">
      ${greeting(data.customerName)}
      <p style="margin:16px 0 32px;font-family:'Jost','Helvetica Neue',Arial;font-size:15px;font-weight:300;color:#4a3f30;line-height:1.85;">
        Hace una semana te despediste de ${b.nombre}. Tu opinión en Google ayuda a que otros viajeros encuentren su próximo destino — y solo toma 2 minutos. 🙏
      </p>
      ${ctaButton("Dejar mi reseña en Google ★", b.reviewUrl)}
      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-style:italic;color:#5a4e3c;text-align:center;line-height:1.7;margin:32px 0 0;">
        "Cada reseña es una historia que llega a quienes todavía no nos descubren."
      </p>
    </td></tr>`;
  return wrap(b, `${first}, ¿nos dejas una reseña en Google?`, body);
}

// ── 3. Post-stay +30 días: Oferta de regreso ──────────────────────────────
export function buildReturnOfferEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  promoExpiry: string;
}): string {
  const b = brandDefaults(data.hotel);
  const first = data.customerName.trim().split(" ")[0];
  const bookingUrl = `${b.baseUrl}/reservar?promo=${b.promoCode}`;
  const body = `
    ${hero("Una oferta solo para ti", "Vuelve cuando quieras.", `En ${b.nombre} te recordamos y tenemos algo especial para ti.`)}
    <tr><td class="mplg" style="background-color:#faf8f5;padding:52px 48px;">
      ${greeting(data.customerName)}
      <p style="margin:16px 0 32px;font-family:'Jost','Helvetica Neue',Arial;font-size:15px;font-weight:300;color:#4a3f30;line-height:1.85;">
        Han pasado 30 días desde que te fuiste y en ${b.nombre} todavía te recordamos. Como agradecimiento por haber confiado en nosotros, te ofrecemos <strong>${b.promoDiscount} de descuento</strong> en tu próxima estancia.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #c9b99a;background-color:#fdf9f4;margin:0 0 32px;">
        <tr><td style="padding:28px 32px;text-align:center;">
          <p style="margin:0 0 10px;font-family:'Jost','Helvetica Neue',Arial;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9a8a74;">Tu código de descuento exclusivo</p>
          <p style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:38px;font-weight:500;color:#2a2218;letter-spacing:4px;">${b.promoCode}</p>
          <p style="margin:0;font-family:'Jost','Helvetica Neue',Arial;font-size:12px;color:#9a8a74;">${b.promoDiscount} de descuento · Válido hasta el ${data.promoExpiry}</p>
        </td></tr>
      </table>
      <p style="font-family:'Jost','Helvetica Neue',Arial;font-size:13px;color:#9a8a74;text-align:center;margin:0 0 8px;">
        Aplica en cualquier habitación disponible. Menciona el código al reservar por WhatsApp o úsalo en el motor en línea.
      </p>
      ${ctaButton(`Reservar con ${b.promoDiscount} de descuento`, bookingUrl)}
    </td></tr>`;
  return wrap(b, `${first}, tu escapada te espera — ${b.promoDiscount} de descuento exclusivo`, body);
}

/**
 * Oferta de regreso PERSONALIZADA (manual, desde el CRM de clientes). A
 * diferencia de buildReturnOfferEmailHtml (copy FIJO del cron día 30), aquí el
 * cuerpo lo REDACTA la IA según el historial del huésped y se inyecta en el
 * shell de marca del hotel. `paragraphs` es texto plano ya personalizado: se
 * escapa a HTML (la salida de la IA no se inyecta cruda). La caja de código
 * solo aparece si el hotel configuró una promo (`hotel.promoCode`).
 */
export function buildPersonalOfferEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  paragraphs: string[];
  ctaText?: string;
  promoExpiry?: string;
}): string {
  const b = brandDefaults(data.hotel);
  const esc = (s: string) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hasPromo = Boolean(data.hotel.promoCode);
  const bookingUrl = `${b.baseUrl}/reservar${hasPromo ? `?promo=${encodeURIComponent(b.promoCode)}` : ""}`;
  const paras = data.paragraphs
    .map((p) => esc(p).trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:16px 0 0;font-family:'Jost','Helvetica Neue',Arial;font-size:15px;font-weight:300;color:#4a3f30;line-height:1.85;">${p}</p>`,
    )
    .join("");
  const promoBox = hasPromo
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #c9b99a;background-color:#fdf9f4;margin:32px 0 0;">
        <tr><td style="padding:28px 32px;text-align:center;">
          <p style="margin:0 0 10px;font-family:'Jost','Helvetica Neue',Arial;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9a8a74;">Tu código exclusivo</p>
          <p style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:38px;font-weight:500;color:#2a2218;letter-spacing:4px;">${esc(b.promoCode)}</p>
          <p style="margin:0;font-family:'Jost','Helvetica Neue',Arial;font-size:12px;color:#9a8a74;">${esc(b.promoDiscount)} de descuento${data.promoExpiry ? ` · Válido hasta el ${esc(data.promoExpiry)}` : ""}</p>
        </td></tr>
      </table>`
    : "";
  const body = `
    ${hero("Una nota para ti", "Te tenemos algo especial", `Con cariño, desde ${esc(b.nombre)}.`)}
    <tr><td class="mplg" style="background-color:#faf8f5;padding:52px 48px;">
      ${greeting(data.customerName)}
      ${paras}
      ${promoBox}
      ${ctaButton(data.ctaText || `Reservar en ${b.nombre}`, bookingUrl)}
    </td></tr>`;
  const first = data.customerName.trim().split(" ")[0];
  return wrap(b, `${first}, algo especial de ${b.nombre}`, body);
}

// ── 4. Pre-llegada -3 días: Recordatorio / upsell de servicios ─────────────
// El menú de restaurante de Paraíso se parametriza: el hotel puede pasar su
// propia lista de `servicios`. Si no pasa nada, el correo se centra en confirmar
// la llegada y ofrecer ayuda por WhatsApp (sin inventar un restaurante).
export function buildRestaurantEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
  checkinFormatted: string;
  /** Servicios/menú opcionales del hotel para el upsell. */
  servicios?: { name: string; desc: string; precio: string }[];
  /** Nombre del restaurante/servicio, si aplica (default: genérico). */
  restauranteNombre?: string;
}): string {
  const b = brandDefaults(data.hotel);
  const first = data.customerName.trim().split(" ")[0];
  const restName = data.restauranteNombre || "nuestro restaurante";
  const waText = encodeURIComponent(
    `Hola, quisiera reservar una cena para el ${data.checkinFormatted}. Mi confirmación es ${data.confirmacion}.`,
  );
  const waUrl = b.whatsapp ? `https://wa.me/${b.whatsapp}?text=${waText}` : "";

  const servicios = data.servicios && data.servicios.length > 0 ? data.servicios : null;
  const serviciosHtml = servicios
    ? servicios
        .map(
          (m) => `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-bottom:1px solid #e4ddd3;margin-bottom:4px;">
      <tr>
        <td style="padding:16px 0;width:75%;vertical-align:top;">
          <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#2a2218;margin:0 0 4px;">${m.name}</p>
          <p style="font-family:'Jost','Helvetica Neue',Arial;font-size:12px;color:#9a8a74;margin:0;">${m.desc}</p>
        </td>
        <td style="padding:16px 0 16px 16px;text-align:right;vertical-align:top;white-space:nowrap;">
          <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:#2a2218;margin:0;">${m.precio}</p>
        </td>
      </tr>
    </table>`,
        )
        .join("")
    : "";

  const intro = servicios
    ? `En <strong>3 días</strong> llegas a ${b.nombre}. ¿Te gustaría reservar una cena en ${restName}? Aquí nuestra selección:`
    : `En <strong>3 días</strong> llegas a ${b.nombre}. Queremos que tu llegada sea perfecta: si necesitas algo antes de tu estancia, estamos a un mensaje de distancia.`;

  const cta = waUrl
    ? `${ctaButton("Escríbenos por WhatsApp 💬", waUrl, "#2a2218")}` +
      (b.telefono
        ? `<p style="font-family:'Jost','Helvetica Neue',Arial;font-size:12px;color:#9a8a74;text-align:center;margin:0;">También puedes llamarnos al +${b.telefono}</p>`
        : "")
    : "";

  const body = `
    ${hero("Tu llegada se acerca", servicios ? "¿Una cena especial?" : "Te esperamos pronto", `${restName !== "nuestro restaurante" ? restName + " · " : ""}${b.nombre}`)}
    <tr><td class="mplg" style="background-color:#faf8f5;padding:52px 48px;">
      ${greeting(data.customerName)}
      <p style="margin:16px 0 32px;font-family:'Jost','Helvetica Neue',Arial;font-size:15px;font-weight:300;color:#4a3f30;line-height:1.85;">
        ${intro}
      </p>
      ${serviciosHtml}
      ${servicios ? `<p style="font-family:'Jost','Helvetica Neue',Arial;font-size:12px;color:#9a8a74;margin:16px 0 0;">Sin costo de reserva</p>` : ""}
      ${cta}
    </td></tr>`;
  return wrap(b, servicios ? `${first}, ¿una cena especial en ${b.nombre}?` : `${first}, tu llegada a ${b.nombre} se acerca`, body);
}

// ── 5. Pre-llegada día del checkin: Guía de bienvenida ────────────────────
export function buildWelcomeGuideEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
  habitaciones: string;
  /** Datos opcionales de la guía (de hotel.guia / config). */
  checkinHora?: string; // default "3:00 PM"
  checkoutHora?: string; // default "12:00 PM"
  direccion?: string; // dirección física para "Cómo llegar"
}): string {
  const b = brandDefaults(data.hotel);
  const first = data.customerName.trim().split(" ")[0];
  const checkinHora = data.checkinHora || "3:00 PM";
  const checkoutHora = data.checkoutHora || "12:00 PM";

  const comoLlegarBody = data.direccion
    ? `${data.direccion}<br><a href="${b.mapsUrl}" style="color:#8a6830;text-decoration:underline;">Ver en Google Maps</a>`
    : `<a href="${b.mapsUrl}" style="color:#8a6830;text-decoration:underline;">Ver en Google Maps</a>`;

  const waBlock = b.whatsapp
    ? ctaButton("¿Alguna pregunta? Escríbenos por WhatsApp", `https://wa.me/${b.whatsapp}`)
    : "";

  const body = `
    ${hero("Hoy es el día", `Tu estancia en ${b.nombre}, hoy.`, "¡El momento que esperabas ha llegado! Aquí todo lo que necesitas saber.")}
    <tr><td class="mplg" style="background-color:#faf8f5;padding:52px 48px;">
      ${greeting(data.customerName)}
      <p style="margin:16px 0 32px;font-family:'Jost','Helvetica Neue',Arial;font-size:15px;font-weight:300;color:#4a3f30;line-height:1.85;">
        ¡Hoy es el día! En unas horas estarás con nosotros. Aquí tu guía de llegada.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #c9b99a;background-color:#fdf9f4;margin:0 0 32px;">
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 8px;font-family:'Jost','Helvetica Neue',Arial;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9a8a74;">Tu confirmación</p>
          <p style="margin:0 0 16px;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:500;color:#2a2218;">${data.confirmacion}</p>
          <p style="margin:0;font-family:'Jost','Helvetica Neue',Arial;font-size:13px;color:#4a3f30;">
            🏠 <strong>${data.habitaciones}</strong><br>
            📅 Check-in a partir de las <strong>${checkinHora}</strong><br>
            📅 Check-out antes de las <strong>${checkoutHora}</strong>
          </p>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f0e8;margin:0 0 32px;">
        <tr>
          <td style="width:100%;padding:20px;vertical-align:top;border-bottom:1px solid #e4ddd3;">
            <p style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;color:#2a2218;">📍 Cómo llegar</p>
            <p style="margin:0;font-family:'Jost','Helvetica Neue',Arial;font-size:12px;color:#4a3f30;line-height:1.5;">
              ${comoLlegarBody}
            </p>
          </td>
        </tr>
      </table>

      <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:19px;font-style:italic;color:#5a4e3c;text-align:center;line-height:1.7;margin:0 0 32px;">
        "Te esperamos con los brazos abiertos y el corazón lleno. 🌿"
      </p>
      ${waBlock}
    </td></tr>`;
  return wrap(b, `¡Hoy es el día, ${first}! — Tu habitación te espera`, body);
}
