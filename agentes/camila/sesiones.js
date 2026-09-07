// ¿Este hotel YA vinculó su WhatsApp alguna vez?
//
// Es la pregunta que decide si el runtime le abre un Chromium al arrancar. Y
// resulta que es la pregunta más cara del servicio: hasta ahora se le abría uno
// a TODOS los hoteles elegibles, incluidos los que nadie ha escaneado nunca —
// que se quedaban meses con un navegador vivo regenerando un código QR cada
// veinte segundos, para nadie.
//
// El 6 de septiembre de 2026 eso dejó sin bot al hotel del cliente que paga: era
// el último de la lista y para cuando le tocaba arrancar, el contenedor ya tenía
// cuatro Chromium dentro de hoteles que no usa nadie.
//
// La respuesta está en el disco: `LocalAuth` de whatsapp-web.js guarda la sesión
// en `session-<clientId>`, y el clientId es el uuid del hotel. Si esa carpeta
// existe y tiene algo dentro, alguien escaneó. Si no, no.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * `true` si el hotel tiene una sesión de WhatsApp guardada en disco.
 *
 * Ante la duda dice que SÍ: equivocarse por exceso sólo cuesta un Chromium de
 * más, y equivocarse por defecto deja a un hotel que ya estaba conectado sin
 * arrancar y sin manera de darse cuenta.
 *
 * @param {string} dataPath carpeta base (`WWEBJS_DATA_PATH`)
 * @param {string} id uuid del hotel (el `clientId` de LocalAuth)
 * @returns {boolean}
 */
export function tieneSesion(dataPath, id) {
  if (!dataPath || !id) return true;
  try {
    const dir = path.join(dataPath, `session-${id}`);
    if (!existsSync(dir)) return false;
    // Una carpeta vacía es lo que deja un escaneo que no llegó a completarse.
    return readdirSync(dir).length > 0;
  } catch {
    return true;
  }
}
