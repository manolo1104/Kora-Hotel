import { Resend } from "resend";

// LA ÚNICA PUERTA por la que sale un correo de Kora. SOLO servidor.
//
// Había cinco: este archivo, `lib/email/reserva.ts` y tres rutas que se creaban
// su propio `new Resend(...)` copiando la anterior. Tres de las cinco no miraban
// el error que devuelve Resend, y ese detalle importa más de lo que parece: el
// SDK v6 **no lanza nunca**. Ante un fallo de red, un dominio sin verificar o una
// clave revocada devuelve `{data:null, error}` y sigue. Por eso una cotización se
// marcaba ENVIADA con el correo perdido y la ruta respondía `{ok:true}`.
//
// Si RESEND_API_KEY no está configurada, los envíos se omiten sin romper nada
// (el resto del flujo sigue funcionando) — pero devolviendo `{ok:false}`, no un
// éxito silencioso.

const API_KEY = process.env.RESEND_API_KEY ?? "";

/** Remitente. El dominio debe estar verificado en resend.com. */
const FROM = process.env.RESEND_FROM || "Kora <hola@kora-hotel.com>";

/** Correo del fundador para avisos internos (leads, digest, pagos). */
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "";

export const resendEnvReady = Boolean(API_KEY);

/**
 * Qué pasó con el envío. El motivo viaja para que la alerta pueda decirlo, y
 * el `id` de Resend para que `email_log` pueda guardarlo y rastrear el correo.
 */
export type ResultadoEmail = { ok: true; id: string | null } | { ok: false; error: string };

export interface EmailArgs {
  to: string;
  subject: string;
  html: string;
  /** Remitente. Por defecto Kora; pásalo para enviar con la marca del hotel. */
  from?: string;
  /**
   * A dónde va la respuesta del destinatario. Importa en todo correo que salga
   * a nombre de un hotel: el `from` real casi siempre es el dominio de Kora
   * (`config.email_from` no tiene pantalla donde configurarse, así que ningún
   * hotel lo tiene puesto), y varios correos al huésped le dicen "responde este
   * correo y te ayudamos". Sin esto esa respuesta se la come Kora en vez de
   * llegarle a su hotel.
   */
  replyTo?: string;
  /**
   * Cabeceras extra. Se usa para `List-Unsubscribe` en los correos de la lista
   * de marketing (lib/suscriptores.ts): sin ellas Gmail no pinta su botón de
   * "cancelar suscripción" y la gente marca spam en su lugar — y el castigo cae
   * sobre el dominio entero, del que también salen las confirmaciones de
   * reserva de los hoteles clientes.
   *
   * NO las pongas en correos transaccionales (confirmación de reserva, pago
   * vencido): ahí "darse de baja" no aplica y confunde.
   */
  headers?: Record<string, string>;
}

/** Envía y NUNCA lanza. Devuelve el motivo cuando falla. */
export async function enviarEmail({ to, subject, html, from, replyTo, headers }: EmailArgs): Promise<ResultadoEmail> {
  if (!API_KEY) {
    console.log(`[email omitido] ${subject} → ${to || "(sin destinatario)"}`);
    return { ok: false, error: "RESEND_API_KEY no configurada" };
  }
  if (!to) return { ok: false, error: "sin destinatario" };
  try {
    const resend = new Resend(API_KEY);
    const { data, error } = await resend.emails.send({
      from: from || FROM,
      to,
      subject,
      html,
      ...(replyTo && replyTo.includes("@") ? { replyTo } : {}),
      ...(headers ? { headers } : {}),
    });
    if (error) {
      console.error("Error enviando email con Resend:", error);
      return { ok: false, error: error.message || String(error) };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    console.error("Error enviando email con Resend:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Error de envío. `rutaSegura` lo convierte en 500 con mensaje genérico. */
export class EmailError extends Error {
  constructor(public detalle: string) {
    super(`[email] ${detalle}`);
    this.name = "EmailError";
  }
}

/**
 * Igual, pero LANZA si no salió. Es para las rutas donde el correo **es** el
 * producto: enviar una cotización, reenviarle la confirmación a un huésped. Ahí
 * un `{ok:true}` con el correo perdido es una mentira que el hotelero descubre
 * cuando el cliente le reclama.
 *
 * Sin RESEND_API_KEY también lanza, a propósito: la ruta responde 500 en vez de
 * fingir que mandó algo.
 */
export async function enviarEmailOFallar(args: EmailArgs): Promise<void> {
  const r = await enviarEmail(args);
  if (!r.ok) throw new EmailError(r.error);
}
