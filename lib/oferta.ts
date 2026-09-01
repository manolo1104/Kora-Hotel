// Fuente única de la oferta comercial.

// Mensualidad del plan (el "desde" que se comunica).
export const PRECIO_DESDE = 550;

// Horas que tardamos en dejar el hotel operando, llave en mano.
//
// Estaba escrito a mano en ~30 lugares y no todos decían lo mismo: la landing y
// las FAQ prometían 48 h, el formulario de contacto "48 a 72 horas" y el caso de
// estudio contaba 72 h — tres promesas distintas para el mismo servicio, todas
// visibles en la misma visita. Manolo fijó el número el 31 ago 2026.
export const IMPLEMENTACION_HORAS = 24;

// ─── Plan de suscripción (fuente única) ───────────────────────────────────────
// Los price IDs de Stripe viven en variables de entorno porque cambian entre
// modo prueba y modo live (se generan con: node scripts/stripe-setup.mjs).
//
// Por ahora hay UN SOLO plan:
//   • Kora ($550/mes) → todo incluido, con habitaciones ilimitadas: motor de
//     reservas directo, PMS, Camila (WhatsApp con IA), dashboard y CRM.
//     (El pricing dinámico queda fuera por ahora.)

export type PlanClave = "kora";

export interface Plan {
  clave: PlanClave;
  nombre: string;
  rango: string;
  precio: number; // MXN al mes
  destacado: boolean;
  priceId: string | undefined; // Stripe price ID (server-only)
}

export const PLANES: Plan[] = [
  {
    clave: "kora",
    nombre: "Plan Kora",
    rango: "Todo incluido · habitaciones ilimitadas",
    precio: PRECIO_DESDE,
    destacado: true,
    priceId: process.env.STRIPE_PRICE_KORA,
  },
];

export function planPorClave(clave: string | null | undefined): Plan | null {
  return PLANES.find((p) => p.clave === clave) ?? null;
}

export function planPorPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PLANES.find((p) => p.priceId === priceId) ?? null;
}
