// Convertir el historial GUARDADO en mensajes para el modelo.
//
// Vive aparte de `index.js` porque `index.js` arranca un Chromium por hotel en
// cuanto se importa: nada de lo que estaba dentro se podía probar. Y esto hay
// que probarlo — la regla de que una conversación tiene que empezar por el
// huésped no se ve al leer el código, se ve cuando la API devuelve un 400 y
// Camila deja de contestarle a alguien que iba a reservar.

/**
 * Turnos guardados → mensajes para el modelo.
 *
 * Lo que escribió una PERSONA del hotel (`por:"hotel"`) entra como `assistant`
 * igual que lo de Camila, y a propósito: si entrara como otra cosa —o se
 * descartara— Camila retomaría la conversación contradiciendo lo que el
 * hotelero acaba de prometerle al huésped. Se marca en el texto para que el
 * modelo sepa que ahí habló una persona y no repita la pregunta.
 *
 * @param {Array<{rol?:string, texto?:string, por?:string}>} turnos
 * @returns {Array<{role:"user"|"assistant", content:string}>}
 */
export function aMensajes(turnos) {
  /** @type {Array<{role:"user"|"assistant", content:string}>} */
  const mensajes = [];
  for (const t of Array.isArray(turnos) ? turnos : []) {
    if (!t || typeof t.texto !== "string" || !t.texto.trim()) continue;
    const role = t.rol === "user" ? "user" : "assistant";
    // El historial tiene que ARRANCAR en un mensaje del huésped: la API rechaza
    // una conversación que empieza con el asistente hablando solo, y eso pasa en
    // cuanto el hotelero es el primero en escribir desde el panel.
    if (mensajes.length === 0 && role !== "user") continue;
    const content = role === "assistant" && t.por === "hotel" ? `(respondió el hotel) ${t.texto}` : t.texto;
    mensajes.push({ role, content });
  }
  return mensajes;
}
