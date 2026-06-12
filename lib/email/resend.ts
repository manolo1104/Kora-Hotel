import { Resend } from "resend";

// Envío de correos transaccionales con Resend. SOLO servidor.
// Si RESEND_API_KEY no está configurada, los envíos se omiten sin romper nada
// (el resto del flujo — CRM, webhook, etc. — sigue funcionando).

const API_KEY = process.env.RESEND_API_KEY ?? "";

/** Remitente. El dominio debe estar verificado en resend.com. */
const FROM = process.env.RESEND_FROM || "Kora <hola@kora-hotel.com>";

/** Correo del fundador para avisos internos (leads, digest, pagos). */
export const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "";

export const resendEnvReady = Boolean(API_KEY);

export async function enviarEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  if (!API_KEY || !to) {
    console.log(`[email omitido] ${subject} → ${to || "(sin destinatario)"}`);
    return false;
  }
  try {
    const resend = new Resend(API_KEY);
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("Error enviando email con Resend:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Error enviando email con Resend:", e);
    return false;
  }
}
