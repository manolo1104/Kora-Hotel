// Plantillas de las secuencias automáticas del ciclo de estancia (multi-tenant).
// Las manda el cron /api/cron/email-sequences: pre-estancia (−3 días y día de
// llegada) y post-estancia (+1, +7 y +30 días), más la oferta personalizada que
// el hotelero dispara a mano desde el CRM de clientes.
//
// Todas usan el sistema de diseño de lib/email/design.ts — la misma tipografía
// y los mismos colores que la confirmación de reserva y que los correos de la
// cuenta. Antes vivían en un diseño serif aparte y el mismo huésped recibía
// correos que no se parecían entre sí.
//
// Bilingüe es/en: el idioma sale de la reserva (columna `lang`), igual que la
// confirmación. Sin idioma guardado, español.
//
// SOLO se generan strings HTML (sin acceso a BD ni a env).

import {
  T,
  FONT,
  doc,
  esc,
  cabecera,
  titulo,
  saludo,
  parrafo,
  boton,
  botonesSecundarios,
  caja,
  lista,
  contacto,
  pieHotel,
  respiro,
  waLink,
  fechaLarga,
  gcalUrl,
  type Lang,
} from "@/lib/email/design";

// ── BRANDING POR HOTEL ──────────────────────────────────────────────────────
// El cron arma esto a partir de la fila `hoteles`. Nada está hardcodeado a un
// hotel concreto: lo que el hotel no provea simplemente no se pinta.
export interface HotelBrand {
  nombre: string;
  baseUrl?: string; // sitio público del hotel (para enlaces de reserva)
  ubicacion?: string;
  telefono?: string;
  whatsapp?: string; // sin "+"
  email?: string;
  reviewUrl?: string; // URL de Google "escribir reseña"
  mapsUrl?: string;
  promoCode?: string; // SOLO si el hotelero configuró una promo real
  promoDiscount?: string;
}

/**
 * Rellena lo mínimo imprescindible. OJO: `promoCode`/`promoDiscount` NO tienen
 * valor por defecto a propósito — antes caían a "REGRESA10 / 10%" y el correo
 * de +30 días prometía un descuento que el hotel nunca autorizó y que el motor
 * de reservas rechazaba al no existir el código.
 */
function brandDefaults(hotel: HotelBrand) {
  const nombre = hotel.nombre || "el hotel";
  return {
    nombre,
    ubicacion: hotel.ubicacion || "",
    telefono: hotel.telefono || "",
    whatsapp: hotel.whatsapp || hotel.telefono || "",
    email: hotel.email || "",
    baseUrl: hotel.baseUrl || "https://kora-hotel.com",
    reviewUrl: hotel.reviewUrl || "",
    mapsUrl: hotel.mapsUrl || "",
    promoCode: hotel.promoCode || "",
    promoDiscount: hotel.promoDiscount || "",
  };
}

type Brand = ReturnType<typeof brandDefaults>;

const primerNombre = (n: string, en: boolean) =>
  (n || "").trim().split(/\s+/)[0] || (en ? "there" : "hola");

const HOLA = (en: boolean) => (en ? "Hi" : "Hola");

/** Pie común de los correos del huésped: contacto del hotel + firma. */
function cierre(b: Brand): string {
  return (
    contacto({ telefono: b.telefono, email: b.email, whatsapp: b.whatsapp }) +
    respiro +
    pieHotel({ nombre: b.nombre, ubicacion: b.ubicacion })
  );
}

// ── 1. Pre-estancia −3 días: tu llegada se acerca ───────────────────────────

export function buildRestaurantEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
  checkinFormatted?: string;
  lang?: Lang;
}): string {
  const en = data.lang === "en";
  const b = brandDefaults(data.hotel);
  const first = primerNombre(data.customerName, en);
  const fecha = data.checkinFormatted || fechaLarga(data.checkin, en);
  const wa = waLink(
    b.whatsapp,
    en
      ? `Hi, I'm arriving at ${b.nombre} soon (booking ${data.confirmacion}).`
      : `Hola, ya se acerca mi llegada a ${b.nombre} (reserva ${data.confirmacion}).`,
  );

  const t = en
    ? {
        eyebrow: "Your arrival is near",
        h: "We're getting everything ready",
        intro: `Your stay starts <strong>${fecha}</strong>, in just 3 days. We want your arrival to be effortless — if you need anything set up beforehand, just tell us.`,
        ideas: "Tell us before you arrive",
        i1: "What time you expect to arrive",
        i2: "Any dietary needs or allergies",
        i3: "If you're celebrating something special",
        i4: "Tours or transfers you'd like us to arrange",
        cta: "Write to us on WhatsApp 💬",
        cal: "📅 Add to calendar",
        mapa: "📍 Directions",
      }
    : {
        eyebrow: "Tu llegada se acerca",
        h: "Ya estamos preparando todo",
        intro: `Tu estancia empieza el <strong>${fecha}</strong>, en 3 días. Queremos que tu llegada sea fácil — si necesitas que dejemos algo listo, solo dinos.`,
        ideas: "Cuéntanos antes de llegar",
        i1: "A qué hora calculas llegar",
        i2: "Alguna alergia o restricción de comida",
        i3: "Si vienes celebrando algo especial",
        i4: "Tours o traslados que quieras que te apartemos",
        cta: "Escríbenos por WhatsApp 💬",
        cal: "📅 Añadir al calendario",
        mapa: "📍 Cómo llegar",
      };

  const inner =
    cabecera({ nombre: b.nombre, eyebrow: t.eyebrow }) +
    titulo(t.h) +
    saludo(HOLA(en), first, t.intro) +
    lista(t.ideas, [t.i1, t.i2, t.i3, t.i4].map((x) => `· ${esc(x)}`)) +
    (wa ? boton(wa, t.cta) : "") +
    botonesSecundarios([
      { href: gcalUrl(`${en ? "Stay at" : "Estancia en"} ${b.nombre}`, data.checkin, data.checkin), texto: t.cal },
      { href: b.mapsUrl, texto: t.mapa },
    ]) +
    cierre(b);

  return doc(
    `${b.nombre} — ${t.eyebrow}`,
    en ? `3 days to go — ${b.nombre}` : `Faltan 3 días — ${b.nombre}`,
    inner,
  );
}

// ── 2. Día de llegada: guía de bienvenida ───────────────────────────────────

export function buildWelcomeGuideEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
  habitaciones: string;
  checkinHora?: string;
  checkoutHora?: string;
  direccion?: string;
  lang?: Lang;
}): string {
  const en = data.lang === "en";
  const b = brandDefaults(data.hotel);
  const first = primerNombre(data.customerName, en);
  const wa = waLink(
    b.whatsapp,
    en
      ? `Hi, I'm on my way to ${b.nombre} (booking ${data.confirmacion}).`
      : `Hola, voy en camino a ${b.nombre} (reserva ${data.confirmacion}).`,
  );

  const t = en
    ? {
        eyebrow: "Today's the day",
        h: "Your room is ready",
        intro: "You arrive today. Here's everything you need for a smooth check-in.",
        datos: "Your check-in",
        folio: "Confirmation",
        hab: "Room",
        entra: "Check-in from",
        sale: "Check-out before",
        dir: "Address",
        cta: "Write to us on WhatsApp 💬",
        mapa: "📍 Directions",
        nota: "Running late or lost? Message us — someone always answers.",
      }
    : {
        eyebrow: "Hoy es el día",
        h: "Tu habitación te espera",
        intro: "Hoy llegas. Aquí tienes todo lo que necesitas para entrar sin complicaciones.",
        datos: "Tu llegada",
        folio: "Folio",
        hab: "Habitación",
        entra: "Entrada a partir de",
        sale: "Salida antes de",
        dir: "Dirección",
        cta: "Escríbenos por WhatsApp 💬",
        mapa: "📍 Cómo llegar",
        nota: "¿Se te hace tarde o te perdiste? Escríbenos — siempre hay quien conteste.",
      };

  const filas = [
    `<strong style="color:${T.tinta};">${t.folio}:</strong> ${esc(data.confirmacion)}`,
    data.habitaciones ? `<strong style="color:${T.tinta};">${t.hab}:</strong> ${esc(data.habitaciones)}` : "",
    data.checkinHora ? `<strong style="color:${T.tinta};">${t.entra}:</strong> ${esc(data.checkinHora)}` : "",
    data.checkoutHora ? `<strong style="color:${T.tinta};">${t.sale}:</strong> ${esc(data.checkoutHora)}` : "",
    data.direccion ? `<strong style="color:${T.tinta};">${t.dir}:</strong> ${esc(data.direccion)}` : "",
  ].filter(Boolean);

  const inner =
    cabecera({ nombre: b.nombre, eyebrow: t.eyebrow }) +
    titulo(t.h) +
    saludo(HOLA(en), first, t.intro) +
    lista(t.datos, filas) +
    caja(t.nota) +
    (wa ? boton(wa, t.cta) : "") +
    botonesSecundarios([{ href: b.mapsUrl, texto: t.mapa }]) +
    cierre(b);

  return doc(
    `${b.nombre} — ${t.eyebrow}`,
    en ? `See you today at ${b.nombre}` : `Hoy te esperamos en ${b.nombre}`,
    inner,
  );
}

// ── 3. Post-estancia +1 día: encuesta de 5 estrellas ────────────────────────
// Las estrellas llevan a la página de reseña de Kora con la calificación ya
// preseleccionada. ANTES apuntaban a `{baseUrl}/api/feedback`, una ruta que no
// existe: todo huésped que hacía clic caía en un 404.

export function buildSurveyEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
  checkout: string;
  habitaciones: string;
  resenaUrl?: string; // /h/{slug}/resena?r={id}&lang=xx (sin el rating)
  lang?: Lang;
}): string {
  const en = data.lang === "en";
  const b = brandDefaults(data.hotel);
  const first = primerNombre(data.customerName, en);

  const t = en
    ? {
        eyebrow: "Your stay at " + b.nombre,
        h: "How was your escape?",
        intro: `Your stay from <strong>${fechaLarga(data.checkin, true)}</strong> to <strong>${fechaLarga(data.checkout, true)}</strong> ended yesterday. How did it go?`,
        pick: "Tap a star to rate us",
        cita: `"Every opinion helps us make ${b.nombre} better for whoever comes next."`,
        reply: "You can also just reply to this email. 🌿",
        cta: "Rate my stay ★",
      }
    : {
        eyebrow: "Tu estancia en " + b.nombre,
        h: "¿Cómo estuvo tu escapada?",
        intro: `Tu estancia del <strong>${fechaLarga(data.checkin)}</strong> al <strong>${fechaLarga(data.checkout)}</strong> terminó ayer. ¿Cómo te fue?`,
        pick: "Toca una estrella para calificarnos",
        cita: `"Cada opinión nos ayuda a hacer de ${b.nombre} un lugar mejor para quienes vienen después."`,
        reply: "También puedes responder directo a este correo. 🌿",
        cta: "Calificar mi estancia ★",
      };

  // Con resenaUrl: cada estrella abre la página con esa calificación puesta.
  const estrellas = data.resenaUrl
    ? `<tr><td style="padding:22px 40px 0;">
        <div style="font-family:${FONT};font-weight:600;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${T.tenue};text-align:center;margin-bottom:14px;">${esc(t.pick)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
          ${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<td style="padding:0 4px;"><a href="${data.resenaUrl}&rating=${n}" style="display:block;background:${T.verde};border-radius:10px;padding:13px 15px;text-decoration:none;"><span style="font-family:${FONT};font-size:24px;color:${T.verdeClaro};line-height:1;">★</span></a></td>`,
            )
            .join("")}
        </tr></table>
      </td></tr>`
    : "";

  const inner =
    cabecera({ nombre: b.nombre, eyebrow: t.eyebrow }) +
    titulo(t.h) +
    saludo(HOLA(en), first, t.intro) +
    estrellas +
    (!estrellas && b.reviewUrl ? boton(b.reviewUrl, t.cta) : "") +
    caja(`<span style="font-style:italic;">${esc(t.cita)}</span>`) +
    parrafo(`<span style="font-size:13px;color:${T.tenue};">${esc(t.reply)}</span>`) +
    cierre(b);

  return doc(
    `${b.nombre} — ${t.h}`,
    en ? `${first}, how was your stay?` : `${first}, ¿cómo estuvo tu estancia?`,
    inner,
  );
}

// ── 4. Post-estancia +7 días: invitación a dejar reseña ─────────────────────
// El CTA va a la página de captura de Kora (atada al folio): ahí el huésped
// califica, Kora guarda la reseña real y luego se le invita a Google.

export function buildReviewEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  checkin: string;
  resenaUrl?: string;
  lang?: Lang;
}): string {
  const en = data.lang === "en";
  const b = brandDefaults(data.hotel);
  const first = primerNombre(data.customerName, en);
  const cta = data.resenaUrl || b.reviewUrl;

  const t = en
    ? {
        eyebrow: "One week later",
        h: "Your words travel further than you think",
        intro: `A week ago you said goodbye to ${b.nombre}. A short review helps other travelers find their next place — and it only takes two minutes. 🙏`,
        btn: "Leave my review ★",
        cita: `"Every review is a story that reaches people who haven't found us yet."`,
      }
    : {
        eyebrow: "Una semana después",
        h: "Tu opinión llega más lejos de lo que crees",
        intro: `Hace una semana te despediste de ${b.nombre}. Una reseña corta ayuda a que otros viajeros encuentren su próximo destino — y solo toma dos minutos. 🙏`,
        btn: "Dejar mi reseña ★",
        cita: `"Cada reseña es una historia que llega a quienes todavía no nos descubren."`,
      };

  const inner =
    cabecera({ nombre: b.nombre, eyebrow: t.eyebrow }) +
    titulo(t.h) +
    saludo(HOLA(en), first, t.intro) +
    (cta ? boton(cta, t.btn) : "") +
    caja(`<span style="font-style:italic;">${esc(t.cita)}</span>`) +
    cierre(b);

  return doc(
    `${b.nombre} — ${t.eyebrow}`,
    en ? `${first}, would you leave us a review?` : `${first}, ¿nos dejas una reseña?`,
    inner,
  );
}

// ── 5. Post-estancia +30 días: invitación a regresar ────────────────────────
// La caja del código SOLO aparece si el hotelero configuró una promo real.

export function buildReturnOfferEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  confirmacion: string;
  promoExpiry?: string;
  lang?: Lang;
}): string {
  const en = data.lang === "en";
  const b = brandDefaults(data.hotel);
  const first = primerNombre(data.customerName, en);
  // `promoCode` sólo llega si el hotelero encendió la promo en su panel y el
  // motor la va a aplicar de verdad: el correo y el checkout leen la misma
  // `extras.reglas.promos`. Si la apaga, este correo deja de ofrecer descuento
  // en vez de prometer uno que el motor cobraría entero.
  const hasPromo = Boolean(b.promoCode);
  const bookingUrl = `${b.baseUrl}/reservar${hasPromo ? `?promo=${encodeURIComponent(b.promoCode)}` : ""}`;

  const t = en
    ? {
        eyebrow: "An invitation for you",
        h: "Come back whenever you like",
        introPromo: `A month has passed since you left, and we still remember you at ${b.nombre}. As a thank-you for trusting us, here's <strong>${esc(b.promoDiscount)} off</strong> your next stay.`,
        introSimple: `A month has passed since you left, and we still remember you at ${b.nombre}. Whenever you feel like coming back, your room is here.`,
        codigo: "Your exclusive code",
        validez: (d: string) => `${esc(b.promoDiscount)} off · valid until ${esc(d)}`,
        btnPromo: `Book with ${esc(b.promoDiscount)} off`,
        btnSimple: "See availability",
        nota: `Applies to any available room. The code is already in the link — or type it at checkout. You can also mention it if you book on WhatsApp.`,
      }
    : {
        eyebrow: "Una invitación para ti",
        h: "Vuelve cuando quieras",
        introPromo: `Ha pasado un mes desde que te fuiste y en ${b.nombre} todavía te recordamos. Como agradecimiento por confiar en nosotros, te dejamos <strong>${esc(b.promoDiscount)} de descuento</strong> en tu próxima estancia.`,
        introSimple: `Ha pasado un mes desde que te fuiste y en ${b.nombre} todavía te recordamos. Cuando tengas ganas de volver, tu habitación está aquí.`,
        codigo: "Tu código exclusivo",
        validez: (d: string) => `${esc(b.promoDiscount)} de descuento · válido hasta el ${esc(d)}`,
        btnPromo: `Reservar con ${esc(b.promoDiscount)} de descuento`,
        btnSimple: "Ver disponibilidad",
        nota: `Aplica en cualquier habitación disponible. El código ya va en el enlace — o puedes teclearlo al reservar. También vale si reservas por WhatsApp.`,
      };

  const cajaPromo = hasPromo
    ? `<tr><td style="padding:22px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.panel};border:1px solid ${T.borde};border-radius:14px;">
          <tr><td style="padding:24px;text-align:center;">
            <div style="font-family:${FONT};font-weight:600;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${T.tenue};margin-bottom:10px;">${esc(t.codigo)}</div>
            <div style="font-family:${FONT};font-weight:800;font-size:30px;letter-spacing:3px;color:${T.tinta};line-height:1;">${esc(b.promoCode)}</div>
            ${data.promoExpiry ? `<div style="font-family:${FONT};font-weight:400;font-size:12px;color:${T.suave};margin-top:10px;">${t.validez(data.promoExpiry)}</div>` : ""}
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const inner =
    cabecera({ nombre: b.nombre, eyebrow: t.eyebrow }) +
    titulo(t.h) +
    saludo(HOLA(en), first, hasPromo ? t.introPromo : t.introSimple) +
    cajaPromo +
    boton(bookingUrl, hasPromo ? t.btnPromo : t.btnSimple) +
    (hasPromo ? parrafo(`<span style="font-size:12.5px;color:${T.tenue};">${esc(t.nota)}</span>`) : "") +
    cierre(b);

  return doc(
    `${b.nombre} — ${t.eyebrow}`,
    hasPromo
      ? en
        ? `${b.promoDiscount} off your next stay at ${b.nombre}`
        : `${b.promoDiscount} de descuento en tu próxima estancia`
      : en
        ? `Your room at ${b.nombre} is waiting`
        : `Tu habitación en ${b.nombre} te espera`,
    inner,
  );
}

/**
 * Oferta de regreso PERSONALIZADA (CRM de clientes). A diferencia de la de
 * +30 días, el cuerpo lo redacta la IA según el historial del huésped y aquí
 * solo se le pone la marca. `paragraphs` es texto plano: se escapa, la salida
 * de la IA nunca se inyecta cruda.
 */
export function buildPersonalOfferEmailHtml(data: {
  hotel: HotelBrand;
  customerName: string;
  paragraphs: string[];
  ctaText?: string;
  promoExpiry?: string;
  lang?: Lang;
}): string {
  const en = data.lang === "en";
  const b = brandDefaults(data.hotel);
  const first = primerNombre(data.customerName, en);
  const hasPromo = Boolean(b.promoCode);
  const bookingUrl = `${b.baseUrl}/reservar${hasPromo ? `?promo=${encodeURIComponent(b.promoCode)}` : ""}`;

  const t = en
    ? { eyebrow: "A note for you", h: "We have something for you", codigo: "Your exclusive code", btn: `Book at ${b.nombre}` }
    : { eyebrow: "Una nota para ti", h: "Te tenemos algo especial", codigo: "Tu código exclusivo", btn: `Reservar en ${b.nombre}` };

  const cuerpo = data.paragraphs
    .map(
      (p) =>
        `<p style="font-family:${FONT};font-weight:400;font-size:14.5px;color:${T.cuerpo};line-height:1.75;margin:0 0 14px;">${esc(p)}</p>`,
    )
    .join("");

  const cajaPromo = hasPromo
    ? `<tr><td style="padding:22px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.panel};border:1px solid ${T.borde};border-radius:14px;">
          <tr><td style="padding:24px;text-align:center;">
            <div style="font-family:${FONT};font-weight:600;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${T.tenue};margin-bottom:10px;">${esc(t.codigo)}</div>
            <div style="font-family:${FONT};font-weight:800;font-size:30px;letter-spacing:3px;color:${T.tinta};line-height:1;">${esc(b.promoCode)}</div>
            ${data.promoExpiry ? `<div style="font-family:${FONT};font-weight:400;font-size:12px;color:${T.suave};margin-top:10px;">${esc(b.promoDiscount)} · ${esc(data.promoExpiry)}</div>` : ""}
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const inner =
    cabecera({ nombre: b.nombre, eyebrow: t.eyebrow }) +
    titulo(t.h) +
    `<tr><td style="padding:22px 40px 0;">
      <p style="font-family:${FONT};font-weight:500;font-size:16px;color:${T.tinta};margin:0 0 12px;">${HOLA(en)}, ${esc(first)}</p>
      ${cuerpo}
    </td></tr>` +
    cajaPromo +
    boton(bookingUrl, data.ctaText || t.btn) +
    cierre(b);

  return doc(`${b.nombre} — ${t.eyebrow}`, `${first}, ${t.h.toLowerCase()}`, inner);
}
