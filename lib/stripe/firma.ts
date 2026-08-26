// Verificación de la firma del webhook de RESERVAS. SOLO servidor.
//
// Vive aparte del route handler por una razón concreta: es la puerta por la que
// entra TODO el dinero de los huéspedes, y para probarla desde `npm test` no
// puede arrastrar `next/server` ni el handler entero. Extraerla es lo que hace
// posible `tests/firma-webhook.test.ts`.
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";

/** Los secretos configurados hoy. Se lee en cada llamada (los tests los cambian). */
export function secretosDeReservas(): string[] {
  return [
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS,
    process.env.STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT,
  ].filter(Boolean) as string[];
}

/**
 * Devuelve el evento si la firma valida con ALGUNO de los dos secretos, o null.
 *
 * Son dos porque con direct charges este endpoint se registra dos veces en
 * Stripe: como endpoint de cuenta propia y como endpoint de "connected
 * accounts", y cada registro trae su propio secreto.
 *
 * `null` NO significa "no configurado": significa que la firma no valida. Quien
 * llame debe responder 400 y avisar — un secreto mal puesto en Vercel deja a
 * huéspedes pagando sin recibir reserva.
 */
export function verificarFirma(raw: string, sig: string): Stripe.Event | null {
  const stripe = getStripe();
  for (const secret of secretosDeReservas()) {
    try {
      return stripe.webhooks.constructEvent(raw, sig, secret);
    } catch {
      // probar el siguiente secreto
    }
  }
  return null;
}
