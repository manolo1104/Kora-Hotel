// El link de pago no lo escribe el modelo. Lo pega el código.
//
// El 8 de septiembre de 2026 un huésped del Hotel San Luis mandó la captura:
// «The link is incomplete. Use the unmodified URL or ask the business for a new
// one». No había expirado — le llegó ROTA.
//
// Dos causas, las dos reales, y las dos con la misma raíz: hacíamos que el
// modelo copiara a mano una URL de Stripe de ~700 caracteres, llena de `#`,
// `%2F` y base64.
//
//  1. Un modelo copiando 700 caracteres se equivoca. El prompt decía «manda el
//     campo url TAL CUAL», que es pedirle que no falle, no impedírselo.
//  2. El tope de respuesta son 1024 tokens y NADIE miraba `stop_reason`. Una URL
//     de 700 caracteres son cientos de tokens: si el modelo escribía el resumen
//     y luego el link, la respuesta se cortaba a media URL y se mandaba igual.
//
// La solución no es pedírselo mejor. Es que el modelo no lo escriba: se quita
// del texto cualquier URL de Stripe que haya intentado copiar —esté bien o mal—
// y se pega la de verdad, tal cual salió de la herramienta.

/** Cualquier URL de checkout de Stripe, entera o partida a la mitad. */
const URL_STRIPE = /https?:\/\/checkout\.stripe\.com\/\S*/gi;

/**
 * Deja el mensaje del huésped con el link de pago BUENO y sólo ese.
 *
 * OJO: sólo toca las de `checkout.stripe.com`. El link del motor de reservas
 * (`/h/<hotel>/reservar?...`) es corto, lo manda Camila a propósito en otros
 * casos, y ése sí puede escribirlo sin romperlo.
 *
 * @param {string} respuesta lo que escribió el modelo
 * @param {string} urlDePago la URL que devolvió la herramienta `reservar`
 * @returns {string}
 */
export function conLinkDePago(respuesta, urlDePago) {
  const texto = String(respuesta || "");
  const url = String(urlDePago || "").trim();
  if (!url) return texto.trim();

  const limpio = texto
    .replace(URL_STRIPE, "")
    // La URL solía ir sola en su renglón; al quitarla quedaban huecos.
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Si el modelo sólo había escrito el link, el mensaje es el link.
  return limpio ? `${limpio}\n\n${url}` : url;
}

/**
 * ¿La respuesta se cortó por el tope de tokens?
 *
 * No se usaba para nada, y por eso un mensaje truncado salía hacia el huésped
 * como si estuviera completo.
 */
export function seCorto(stopReason) {
  return stopReason === "max_tokens";
}
