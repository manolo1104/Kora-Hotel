// Fuente única de las direcciones de contacto de Kora.
//
// 🔴 POR QUÉ EXISTE ESTE ARCHIVO. Hasta el 1 sep 2026 el correo de contacto
// estaba escrito a mano en 18 sitios y con DOS dominios distintos:
//
//   • `hola@kora-hotel.com`      — 9 sitios, el dominio real
//   • `hola@korahotel.mx`        — 6 sitios (Términos, footer, y el `email` y el
//                                  `contactPoint` del Organization JSON-LD)
//   • `privacidad@korahotel.mx`  — 4 sitios (el Aviso de Privacidad entero)
//
// `korahotel.mx` NO ESTÁ REGISTRADO: no tiene NS, ni A, ni MX (comprobado el
// 1 sep 2026 contra 8.8.8.8 y 1.1.1.1). Los diez correos publicados ahí —en los
// dos documentos legales del sitio y en los datos estructurados que lee Google—
// iban a un dominio de nadie.
//
// ⚠️ FALTA UNA COSA QUE NO ES CÓDIGO: `kora-hotel.com` TAMPOCO RECIBE CORREO.
// El dominio manda bien (Resend/SES está montado en `send.kora-hotel.com`, con
// su SPF y su DKIM), pero el apex no tiene registro MX. Sin MX, el correo cae
// al registro A —76.76.21.21, que es Vercel— y ahí el puerto 25 está cerrado:
// rebota. Hasta que Manolo añada un MX en el DNS de Vercel, escribir a esta
// dirección no le llega a nadie. Ver [[ref_kora_dominio_dns]].
//
// 🔴 HAY UNA SOLA DIRECCIÓN, Y ES DELIBERADO. Decisión de Manolo (1 sep 2026):
// «sólo deja un solo correo, el que ya está». Antes había tres —`hola@`,
// `privacidad@` (en el Aviso de Privacidad) y `reservas@` (remitente de las
// confirmaciones al huésped)— y sólo la primera existe de verdad en Resend.
// Publicar direcciones que nadie atiende es cómo se llegó a `korahotel.mx`.
// Con una sola, es una sola la que hay que hacer funcionar.
export const EMAIL_CONTACTO = "hola@kora-hotel.com";

// El remitente de los correos automáticos. Se puede sobreescribir con
// RESEND_FROM; esto es sólo el respaldo para que ningún envío se quede sin
// remitente si falta la variable.
export const EMAIL_FROM = `Kora <${EMAIL_CONTACTO}>`;


// ─── WhatsApp ────────────────────────────────────────────────────────────────
//
// 🔴 Mismo problema que el correo, con otra cara. El número estaba escrito a
// mano en TRECE archivos, con el `524891251458` metido dentro de cada uno como
// respaldo. Y había DOS variables para lo mismo:
//
//   • NEXT_PUBLIC_WHATSAPP_NUMBER — sí está en Vercel producción
//   • NEXT_PUBLIC_WHATSAPP_KORA   — NO está en Vercel producción
//
// `app/panel/[slug]/error.tsx` encadenaba las dos y por eso funcionaba. Los
// otros dos sitios que usaban KORA no encadenaban nada, y con la variable
// ausente quedaban así (comprobado el 1 sep 2026 con `vercel env ls production`):
//
//   • components/panel/SuscripcionCard.tsx — el botón «Escríbenos por WhatsApp»
//     está detrás de `atascado && WA_KORA`, así que NUNCA APARECE. Justo el
//     hotelero cuyo pago se atoró se queda sin manera de avisar.
//   • lib/email/templates.ts — degradaba a un botón a /contacto, así que no se
//     rompía; pero el correo dice "te escribo por WhatsApp" y el botón llevaba
//     a la web.
export const WHATSAPP =
  process.env.NEXT_PUBLIC_WHATSAPP_KORA ||
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
  "524891251458";

/** Enlace de WhatsApp con mensaje ya escrito. Devuelve "" si no hay número. */
export function waLink(texto: string): string {
  const n = WHATSAPP.replace(/\D/g, "");
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : "";
}
