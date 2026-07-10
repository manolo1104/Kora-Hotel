// Disparo de eventos de lead para GA4 (y, opcionalmente, conversión directa de
// Google Ads). La etiqueta base (gtag.js con NEXT_PUBLIC_GA_ID) se carga en
// app/layout.tsx; aquí solo enviamos los eventos.

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

// Marca un lead. method = cómo se generó (formulario o WhatsApp).
export function trackLead(method: "form" | "whatsapp") {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  // Evento estándar de GA4. En Google Ads se importa "generate_lead" como conversión.
  window.gtag("event", "generate_lead", {
    method,
    currency: "MXN",
    value: 0,
  });

  // Conversión directa de Google Ads (opcional): solo si está configurado el
  // send_to "AW-XXXXXXXXXX/etiqueta" en la variable de entorno.
  const adsSendTo = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION;
  if (adsSendTo) {
    window.gtag("event", "conversion", {
      send_to: adsSendTo,
      value: 1.0,
      currency: "MXN",
    });
  }
}

// Clic en un CTA secundario (no es conversión, solo medición de interacción).
export function trackCta(name: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "cta_click", { cta_name: name });
}

// Inicio de checkout de la suscripción (evento estándar de GA4). Se dispara en
// /pago/iniciar: el punto único por el que pasa todo intento de pago, venga del
// CTA que venga.
export function trackBeginCheckout(plan: string, value: number) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "begin_checkout", {
    currency: "MXN",
    value,
    items: [{ item_id: plan, item_name: `Plan ${plan}` }],
  });
}
