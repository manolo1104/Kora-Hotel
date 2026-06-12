import Stripe from "stripe";

// Cliente de Stripe: SOLO servidor (route handlers / server components).
// La llave vive en STRIPE_SECRET_KEY (sk_test_... en local, sk_live_... en Vercel).

const SECRET = process.env.STRIPE_SECRET_KEY ?? "";

/** true solo cuando la llave secreta de Stripe está configurada. */
export const stripeEnvReady = Boolean(SECRET);

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(SECRET);
  return _stripe;
}
