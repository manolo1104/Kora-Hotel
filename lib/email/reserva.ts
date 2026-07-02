// Emails del motor de reservas público. SOLO servidor.
//  - Confirmación al huésped (webhook de Stripe + reenvío desde el portal).
//  - Avisos al hotel: nueva reserva (webhook) y cancelación (portal).
//  - Recordatorio de reserva incompleta (cron /api/cron/abandono).

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

export interface ConfirmacionEmailArgs {
  hotelNombre: string;
  confirmacion: string;
  habitaciones: string[];
  checkin: string;
  checkout: string;
  anticipo: number;
  pendiente: number;
  cliente?: string | null;
  ratePlan?: string | null; // 'nrf' = tarifa no reembolsable
  portalUrl?: string; // link a /reserva/consultar
  brandColor?: string;
}

export function buildConfirmacionEmailHtml(a: ConfirmacionEmailArgs): string {
  const color = a.brandColor || "#1B4332";
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-MX")} MXN`;
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;padding:24px;">
    <h2 style="color:${color};">¡Reserva confirmada! 🎉</h2>
    <p>Gracias ${a.cliente || ""}. Tu reserva en <b>${a.hotelNombre}</b> quedó confirmada.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 0;color:#667;">Folio</td><td style="padding:6px 0;font-weight:600;">${a.confirmacion}</td></tr>
      <tr><td style="padding:6px 0;color:#667;">Habitación(es)</td><td style="padding:6px 0;">${a.habitaciones.join(", ")}</td></tr>
      <tr><td style="padding:6px 0;color:#667;">Llegada</td><td style="padding:6px 0;">${a.checkin}</td></tr>
      <tr><td style="padding:6px 0;color:#667;">Salida</td><td style="padding:6px 0;">${a.checkout}</td></tr>
      <tr><td style="padding:6px 0;color:#667;">Anticipo pagado</td><td style="padding:6px 0;font-weight:600;color:${color};">${fmt(a.anticipo)}</td></tr>
      <tr><td style="padding:6px 0;color:#667;">Saldo al llegar</td><td style="padding:6px 0;">${fmt(a.pendiente)}</td></tr>
      ${a.ratePlan === "nrf" ? `<tr><td style="padding:6px 0;color:#667;">Tarifa</td><td style="padding:6px 0;">No reembolsable</td></tr>` : ""}
    </table>
    ${
      a.portalUrl
        ? `<p style="margin-top:16px;font-size:13px;color:#667;">Consulta o gestiona tu reserva en
      <a href="${a.portalUrl}" style="color:${color};">${a.portalUrl}</a> con tu folio y tu correo.</p>`
        : ""
    }
  </div>`;
}

/** Envío base (gated por RESEND_API_KEY; nunca lanza). */
async function sendMotorEmail(
  to: string,
  subject: string,
  html: string,
  fromOverride?: string | null,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !to.includes("@")) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = fromOverride || process.env.RESEND_FROM || "reservas@kora-hotel.com";
    const { error } = await resend.emails.send({ from, to: [to], subject, html });
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    console.error(`sendMotorEmail error (${subject}):`, e);
    return false;
  }
}

/** Envía la confirmación (gated por RESEND_API_KEY; nunca lanza). */
export async function sendConfirmacionReserva(
  to: string,
  args: ConfirmacionEmailArgs,
  fromOverride?: string | null,
): Promise<boolean> {
  return sendMotorEmail(
    to,
    `Tu reserva está confirmada — ${args.confirmacion}`,
    buildConfirmacionEmailHtml(args),
    fromOverride,
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
      const { data } = await admin
        .from("hoteles")
        .select("owner_id")
        .eq("id", hotel.id)
        .maybeSingle();
      ownerId = (data as { owner_id: string } | null)?.owner_id ?? null;
    }
    if (!ownerId) return "";
    const { data } = await admin.auth.admin.getUserById(ownerId);
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
  pagoEnHotel?: boolean; // true = tarjeta en garantía, cobra en recepción
  ratePlan?: string | null;
}

export function buildAvisoReservaHotelHtml(a: AvisoReservaHotelArgs): string {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-MX")} MXN`;
  const fila = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#667;white-space:nowrap;">${k}</td><td style="padding:6px 0;">${v}</td></tr>`;
  const pago = a.pagoEnHotel
    ? `<b>Paga al llegar</b> (tarjeta en garantía)`
    : `Anticipo pagado: <b>${fmt(a.anticipo)}</b> · Saldo al llegar: ${fmt(Math.max(0, a.total - a.anticipo))}`;
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;padding:24px;">
    <h2 style="color:#1B4332;">Nueva reserva 🛎️ — ${a.confirmacion}</h2>
    <p>Entró una reserva por el motor de <b>${a.hotelNombre}</b>.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      ${fila("Huésped", `${a.cliente || "Sin nombre"}${a.huespedes ? ` · ${a.huespedes} persona(s)` : ""}`)}
      ${a.telefono ? fila("Teléfono", a.telefono) : ""}
      ${a.email ? fila("Correo", a.email) : ""}
      ${fila("Habitación(es)", a.habitaciones.join(", ") || "—")}
      ${fila("Llegada", a.checkin)}
      ${fila("Salida", a.checkout)}
      ${fila("Total", fmt(a.total))}
      ${a.ratePlan === "nrf" ? fila("Tarifa", "No reembolsable") : ""}
    </table>
    <p style="font-size:14px;">${pago}</p>
    <p style="margin-top:16px;"><a href="${a.panelUrl}"
      style="background:#1B4332;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Ver en mi panel</a></p>
  </div>`;
}

/** Aviso inmediato al hotel de reserva nueva. Best-effort, nunca lanza. */
export async function sendAvisoReservaHotel(
  to: string,
  args: AvisoReservaHotelArgs,
): Promise<boolean> {
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
}

export function buildAvisoCancelacionHotelHtml(a: AvisoCancelacionHotelArgs): string {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-MX")} MXN`;
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;padding:24px;">
    <h2 style="color:#b91c1c;">Reserva cancelada — ${a.confirmacion}</h2>
    <p>El huésped <b>${a.cliente || a.email || "—"}</b> canceló su reserva en
    <b>${a.hotelNombre}</b> desde el portal (dentro del plazo de cancelación gratis).</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#667;">Habitación(es)</td><td style="padding:6px 0;">${a.habitaciones || "—"}</td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#667;">Fechas</td><td style="padding:6px 0;">${a.checkin} → ${a.checkout}</td></tr>
      ${a.anticipo > 0 ? `<tr><td style="padding:6px 12px 6px 0;color:#667;">Anticipo</td><td style="padding:6px 0;">${fmt(a.anticipo)} — coordina el reembolso desde tu Stripe</td></tr>` : ""}
    </table>
    <p style="font-size:13px;color:#667;">Las fechas ya quedaron liberadas en tu calendario.</p>
    <p style="margin-top:16px;"><a href="${a.panelUrl}"
      style="background:#1B4332;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Ver en mi panel</a></p>
  </div>`;
}

/** Aviso al hotel de cancelación self-service. Best-effort, nunca lanza. */
export async function sendAvisoCancelacionHotel(
  to: string,
  args: AvisoCancelacionHotelArgs,
): Promise<boolean> {
  return sendMotorEmail(
    to,
    `Reserva cancelada ${args.confirmacion} — ${args.checkin}`,
    buildAvisoCancelacionHotelHtml(args),
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
}

export function buildAbandonoEmailHtml(a: AbandonoEmailArgs): string {
  const color = a.brandColor || "#1B4332";
  const en = a.lang === "en";
  const fechas =
    a.checkin && a.checkout
      ? en
        ? `<p style="font-size:14px;">Your dates: <b>${a.checkin}</b> → <b>${a.checkout}</b></p>`
        : `<p style="font-size:14px;">Tus fechas: <b>${a.checkin}</b> → <b>${a.checkout}</b></p>`
      : "";
  const saludo = a.nombre ? `${en ? "Hi" : "Hola"} ${a.nombre},` : en ? "Hi," : "Hola,";
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;padding:24px;">
    <h2 style="color:${color};">${en ? "Your booking is one step away" : "Tu reserva quedó a un paso"}</h2>
    <p>${saludo} ${
      en
        ? `we saved your search at <b>${a.hotelNombre}</b> so you can pick up right where you left off.`
        : `guardamos tu búsqueda en <b>${a.hotelNombre}</b> para que la retomes justo donde te quedaste.`
    }</p>
    ${fechas}
    <p style="margin:20px 0;"><a href="${a.reanudarUrl}"
      style="background:${color};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">${
        en ? "Complete my booking" : "Completar mi reserva"
      }</a></p>
    <p style="font-size:12px;color:#667;">${
      en
        ? "Availability isn't guaranteed until you finish — rooms are released to other guests."
        : "La disponibilidad no se aparta hasta terminar: los cuartos se liberan a otros huéspedes."
    }</p>
  </div>`;
}

/** Recordatorio de abandono al huésped. Best-effort, nunca lanza. */
export async function sendRecordatorioAbandono(
  to: string,
  args: AbandonoEmailArgs,
  fromOverride?: string | null,
): Promise<boolean> {
  const en = args.lang === "en";
  return sendMotorEmail(
    to,
    en
      ? `Your booking at ${args.hotelNombre} is one step away`
      : `Tu reserva en ${args.hotelNombre} quedó a un paso`,
    buildAbandonoEmailHtml(args),
    fromOverride,
  );
}
