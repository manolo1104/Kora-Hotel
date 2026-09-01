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

// Días que el forecast de ocupación del panel mira hacia adelante.
//
// 🔴 ESTE NÚMERO ES UNA PROMESA PÚBLICA. Hasta el 1 sep 2026 el sitio prometía
// 30 días de forecast en DIEZ superficies (portada, precios, características,
// FAQ de ciudades, dos entradas del glosario, personas, llms.txt y dos
// componentes de la landing) mientras el panel calculaba SIETE
// (`lib/admin/insights.ts`). Nadie lo notó porque el 30 estaba escrito a mano en
// cada sitio y el 7 vivía en un `Array.from({ length: 7 })`.
//
// Decisión de Manolo (1 sep 2026): el texto dice la verdad HOY (7 días) y los 30
// se construyen después. Cuando se construyan, este número pasa a 30 y las diez
// superficies se actualizan solas — que es justo el punto de tenerlo aquí.
//
// Quien lo cambie tiene que cambiar también la gráfica del panel: `ForecastBars`
// dibuja una barra por día en un SVG de 480 px y con 30 barras las etiquetas ya
// no caben en móvil. `tests/caso-paraiso-congruente.test.ts` vigila que ningún
// texto vuelva a escribirlo a mano.
export const FORECAST_DIAS = 7;

// ─── La garantía ──────────────────────────────────────────────────────────────
//
// 🔴 EL ANUNCIO Y EL CONTRATO TIENEN QUE DECIR LO MISMO. Hasta el 31 ago 2026 no
// lo decían: /precios prometía la "Garantía Reservas Directas" —«si en 60 días
// no recuperas tu mensualidad en comisiones ahorradas, seguimos trabajando
// gratis hasta lograrlo»— y los Términos §6 decían, literalmente, que «Kora no
// garantiza resultados específicos en ocupación, ingresos o reservas». Una
// promesa publicitaria que el propio contrato niega es publicidad engañosa
// (LFPC art. 32), y encima era incobrable: nada en el panel mide "comisiones
// ahorradas", así que cada reclamación se habría negociado a mano.
//
// Decisión de Manolo (31 ago 2026): se sustituye por la garantía que YA estaba
// en los Términos y sí se puede cumplir. Quien toque este texto tiene que tocar
// también `app/terminos/page.tsx`, y al revés.
export const GARANTIA = {
  titulo: "Sin riesgo para ti",
  /** Días de prueba gratis, antes de pedir ningún dato de pago. */
  diasPrueba: 30,
  /** Días tras el PRIMER PAGO en los que se devuelve esa mensualidad. */
  diasDevolucion: 30,
} as const;

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
