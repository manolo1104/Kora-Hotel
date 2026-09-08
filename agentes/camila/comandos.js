// Los comandos con los que el hotelero maneja a Camila desde su WhatsApp.
//
// Vive aparte de `index.js` para poder probarlo: `index.js` abre navegadores en
// cuanto se importa, así que esto nunca había entrado en una prueba — y son las
// órdenes que apagan el bot de un hotel entero.
//
// La regla de diseño: un comando se reconoce SÓLO si el mensaje es
// esencialmente la orden. El dueño escribe por este mismo chat como cualquiera,
// y "oye, hay que pausar las reservas del sábado" no puede apagarle a Camila.

export function soloDigitos(s) {
  return String(s || "").replace(/\D/g, "");
}

/**
 * ¿Este chat es el número que el hotel autorizó para dar órdenes?
 *
 * Compara los últimos 10 dígitos, para tolerar la lada (52 / 521 en México).
 *
 * EXIGE 10 DÍGITOS EN LOS DOS LADOS. Antes sólo se los exigía al número
 * autorizado: con `Math.min(10, a.length, b.length)`, un remitente de cuatro
 * dígitos que casaran con el final del número del dueño —los códigos cortos de
 * servicio existen en WhatsApp— comparaba sólo esos cuatro y podía apagarle el
 * bot al hotel.
 *
 * LIMITACIÓN CONOCIDA: WhatsApp usa `@lid` en cuentas nuevas, y un `@lid` NO es
 * un teléfono: es un identificador opaco. Si el dueño escribe desde un chat
 * `@lid`, esto no lo va a reconocer y sus comandos no harán nada. Es preferible
 * a lo contrario —darle el mando a quien no es— pero hay que decírselo en el
 * panel en vez de dejarle creer que escribió mal.
 */
export function mismoNumero(chatId, adminPhone) {
  const a = soloDigitos(String(chatId).split("@")[0]);
  const b = soloDigitos(adminPhone);
  if (a.length < 10 || b.length < 10) return false;
  return a.slice(-10) === b.slice(-10);
}

/** Las palabras que entiende cada orden. Es también lo que se documenta. */
export const COMANDOS = {
  off: ["apagar", "apaga", "apagate", "pausar", "pausa", "off", "desactivar", "detente", "detener", "silencio"],
  on: ["encender", "enciende", "prender", "prende", "activar", "activa", "on", "reanudar", "reanuda", "despierta"],
  estado: ["estado", "status", "como vas", "que onda"],
  ayuda: ["ayuda", "comandos", "help", "menu"],
};

/**
 * Reconoce una orden. `null` si el mensaje es conversación normal.
 *
 * Acepta "camila" delante y se traga acentos y signos finales, porque nadie
 * escribe "apagate" sin acento a propósito.
 */
export function parseComando(texto) {
  let t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  t = t
    // Los signos van a los DOS lados: en español el «¿» abre. Antes sólo se
    // quitaban los del final, así que «¿apagar?» no se reconocía como orden y
    // Camila le contestaba al dueño como si fuera un huésped preguntando.
    .replace(/^[¡¿.!?\s]+/, "")
    .replace(/^camila[\s,:-]*/, "")
    .replace(/[.!¡¿?\s]+$/g, "")
    .trim();
  for (const [orden, palabras] of Object.entries(COMANDOS)) {
    if (palabras.includes(t)) return orden;
  }
  return null;
}

/** El texto que Camila contesta a "ayuda". Es la chuleta del hotelero. */
export function textoAyuda(nombreBot = "Camila") {
  return (
    `Estos son los comandos que puedes mandarme desde este número 👇\n\n` +
    `*apagar* — dejo de contestarle a tus huéspedes\n` +
    `*encender* — vuelvo a contestar\n` +
    `*estado* — te digo si estoy encendida o apagada\n` +
    `*ayuda* — este mensaje\n\n` +
    `Sólo funcionan desde el número que diste de alta en el panel, y sólo si el ` +
    `mensaje es la palabra sola. Así no te apago a ${nombreBot} sin querer por ` +
    `escribir "hay que pausar las reservas del sábado" 🙂`
  );
}
