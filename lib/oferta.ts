// Fuente única de la oferta de fundadores.
// Actualizar LUGARES_DISPONIBLES a mano conforme se van ocupando los lugares.
export const TOTAL_LUGARES = 10;
export const LUGARES_DISPONIBLES = 7;

// Valor real del servicio de página web a la medida (precio normal fuera de la oferta).
export const VALOR_WEB = 30000;

// Mensualidad de entrada (hotel boutique chico) — el "desde" que se comunica.
export const PRECIO_DESDE = 1990;

// Mes/año en que abrimos los primeros lugares fundadores.
export const LANZAMIENTO = "junio de 2026";

// ─── Planes de suscripción (fuente única) ─────────────────────────────────────
// Los price IDs de Stripe viven en variables de entorno porque cambian entre
// modo prueba y modo live (se generan con: node scripts/stripe-setup.mjs).

export type PlanClave = "boutique" | "hotel" | "grande";

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
    clave: "boutique",
    nombre: "Boutique",
    rango: "1 a 8 habitaciones",
    precio: PRECIO_DESDE,
    destacado: false,
    priceId: process.env.STRIPE_PRICE_BOUTIQUE,
  },
  {
    clave: "hotel",
    nombre: "Hotel",
    rango: "9 a 20 habitaciones",
    precio: 2990,
    destacado: true,
    priceId: process.env.STRIPE_PRICE_HOTEL,
  },
  {
    clave: "grande",
    nombre: "Hotel grande",
    rango: "21 habitaciones o más",
    precio: 4490,
    destacado: false,
    priceId: process.env.STRIPE_PRICE_GRANDE,
  },
];

export function planPorClave(clave: string | null | undefined): Plan | null {
  return PLANES.find((p) => p.clave === clave) ?? null;
}

export function planPorPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  return PLANES.find((p) => p.priceId === priceId) ?? null;
}
