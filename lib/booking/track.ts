// Eventos e-commerce del motor de reservas (GA4 + Meta Pixel). Los IDs son DEL
// HOTEL (extras.medicion), no de Kora: cada hotel mide su propio embudo.
// Todo es best-effort: si no hay scripts cargados, no hace nada ni truena.

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    fbq?: Fbq;
    dataLayer?: unknown[];
  }
}

export interface MotorItem {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
}

function gtagSafe(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    try {
      window.gtag(...args);
    } catch {
      /* nunca romper el motor por medición */
    }
  }
}

function fbqSafe(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq(...args);
    } catch {
      /* idem */
    }
  }
}

/** El huésped vio la lista de habitaciones con precios reales (tras buscar). */
export function trackViewItems(items: MotorItem[], value: number) {
  gtagSafe("event", "view_item", {
    currency: "MXN",
    value,
    items,
  });
  fbqSafe("track", "ViewContent", {
    content_type: "hotel_room",
    content_ids: items.map((i) => i.item_id),
    currency: "MXN",
    value,
  });
}

/** Entró al paso de datos con carrito armado. */
export function trackBeginCheckout(items: MotorItem[], value: number) {
  gtagSafe("event", "begin_checkout", { currency: "MXN", value, items });
  fbqSafe("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.item_id),
    currency: "MXN",
    value,
    num_items: items.length,
  });
}

/** Llegó al paso de pago (aceptó datos). */
export function trackAddPaymentInfo(items: MotorItem[], value: number) {
  gtagSafe("event", "add_payment_info", { currency: "MXN", value, items });
  fbqSafe("track", "AddPaymentInfo", { currency: "MXN", value });
}

/** Reserva pagada (página de confirmación). `txId` deduplica (folio o session). */
export function trackPurchase(txId: string, value: number, items: MotorItem[]) {
  gtagSafe("event", "purchase", {
    transaction_id: txId,
    currency: "MXN",
    value,
    items,
  });
  fbqSafe("track", "Purchase", { currency: "MXN", value, content_ids: items.map((i) => i.item_id) });
}
