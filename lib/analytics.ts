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
    window.gtag("event", "conversion", { send_to: adsSendTo });
  }
}
