// Qué hacer cuando el huésped manda algo que no es texto.
//
// Hasta hoy: nada. `onMensaje` hacía `if (msg.type !== "chat") return;` y ahí
// se acababa. En el primer hotel conectado de verdad eso salió caro: de siete
// mensajes de huéspedes, TRES no eran texto —dos respuestas a botones y una
// tarjeta de contacto— y Camila los dejó en visto. Sin decir «no puedo verlo»,
// sin pasar a una persona, sin nada. Desde el otro lado eso no parece un bot
// limitado: parece un bot roto.
//
// Los tipos salen de `whatsapp-web.js/src/util/Constants.js`, no de memoria.
//
// Tres decisiones, y la del medio es la que más cambia la conversación:
//
//  - `texto`: es texto, o trae texto aprovechable (el pie de una foto, la
//    opción que el huésped tocó en un botón). Se trata como cualquier mensaje.
//  - `sin-soporte`: el huésped dijo algo de verdad y no lo podemos leer. Se le
//    contesta con honestidad y se le ofrece una salida.
//  - `ignorar`: ruido del propio WhatsApp (avisos de cifrado, entradas de
//    grupo, reacciones, registros de llamada). Contestar aquí sería absurdo.

/** Tipos que traen texto en el cuerpo, o que PUEDEN traerlo. */
const CON_TEXTO = new Set([
  "chat",
  // El huésped tocó un botón o eligió de una lista: la opción viene en el
  // cuerpo. Ignorarlas era lo peor de todo, porque son respuestas DIRIGIDAS a
  // algo que preguntamos nosotros.
  "interactive",
  "buttons_response",
  "list_response",
  "template_button_reply",
  "native_flow",
]);

/** Los que pueden traer un pie de foto; si lo traen, vale como mensaje. */
const CON_PIE = new Set(["image", "video", "document", "album"]);

/** Ruido del sistema: nunca lo escribió una persona. */
const RUIDO = new Set([
  "e2e_notification",
  "notification",
  "notification_template",
  "group_notification",
  "groups_v4_invite",
  "gp2",
  "call_log",
  "broadcast_notification",
  "ciphertext",
  "debug",
  "protocol",
  "reaction",
  "revoked",
  "unknown",
  "payment",
  "order",
  "product",
  "poll_creation",
  "scheduled_event_creation",
]);

/**
 * @param {string} tipo `msg.type`
 * @param {string} cuerpo `msg.body`
 * @returns {"texto"|"sin-soporte"|"ignorar"}
 */
export function clasificar(tipo, cuerpo = "") {
  const t = String(tipo || "").trim();
  const hayTexto = String(cuerpo || "").trim().length > 0;
  if (CON_TEXTO.has(t)) return hayTexto ? "texto" : "ignorar";
  if (RUIDO.has(t)) return "ignorar";
  // Una foto con pie de foto ES un mensaje: el huésped escribió algo.
  if (CON_PIE.has(t) && hayTexto) return "texto";
  return "sin-soporte";
}

/**
 * Cómo se lo llama AL HUÉSPED, hablándole de tú. Es la mitad de que el aviso no
 * suene a máquina: «me llegó tu nota de voz» y no «se recibió un archivo de
 * audio».
 */
const NOMBRE = {
  ptt: "tu nota de voz",
  audio: "tu audio",
  image: "tu foto",
  album: "tus fotos",
  video: "tu video",
  sticker: "tu sticker",
  document: "tu archivo",
  location: "tu ubicación",
  vcard: "el contacto que me pasaste",
  multi_vcard: "los contactos que me pasaste",
};

/**
 * Y cómo se lo llama EN LA BANDEJA, donde se habla del huésped en tercera
 * persona. Con los nombres de arriba salía «el huésped mandó TU nota de voz».
 */
const NOMBRE_PANEL = {
  ptt: "una nota de voz",
  audio: "un audio",
  image: "una foto",
  album: "varias fotos",
  video: "un video",
  sticker: "un sticker",
  document: "un archivo",
  location: "su ubicación",
  vcard: "un contacto",
  multi_vcard: "varios contactos",
};

/** Lo que se guarda en el hilo para que el hotelero VEA que llegó algo. */
export function comoSeVeEnElPanel(tipo) {
  const n = NOMBRE_PANEL[tipo];
  return n ? `[el huésped mandó ${n}]` : `[el huésped mandó algo que no es texto (${tipo})]`;
}

/**
 * Lo que Camila contesta cuando no puede leer lo que le mandaron.
 *
 * Dice tres cosas y en este orden: que SÍ le llegó (que no se sienta ignorado),
 * qué no puede hacer con ello, y por dónde seguir. Sin disculpas largas y sin
 * prometer que «lo revisará luego», que sería mentira.
 *
 * A propósito NO lleva número de escalada. Decidir a qué número mandar al
 * huésped tiene una trampa que ya costó un fallo: si el hotel no configuró uno
 * distinto, se acaba mandando al huésped al MISMO WhatsApp desde el que le
 * estamos escribiendo. Esa lógica vive en `lib/bot/prompt.ts` y no se duplica
 * aquí: se le pide que lo cuente por escrito, y a partir de ahí Camila escala
 * como escala siempre.
 *
 * @param {string} tipo
 */
export function respuestaSinSoporte(tipo) {
  const que = NOMBRE[tipo] || "lo que me mandaste";
  const noPuedo =
    tipo === "ptt" || tipo === "audio"
      ? "todavía no puedo escuchar audios"
      : tipo === "location"
        ? "todavía no puedo abrir ubicaciones"
        : tipo === "vcard" || tipo === "multi_vcard"
          ? "todavía no puedo abrir contactos"
          : tipo === "document"
            ? "todavía no puedo abrir archivos"
            : "todavía no puedo ver imágenes ni videos";

  return (
    `Me llegó ${que}, pero ${noPuedo} 🙏\n\n` +
    "¿Me lo cuentas por escrito? Si es algo que necesita a una persona del hotel, dímelo y les aviso."
  );
}
