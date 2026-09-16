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
/**
 * `method` viaja a GA4 y sirve para saber QUÉ canal convierte. "herramienta" se
 * añadió al cablear las 18 herramientas gratis, que hasta ahora no reportaban
 * ninguna conversión (K-40): mezclarlas con "form" habría escondido justo el
 * dato por el que se cablearon.
 */
export function trackLead(method: "form" | "whatsapp" | "herramienta") {
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

/**
 * Alta en la lista de correo. NO es `generate_lead`: un suscriptor dejó sólo su
 * correo por una guía, no pidió que le hablen. Mezclarlos en GA4 inflaría las
 * conversiones y Google Ads optimizaría hacia el evento barato, dejando de
 * traer a los que sí dan su WhatsApp.
 *
 * `origen` responde la única pregunta que importa aquí: qué superficie capta
 * (popup, footer, artículo, herramienta, la página de la guía).
 */
export function trackSuscripcion(origen: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  // 🔴 SE LLAMABA `sign_up`, que en GA4 es el evento estándar de «se creó una
  // cuenta». Con ese nombre, los suscriptores de la guía (7 en 30 días) se
  // contaban como hoteles registrados, y era el único dato del panel capaz de
  // mentir en la dirección que más ilusión hace. El alta de cuenta de verdad es
  // `registro_cuenta`, abajo.
  window.gtag("event", "suscripcion_guia", { method: "guia", origen });
}

/**
 * Se creó una cuenta de Kora. Es el evento que faltaba: hasta el 15 sep 2026
 * `supabase.auth.signUp()` no disparaba NADA, así que no se podía responder «¿de
 * dónde salieron los registros?» — ni para Google, ni para un artículo, ni para
 * una campaña. Sin esto, toda la estrategia de captación se dirige a ciegas.
 *
 * `estado` distingue los dos finales posibles del alta, porque no son lo mismo:
 * `sesion` = entró directo; `pendiente` = le toca confirmar su correo (y ahí se
 * pierde gente, sobre todo con el tope de 2 correos por hora de Supabase).
 */
export function trackRegistro(estado: "sesion" | "pendiente") {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "registro_cuenta", { method: "correo", estado });
}
