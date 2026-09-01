import { leer } from "@/lib/db/result";
import { enviarEmail, type ResultadoEmail } from "@/lib/email/resend";
// Emails del motor de reservas público. SOLO servidor.
//  - Confirmación al huésped (webhook de Stripe + reenvío desde el portal).
//  - Avisos al hotel: nueva reserva (webhook) y cancelación (portal).
//  - Recordatorio de reserva incompleta (cron /api/cron/abandono).

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import {
  buildBrandedBookingEmailHtml,
  buildBrandedRecoveryEmailHtml,
  type BookingBrand,
} from "@/lib/email/booking-branded";
import {
  T as TOK,
  FONT,
  doc,
  esc,
  money,
  cabecera,
  titulo,
  saludo,
  parrafo,
  botonOscuro,
  tablaDatos,
  caja,
  pieHotel,
  pieKora,
  respiro,
} from "@/lib/email/design";
import { EMAIL_RESERVAS } from "@/lib/contacto";

/** Noches entre dos fechas YYYY-MM-DD (mínimo 1). */
function calcNoches(checkin: string, checkout: string): number {
  const a = Date.parse(checkin);
  const b = Date.parse(checkout);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

export interface ConfirmacionEmailArgs {
  hotelNombre: string;
  confirmacion: string;
  habitaciones: string[];
  checkin: string;
  checkout: string;
  anticipo: number;
  pendiente: number;
  cliente?: string | null;
  huespedes?: number;
  ratePlan?: string | null; // 'nrf' = tarifa no reembolsable
  experiencias?: string[]; // tours/traslados/cena contratados en el motor (con cantidad)
  portalUrl?: string; // link a /reserva/consultar
  brandColor?: string;
  lang?: "es" | "en"; // idioma con el que reservó el huésped (md.lang)
  brand?: BookingBrand; // si viene, se usa el correo PREMIUM con logo+color del hotel
  checkinTime?: string; // hora de entrada (de la guía del hotel)
  checkoutTime?: string; // hora de salida
}

export function buildConfirmacionEmailHtml(a: ConfirmacionEmailArgs): string {
  // Sin marca del hotel (caso raro: el llamador no pudo resolver la fila) se
  // arma una marca mínima con el nombre. Así NUNCA sale un correo con un
  // diseño distinto al resto: hay una sola plantilla de confirmación.
  const brand: BookingBrand =
    a.brand ?? { nombre: a.hotelNombre || "el hotel", color: a.brandColor || "#1B4332" };

  return buildBrandedBookingEmailHtml(brand, {
    kind: "reserva",
    lang: a.lang,
    confirmacion: a.confirmacion,
    cliente: a.cliente || "",
    suites: a.habitaciones,
    checkin: a.checkin,
    checkout: a.checkout,
    noches: calcNoches(a.checkin, a.checkout),
    huespedes: a.huespedes ?? 0,
    total: (a.anticipo || 0) + (a.pendiente || 0),
    anticipo: a.anticipo,
    restante: a.pendiente,
    experiencias: a.experiencias,
    portalUrl: a.portalUrl,
    nrf: a.ratePlan === "nrf",
    checkinTime: a.checkinTime,
    checkoutTime: a.checkoutTime,
  });
}

/**
 * Envío base del motor (gated por RESEND_API_KEY; nunca lanza).
 *
 * Antes se creaba aquí su propio `new Resend(...)`: era uno de los cinco
 * clientes sueltos del repo. Ahora pasa por la puerta única de
 * `lib/email/resend.ts`, así que un fallo trae MOTIVO y no sólo un `false` —
 * que es lo que necesita el webhook para poder decir en la alerta qué pasó.
 */
async function sendMotorEmail(
  to: string,
  subject: string,
  html: string,
  fromOverride?: string | null,
  replyTo?: string | null,
): Promise<ResultadoEmail> {
  if (!to.includes("@")) return { ok: false, error: `destinatario inválido: ${to || "(vacío)"}` };
  return enviarEmail({
    to,
    subject,
    html,
    from: fromOverride || process.env.RESEND_FROM || EMAIL_RESERVAS,
    replyTo: replyTo || undefined,
  });
}

/** Envía la confirmación (gated por RESEND_API_KEY; nunca lanza). */
export async function sendConfirmacionReserva(
  to: string,
  args: ConfirmacionEmailArgs,
  fromOverride?: string | null,
): Promise<ResultadoEmail> {
  return sendMotorEmail(
    to,
    args.lang === "en"
      ? `Your booking is confirmed — ${args.confirmacion}`
      : `Tu reserva está confirmada — ${args.confirmacion}`,
    buildConfirmacionEmailHtml(args),
    fromOverride,
    args.brand?.email,
  );
}

// ─── Destinatario de avisos del hotel ────────────────────────────────────────

interface HotelAvisoLike {
  id: string;
  owner_id?: string | null;
  extras?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
}

/**
 * Correo donde el hotel recibe avisos de reservas: extras.notificaciones.email
 * (Panel → Avanzado) → config.email → correo de la cuenta del dueño. Devuelve
 * "" si no se pudo resolver ninguno. Nunca lanza.
 */
export async function resolveHotelAvisoEmail(hotel: HotelAvisoLike): Promise<string> {
  const str = (v: unknown) =>
    typeof v === "string" && v.trim().includes("@") ? v.trim() : "";

  const notif = (hotel.extras as { notificaciones?: { email?: unknown } } | null)?.notificaciones;
  const configurado = str(notif?.email) || str(hotel.config?.email);
  if (configurado) return configurado;

  if (!adminEnvReady) return "";
  try {
    const admin = createAdminClient();
    let ownerId = hotel.owner_id ?? null;
    if (!ownerId) {
      const fila = await leer<{ owner_id: string }>(
        "hotel.ownerId",
        admin.from("hoteles").select("owner_id").eq("id", hotel.id).maybeSingle(),
      );
      ownerId = fila?.owner_id ?? null;
    }
    if (!ownerId) return "";
    const { data, error } = await admin.auth.admin.getUserById(ownerId);
    if (error) {
      // Sin esto, el hotel se queda sin su aviso de reserva nueva y el único
      // rastro era un string vacío indistinguible de "no configuró correo".
      console.error(`[aviso-hotel] no se pudo resolver el correo del dueño ${ownerId}:`, error.message);
      return "";
    }
    return str(data?.user?.email);
  } catch (e) {
    console.error("resolveHotelAvisoEmail error:", e);
    return "";
  }
}

// ─── Aviso al hotel: nueva reserva (webhook de Stripe) ───────────────────────

export interface AvisoReservaHotelArgs {
  hotelNombre: string;
  panelUrl: string; // link directo a /panel/{slug}/reservas
  confirmacion: string;
  cliente?: string | null;
  telefono?: string | null;
  email?: string | null;
  habitaciones: string[];
  checkin: string;
  checkout: string;
  huespedes: number;
  total: number;
  anticipo: number;
  /** true = hay TARJETA EN GARANTÍA de verdad (SetupIntent de Stripe).
   *  NO usar para "reserva sin anticipo": eso se deduce de `anticipo <= 0`. */
  pagoEnHotel?: boolean;
  ratePlan?: string | null;
  experiencias?: string[]; // tours/traslados/cena contratados (para preparar)
}

export function buildAvisoReservaHotelHtml(a: AvisoReservaHotelArgs): string {
  // Tres casos, no dos (K-253). El del medio faltaba: una reserva METIDA A MANO
  // desde el panel no pasa por Stripe, así que NO hay ninguna tarjeta en
  // garantía — y el aviso le decía al hotelero que sí, que es justo el dato con
  // el que decide si le guarda el cuarto a alguien que no ha pagado nada.
  const pago = a.pagoEnHotel
    ? `<strong style="color:${TOK.tinta};">Paga al llegar</strong> — tarjeta en garantía, cobras en recepción.`
    : a.anticipo <= 0
      ? `<strong style="color:${TOK.tinta};">Sin anticipo</strong> — cobras ${money(a.total)} en recepción. Ojo: <strong>no hay tarjeta en garantía</strong>.`
      : `Anticipo pagado: <strong style="color:${TOK.exito};">${money(a.anticipo)}</strong> · Saldo al llegar: <strong style="color:${TOK.tinta};">${money(Math.max(0, a.total - a.anticipo))}</strong>`;

  const filas = [
    { k: "Huésped", v: `${esc(a.cliente || "Sin nombre")}${a.huespedes ? ` · ${a.huespedes} persona(s)` : ""}` },
    ...(a.telefono ? [{ k: "Teléfono", v: esc(a.telefono) }] : []),
    ...(a.email ? [{ k: "Correo", v: esc(a.email) }] : []),
    { k: "Habitación(es)", v: esc(a.habitaciones.join(", ")) || "—" },
    ...(a.experiencias?.length ? [{ k: "Experiencias", v: esc(a.experiencias.join(", ")) }] : []),
    { k: "Llegada", v: esc(a.checkin) },
    { k: "Salida", v: esc(a.checkout) },
    { k: "Total", v: money(a.total) },
    ...(a.ratePlan === "nrf" ? [{ k: "Tarifa", v: "No reembolsable" }] : []),
  ];

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Nueva reserva" }) +
    titulo("Entró una reserva 🛎️", `Folio <strong style="color:${TOK.cuerpo};letter-spacing:1px;">${esc(a.confirmacion)}</strong>`) +
    parrafo(`Llegó por el motor de reservas de <strong style="color:${TOK.tinta};">${esc(a.hotelNombre)}</strong>.`) +
    tablaDatos(filas) +
    caja(pago) +
    botonOscuro(a.panelUrl, "Ver en mi panel") +
    respiro +
    pieKora("Este aviso te llega porque eres quien recibe las notificaciones de reservas de este hotel.");

  return doc(
    `Nueva reserva ${a.confirmacion}`,
    `${a.cliente || "Un huésped"} reservó del ${a.checkin} al ${a.checkout}`,
    inner,
  );
}

/** Aviso inmediato al hotel de reserva nueva. Best-effort, nunca lanza. */
export async function sendAvisoReservaHotel(
  to: string,
  args: AvisoReservaHotelArgs,
): Promise<ResultadoEmail> {
  return sendMotorEmail(
    to,
    `Nueva reserva ${args.confirmacion} — ${args.checkin} (${args.cliente || "sin nombre"})`,
    buildAvisoReservaHotelHtml(args),
  );
}

// ─── Aviso al hotel: cancelación desde el portal del huésped ─────────────────

export interface AvisoCancelacionHotelArgs {
  hotelNombre: string;
  panelUrl: string;
  confirmacion: string;
  cliente?: string | null;
  email?: string | null;
  habitaciones: string;
  checkin: string;
  checkout: string;
  anticipo: number;
  /**
   * Quién la canceló. "panel" = la canceló el PROPIO hotel desde su panel; ahí
   * este correo no es un aviso sino una constancia, y sobre todo el recordatorio
   * del reembolso — al huésped ya se le dijo que el hotel se lo devuelve.
   */
  origen?: "portal" | "panel";
}

export function buildAvisoCancelacionHotelHtml(a: AvisoCancelacionHotelArgs): string {
  const porElHotel = a.origen === "panel";
  const filas = [
    { k: "Huésped", v: esc(a.cliente || a.email || "—") },
    { k: "Habitación(es)", v: esc(a.habitaciones) || "—" },
    { k: "Fechas", v: `${esc(a.checkin)} → ${esc(a.checkout)}` },
    // Kora NO emite reembolsos de cancelación (decisión del 26 ago 2026): los
    // coordina el hotel desde su propia cuenta de Stripe. Al huésped su correo
    // ya le dice exactamente eso, así que aquí no puede quedar ambiguo.
    ...(a.anticipo > 0
      ? [{
          k: "Anticipo",
          v: `${money(a.anticipo)} — al huésped se le dijo que TÚ se lo devuelves. Emítelo desde tu Stripe: Kora no lo hace por ti.`,
        }]
      : []),
  ];

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Reserva cancelada" }) +
    titulo(porElHotel ? "Cancelaste una reserva" : "Se canceló una reserva", `Folio <strong style="color:${TOK.cuerpo};letter-spacing:1px;">${esc(a.confirmacion)}</strong>`) +
    parrafo(
      porElHotel
        ? `Cancelaste esta reserva de <strong style="color:${TOK.tinta};">${esc(a.hotelNombre)}</strong> desde tu panel. Guarda este correo como constancia.`
        : `El huésped canceló su reserva en <strong style="color:${TOK.tinta};">${esc(a.hotelNombre)}</strong> desde el portal, dentro del plazo de cancelación gratis.`,
    ) +
    tablaDatos(filas) +
    caja("Las fechas ya quedaron liberadas en tu calendario: el cuarto vuelve a estar a la venta.", "exito") +
    botonOscuro(a.panelUrl, "Ver en mi panel") +
    respiro +
    pieKora();

  return doc(
    `Reserva cancelada ${a.confirmacion}`,
    `${a.cliente || "Un huésped"} canceló su reserva del ${a.checkin}`,
    inner,
  );
}

/** Aviso al hotel de cancelación self-service. Best-effort, nunca lanza. */
export async function sendAvisoCancelacionHotel(
  to: string,
  args: AvisoCancelacionHotelArgs,
): Promise<ResultadoEmail> {
  return sendMotorEmail(
    to,
    `Reserva cancelada ${args.confirmacion} — ${args.checkin}`,
    buildAvisoCancelacionHotelHtml(args),
  );
}

// ─── Pago recibido SIN cuarto disponible (conflicto al confirmar) ────────────
// Caso raro pero grave: el huésped pagó y, al crear la reserva, el cuarto ya
// estaba ocupado (p.ej. dejó el Checkout abierto y otro reservó antes).

export interface PagoSinCuartoArgs {
  hotelNombre: string;
  cliente?: string | null;
  email?: string | null;
  telefono?: string | null;
  habitaciones: string[];
  checkin: string;
  checkout: string;
  monto: number;
  reembolsado: boolean; // true = el reembolso automático se creó en Stripe
  lang?: "es" | "en";
  /** Correo del hotel, para que la respuesta del huésped le llegue a él. */
  hotelEmail?: string;
}

export function buildPagoSinCuartoHuespedHtml(a: PagoSinCuartoArgs): string {
  const en = a.lang === "en";
  const t = en
    ? {
        eyebrow: "About your payment",
        h: "We're sorry — that room is no longer available",
        hola: "Hi",
        intro: `Your payment for <strong>${esc(a.hotelNombre)}</strong> went through, but the room was taken moments before we could confirm your booking. This is on us, and we're fixing it right away.`,
        fechas: "Dates",
        cuartos: "Room(s)",
        monto: "Amount",
        reembolsado: `We already issued a full refund of <strong>${money(a.monto)}</strong>. It will show up in your account within a few business days.`,
        pendiente: `The hotel will issue your full refund of <strong>${money(a.monto)}</strong> to the same payment method you used — we have already alerted them. If you don't see it within 5 business days, reply to this email and it reaches them directly.`,
        nota: "The hotel has been notified and may reach out with alternative dates.",
      }
    : {
        eyebrow: "Sobre tu pago",
        h: "Una disculpa — ese cuarto ya no está disponible",
        hola: "Hola",
        intro: `Tu pago para <strong>${esc(a.hotelNombre)}</strong> sí se procesó, pero el cuarto se ocupó momentos antes de que pudiéramos confirmar tu reserva. La falla es nuestra y ya la estamos resolviendo.`,
        fechas: "Fechas",
        cuartos: "Cuarto(s)",
        monto: "Monto",
        reembolsado: `Ya emitimos el reembolso completo de <strong>${money(a.monto)}</strong>. Lo verás reflejado en unos días hábiles.`,
        pendiente: `El hotel va a devolverte los <strong>${money(a.monto)}</strong> completos por el mismo medio con el que pagaste — ya se lo avisamos. Si no lo ves en 5 días hábiles, responde a este correo y le llega directo a él.`,
        nota: "El hotel ya fue notificado y puede contactarte con fechas alternativas.",
      };

  const inner =
    cabecera({ nombre: a.hotelNombre, eyebrow: t.eyebrow }) +
    titulo(t.h) +
    saludo(t.hola, (a.cliente || "").trim().split(/\s+/)[0] || (en ? "there" : ""), t.intro) +
    tablaDatos([
      { k: t.fechas, v: `${esc(a.checkin)} → ${esc(a.checkout)}` },
      { k: t.cuartos, v: esc(a.habitaciones.join(", ")) || "—" },
      { k: t.monto, v: money(a.monto) },
    ]) +
    // `reembolsado:false` significa que el `refunds.create` del webhook FALLÓ y
    // sólo quedó un console.error: no hay nada procesándose en segundo plano.
    // El correo decía "estamos procesando tu reembolso", que era falso y además
    // dejaba al huésped esperando a nadie. Como los reembolsos los emite el
    // hotel (decisión de Manolo, reconfirmada el 31 ago 2026), el texto ahora
    // nombra a quien de verdad va a mover el dinero — y con el `replyTo` que
    // lleva este correo, responderlo le llega a él.
    caja(a.reembolsado ? t.reembolsado : t.pendiente, a.reembolsado ? "exito" : "alerta") +
    parrafo(`<span style="font-size:13px;color:${TOK.tenue};">${esc(t.nota)}</span>`) +
    respiro +
    pieHotel({ nombre: a.hotelNombre });

  return doc(`${a.hotelNombre} — ${t.eyebrow}`, t.h, inner, en ? "en" : "es");
}

export function buildPagoSinCuartoHotelHtml(a: PagoSinCuartoArgs): string {
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Requiere tu atención" }) +
    titulo("⚠️ Pago recibido sin cuarto disponible") +
    parrafo(
      `Un huésped pagó en <strong style="color:${TOK.tinta};">${esc(a.hotelNombre)}</strong> pero su cuarto ya estaba ocupado al momento de confirmar (probablemente dejó el pago abierto y alguien más reservó antes).`,
    ) +
    tablaDatos([
      { k: "Huésped", v: `${esc(a.cliente || "—")} · ${esc(a.email || "—")} · ${esc(a.telefono || "—")}` },
      { k: "Cuarto(s)", v: esc(a.habitaciones.join(", ")) || "—" },
      { k: "Fechas", v: `${esc(a.checkin)} → ${esc(a.checkout)}` },
      { k: "Monto", v: money(a.monto) },
      {
        k: "Reembolso",
        v: a.reembolsado
          ? `<span style="color:${TOK.exito};">Emitido automáticamente en Stripe</span>`
          : `<span style="color:${TOK.error};">NO se pudo emitir automático — hazlo a mano en tu Stripe HOY</span>`,
      },
    ]) +
    caja(
      a.reembolsado
        ? "Si tienes otro cuarto libre en esas fechas, contacta al huésped: puedes salvar la venta."
        : "Emite el reembolso manualmente hoy mismo y contacta al huésped. Si tienes otro cuarto libre en esas fechas, puedes salvar la venta.",
      a.reembolsado ? "neutro" : "error",
    ) +
    respiro +
    pieKora();

  return doc(
    `Pago sin cuarto — ${a.hotelNombre}`,
    `Un huésped pagó ${money(a.monto)} y el cuarto ya estaba ocupado`,
    inner,
  );
}

/** Disculpa + estado del reembolso al huésped. Best-effort, nunca lanza. */
export async function sendPagoSinCuartoHuesped(
  to: string,
  args: PagoSinCuartoArgs,
  fromOverride?: string | null,
): Promise<ResultadoEmail> {
  return sendMotorEmail(
    to,
    args.lang === "en"
      ? `About your payment — ${args.hotelNombre}`
      : `Sobre tu pago — ${args.hotelNombre}`,
    buildPagoSinCuartoHuespedHtml(args),
    fromOverride,
    args.hotelEmail,
  );
}

/** Alerta urgente al hotel (y a Kora vía NOTIFY_EMAIL). Best-effort, nunca lanza. */
export async function sendPagoSinCuartoHotel(
  to: string,
  args: PagoSinCuartoArgs,
): Promise<ResultadoEmail> {
  return sendMotorEmail(
    to,
    `⚠️ URGENTE: pago sin cuarto — ${args.hotelNombre} (${args.checkin})`,
    buildPagoSinCuartoHotelHtml(args),
  );
}

// ─── Recordatorio de reserva incompleta (abandono de carrito) ────────────────

export interface AbandonoEmailArgs {
  hotelNombre: string;
  nombre?: string | null;
  checkin?: string | null;
  checkout?: string | null;
  reanudarUrl: string; // /h/{slug}/reservar con fechas/huéspedes prefijados
  lang?: "es" | "en";
  brandColor?: string;
  brand?: BookingBrand; // si viene, correo PREMIUM branded (logo + color del hotel)
  suites?: string[]; // cuarto(s) del carrito abandonado
  huespedes?: number;
  noches?: number;
  total?: number; // total estimado del carrito
}

export function buildAbandonoEmailHtml(a: AbandonoEmailArgs): string {
  const brand: BookingBrand =
    a.brand ?? { nombre: a.hotelNombre || "el hotel", color: a.brandColor || "#1B4332" };

  return buildBrandedRecoveryEmailHtml(brand, {
    lang: a.lang,
    nombre: a.nombre,
    checkin: a.checkin,
    checkout: a.checkout,
    reanudarUrl: a.reanudarUrl,
    suites: a.suites,
    huespedes: a.huespedes,
    noches: a.noches,
    total: a.total,
  });
}

/** Recordatorio de abandono al huésped. Best-effort, nunca lanza. */
export async function sendRecordatorioAbandono(
  to: string,
  args: AbandonoEmailArgs,
  fromOverride?: string | null,
): Promise<ResultadoEmail> {
  const en = args.lang === "en";
  return sendMotorEmail(
    to,
    en
      ? `Your booking at ${args.hotelNombre} is one step away`
      : `Tu reserva en ${args.hotelNombre} quedó a un paso`,
    buildAbandonoEmailHtml(args),
    fromOverride,
    args.brand?.email,
  );
}

// ─── Cancelación: comprobante para el HUÉSPED ────────────────────────────────
// Antes, cuando el huésped cancelaba desde el portal, el hotel recibía aviso y
// el huésped NO recibía nada: se quedaba sin comprobante de su propia
// cancelación. Este es ese comprobante.

export interface CancelacionHuespedArgs {
  hotelNombre: string;
  confirmacion: string;
  cliente?: string | null;
  habitaciones: string;
  checkin: string;
  checkout: string;
  anticipo: number;
  reembolsable: boolean; // canceló dentro del plazo de cancelación gratis
  lang?: "es" | "en";
  brand?: BookingBrand;
  /**
   * Correo del hotel para la respuesta del huésped. Este correo le dice
   * "responde este correo y te ayudamos", así que tiene que llegar al hotel.
   * Mejor que `brand.email` cuando el llamador ya resolvió el real.
   */
  hotelEmail?: string;
}

export function buildCancelacionHuespedHtml(a: CancelacionHuespedArgs): string {
  const en = a.lang === "en";
  const first = (a.cliente || "").trim().split(/\s+/)[0] || "";
  const t = en
    ? {
        eyebrow: "Booking cancelled",
        h: "Your booking is cancelled",
        hola: "Hi",
        intro: `We cancelled your booking at <strong>${esc(a.hotelNombre)}</strong>. Keep this email as your record — nothing else is needed from you.`,
        folio: "Confirmation",
        hab: "Room(s)",
        fechas: "Dates",
        anticipo: "Deposit",
        // NO dice "is being refunded": ningún código emite el refund en Stripe.
        // Los tres caminos de cancelación (portal del huésped, PATCH y DELETE
        // del panel) llegan a este mismo texto, así que la promesa se hacía por
        // triplicado y el huésped esperaba 10 días a que no pasara nada.
        conReembolso: `Your deposit of <strong>${money(a.anticipo)}</strong> is refundable under the terms of your booking. The hotel returns it to the same payment method you used. If you don't see it within a few days, reply to this email.`,
        sinReembolso: `Your deposit of <strong>${money(a.anticipo)}</strong> is non-refundable under the rate you booked, so it won't be returned.`,
        cierre: "If you cancelled by mistake or want to move your dates, reply to this email — we'll help you.",
      }
    : {
        eyebrow: "Reserva cancelada",
        h: "Tu reserva quedó cancelada",
        hola: "Hola",
        intro: `Cancelamos tu reserva en <strong>${esc(a.hotelNombre)}</strong>. Guarda este correo como comprobante — no necesitas hacer nada más.`,
        folio: "Folio",
        hab: "Habitación(es)",
        fechas: "Fechas",
        anticipo: "Anticipo",
        conReembolso: `Tu anticipo de <strong>${money(a.anticipo)}</strong> es reembolsable según las condiciones de tu reserva. El hotel te lo devuelve por el mismo medio con el que pagaste. Si en unos días no lo ves reflejado, responde este correo.`,
        sinReembolso: `Tu anticipo de <strong>${money(a.anticipo)}</strong> no es reembolsable por la tarifa que elegiste, así que no se devuelve.`,
        cierre: "Si cancelaste por error o quieres mover tus fechas, responde este correo y te ayudamos.",
      };

  const inner =
    cabecera({ nombre: a.brand?.nombre || a.hotelNombre, eyebrow: t.eyebrow }) +
    titulo(t.h, `${t.folio} <strong style="color:${TOK.cuerpo};letter-spacing:1px;">${esc(a.confirmacion)}</strong>`) +
    saludo(t.hola, first, t.intro) +
    tablaDatos([
      { k: t.hab, v: esc(a.habitaciones) || "—" },
      { k: t.fechas, v: `${esc(a.checkin)} → ${esc(a.checkout)}` },
      ...(a.anticipo > 0 ? [{ k: t.anticipo, v: money(a.anticipo) }] : []),
    ]) +
    (a.anticipo > 0
      ? caja(a.reembolsable ? t.conReembolso : t.sinReembolso, a.reembolsable ? "exito" : "alerta")
      : "") +
    parrafo(`<span style="font-size:13px;color:${TOK.tenue};">${esc(t.cierre)}</span>`) +
    respiro +
    pieHotel({ nombre: a.brand?.nombre || a.hotelNombre, ubicacion: a.brand?.ubicacion });

  return doc(`${a.hotelNombre} — ${t.eyebrow}`, `${t.h} — ${a.confirmacion}`, inner, en ? "en" : "es");
}

/** Comprobante de cancelación al huésped. Best-effort, nunca lanza. */
export async function sendCancelacionHuesped(
  to: string,
  args: CancelacionHuespedArgs,
  fromOverride?: string | null,
): Promise<ResultadoEmail> {
  return sendMotorEmail(
    to,
    args.lang === "en"
      ? `Your booking is cancelled — ${args.confirmacion}`
      : `Tu reserva quedó cancelada — ${args.confirmacion}`,
    buildCancelacionHuespedHtml(args),
    fromOverride,
    args.hotelEmail || args.brand?.email,
  );
}

// ─── Reserva modificada por el hotel: aviso al HUÉSPED ───────────────────────
// Cuando el hotelero le cambia fechas o habitación desde el panel, el huésped
// tiene que enterarse: antes se le cambiaba la reserva en silencio.

export interface ModificacionHuespedArgs {
  hotelNombre: string;
  confirmacion: string;
  cliente?: string | null;
  habitaciones: string;
  checkin: string;
  checkout: string;
  noches: number;
  huespedes?: number;
  total: number;
  anticipo: number;
  anterior?: { habitaciones?: string; checkin?: string; checkout?: string };
  portalUrl?: string;
  lang?: "es" | "en";
  brand?: BookingBrand;
  /**
   * Correo del hotel para la respuesta del huésped. Este correo le dice
   * "responde este correo y te ayudamos", así que tiene que llegar al hotel.
   * Mejor que `brand.email` cuando el llamador ya resolvió el real.
   */
  hotelEmail?: string;
}

export function buildModificacionHuespedHtml(a: ModificacionHuespedArgs): string {
  const en = a.lang === "en";
  const first = (a.cliente || "").trim().split(/\s+/)[0] || "";
  const restante = Math.max(0, a.total - a.anticipo);
  const t = en
    ? {
        eyebrow: "Booking updated",
        h: "We updated your booking",
        hola: "Hi",
        intro: `The hotel adjusted your reservation at <strong>${esc(a.hotelNombre)}</strong>. These are the new details — everything else stays the same.`,
        folio: "Confirmation",
        hab: "Room(s)",
        fechas: "Dates",
        noches: "Nights",
        huesp: "Guests",
        total: "Total for the stay",
        pagado: "Already paid",
        restante: "Balance on arrival",
        antes: "Previously",
        cierre: "If something doesn't look right, reply to this email right away.",
      }
    : {
        eyebrow: "Reserva actualizada",
        h: "Actualizamos tu reserva",
        hola: "Hola",
        intro: `El hotel ajustó tu reserva en <strong>${esc(a.hotelNombre)}</strong>. Estos son los datos nuevos — todo lo demás sigue igual.`,
        folio: "Folio",
        hab: "Habitación(es)",
        fechas: "Fechas",
        noches: "Noches",
        huesp: "Huéspedes",
        total: "Total de la estancia",
        pagado: "Ya pagado",
        restante: "Restante al llegar",
        antes: "Antes decía",
        cierre: "Si algo no cuadra, responde este correo de inmediato.",
      };

  const antes = a.anterior
    ? [
        a.anterior.habitaciones && a.anterior.habitaciones !== a.habitaciones
          ? `${t.hab}: ${esc(a.anterior.habitaciones)}`
          : "",
        (a.anterior.checkin && a.anterior.checkin !== a.checkin) ||
        (a.anterior.checkout && a.anterior.checkout !== a.checkout)
          ? `${t.fechas}: ${esc(a.anterior.checkin || "—")} → ${esc(a.anterior.checkout || "—")}`
          : "",
      ].filter(Boolean)
    : [];

  const inner =
    cabecera({ nombre: a.brand?.nombre || a.hotelNombre, eyebrow: t.eyebrow }) +
    titulo(t.h, `${t.folio} <strong style="color:${TOK.cuerpo};letter-spacing:1px;">${esc(a.confirmacion)}</strong>`) +
    saludo(t.hola, first, t.intro) +
    tablaDatos([
      { k: t.hab, v: esc(a.habitaciones) || "—" },
      { k: t.fechas, v: `${esc(a.checkin)} → ${esc(a.checkout)}` },
      { k: t.noches, v: String(a.noches) },
      ...(a.huespedes ? [{ k: t.huesp, v: String(a.huespedes) }] : []),
      { k: t.total, v: money(a.total) },
      ...(a.anticipo > 0 ? [{ k: t.pagado, v: money(a.anticipo) }] : []),
      { k: t.restante, v: money(restante) },
    ]) +
    (antes.length ? caja(`<strong>${esc(t.antes)}</strong><br>${antes.join("<br>")}`, "alerta") : "") +
    (a.portalUrl ? botonOscuro(a.portalUrl, en ? "View my booking" : "Ver mi reserva") : "") +
    parrafo(`<span style="font-size:13px;color:${TOK.tenue};">${esc(t.cierre)}</span>`) +
    respiro +
    pieHotel({ nombre: a.brand?.nombre || a.hotelNombre, ubicacion: a.brand?.ubicacion });

  return doc(`${a.hotelNombre} — ${t.eyebrow}`, `${t.h} — ${a.confirmacion}`, inner, en ? "en" : "es");
}

/** Aviso de reserva modificada al huésped. Best-effort, nunca lanza. */
export async function sendModificacionHuesped(
  to: string,
  args: ModificacionHuespedArgs,
  fromOverride?: string | null,
): Promise<ResultadoEmail> {
  return sendMotorEmail(
    to,
    args.lang === "en"
      ? `Your booking was updated — ${args.confirmacion}`
      : `Actualizamos tu reserva — ${args.confirmacion}`,
    buildModificacionHuespedHtml(args),
    fromOverride,
    args.hotelEmail || args.brand?.email,
  );
}
