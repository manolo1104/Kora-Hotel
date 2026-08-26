// El CONTRATO de metadata entre quien cobra y quien crea la reserva. PURO.
//
// Son tres puntas que tienen que coincidir exactamente, y hasta ahora nada lo
// obligaba: el motor web (`app/api/h/[slug]/checkout/route.ts`) y Camila
// (`lib/agent-booking.ts`) construyen cada uno su objeto a mano, y el webhook
// (`app/api/h/webhooks/stripe/route.ts`) lo lee. Stripe acepta cualquier objeto
// de strings, así que una clave mal escrita en un lado no falla al cobrar:
// falla DESPUÉS, cuando el huésped ya pagó y la reserva no se puede crear.
//
// `lib/agent-booking.ts:13` dice literalmente "Separado del route para poder
// testear sin auth/HTTP" — y ese test nunca se escribió. Este archivo es lo que
// lo hace posible: la parte compartida se construye aquí, y `tests/` la
// comprueba contra la lista de claves que el webhook realmente lee.

/**
 * Las claves que `app/api/h/webhooks/stripe/route.ts` lee de `session.metadata`.
 * Sacadas del propio webhook (`grep -o "md\.[a-zA-Z_]*"`). Si el webhook
 * empieza a leer una clave nueva, va aquí y el test dirá quién no la manda.
 */
export const CLAVES_QUE_LEE_EL_WEBHOOK = [
  "hotel_id",
  "slug",
  "rooms",
  "checkin",
  "checkout",
  "stayTotal",
  "depositPaid",
  "payMode",
  "ratePlan",
  "holdSession",
  "lang",
  "adults",
  "children",
  "customerName",
  "customerEmail",
  "customerPhone",
] as const;

/**
 * Claves que el webhook lee pero que son OPCIONALES por diseño: sólo existen en
 * uno de los dos caminos. Se enumeran para que su ausencia sea una decisión
 * escrita y no un descuido que el test tenga que perdonar en silencio.
 *  - `addons`, `experiencias`, `experiencias_data`, `bundleDiscount`: sólo el
 *    motor web los vende; Camila todavía no.
 *  - `origen`: sólo lo pone Camila (`"bot"`); el motor web lo deja implícito.
 */
export const CLAVES_OPCIONALES = [
  "addons",
  "experiencias",
  "experiencias_data",
  "bundleDiscount",
  "origen",
] as const;

export interface MetadataBase {
  hotelId: string;
  slug: string;
  /** "unidad:huéspedes" separado por "|", una entrada por unidad apartada. */
  rooms: string;
  checkin: string;
  checkout: string;
  nights: number;
  stayTotal: number;
  deposit: number;
  pending: number;
  anticipoPct: number;
  ratePlan: "flex" | "nrf";
  payMode: "online" | "hotel";
  adults: number;
  children: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  holdSession: string;
  lang: "es" | "en";
}

/**
 * Construye la parte de la metadata que las DOS puntas deben mandar igual.
 * Cada llamador le añade encima lo suyo (extras del motor web, `origen` del bot).
 *
 * Stripe limita metadata a 50 claves y 500 caracteres por valor: los recortes
 * son los mismos que ya hacían los dos call sites, centralizados aquí.
 */
export function construirMetadataBase(a: MetadataBase): Record<string, string> {
  const isDeposit = a.deposit > 0 && a.deposit < a.stayTotal;
  return {
    hotel_id: a.hotelId,
    slug: a.slug,
    rooms: a.rooms.slice(0, 480),
    checkin: a.checkin,
    checkout: a.checkout,
    nights: String(a.nights),
    stayTotal: String(a.stayTotal),
    depositPaid: String(a.deposit),
    pending: String(a.pending),
    isDeposit: String(isDeposit),
    anticipoPct: String(a.anticipoPct),
    ratePlan: a.ratePlan,
    payMode: a.payMode,
    adults: String(a.adults),
    children: String(a.children),
    customerName: (a.customerName || "").slice(0, 120),
    customerEmail: (a.customerEmail || "").slice(0, 160),
    customerPhone: (a.customerPhone || "").slice(0, 30),
    holdSession: a.holdSession,
    lang: a.lang,
  };
}

/** Las claves obligatorias que le faltan a una metadata. Vacío = contrato cumplido. */
export function clavesQueFaltan(md: Record<string, string>): string[] {
  return CLAVES_QUE_LEE_EL_WEBHOOK.filter((k) => !(k in md));
}
