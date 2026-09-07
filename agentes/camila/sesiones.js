// ¿A este hotel hay que abrirle un navegador al arrancar?
//
// Es la pregunta más cara del servicio. Hasta el 6 de septiembre de 2026 se le
// abría uno a TODOS los hoteles elegibles, incluidos los que nadie ha escaneado
// nunca — que se quedaban meses con un Chromium vivo regenerando un código QR
// cada veinte segundos, para nadie. Ese día eso dejó sin bot al hotel del
// cliente que paga: era el último de la lista, y cuando le tocaba arrancar el
// contenedor ya tenía cuatro navegadores dentro de hoteles que no usa nadie.
//
// Aquí viven las dos señales que responden a la pregunta, y ninguna de las dos
// es obvia.

import { existsSync, readdirSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * `true` si el hotel tiene algo guardado de una sesión de WhatsApp.
 *
 * OJO CON ESTO: **no** distingue un hotel vinculado de uno que nunca escaneó.
 * `LocalAuth` crea `session-<clientId>` en cuanto ARRANCA Chromium, no cuando
 * alguien escanea, así que devuelve `true` para casi todos. Se probó como
 * detector de "ya vinculado" y no servía: se desplegó y no liberó ni un
 * navegador. Sirve sólo para lo que dice — saber si este hotel ha arrancado
 * alguna vez — y quien decide de verdad es `marcadoSinVincular`.
 *
 * Ante la duda dice que SÍ: equivocarse por exceso cuesta un Chromium de más;
 * por defecto, deja mudo a un hotel que ya estaba conectado.
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

// ─── La marca de «a éste no lo ha vinculado nadie» ───────────────────────────
//
// Soltar el navegador de un hotel que enseña un QR que nadie mira funcionaba…
// hasta el siguiente reinicio. El estado vivía sólo en memoria, así que en CADA
// despliegue los hoteles sin vincular se levantaban otra vez todos a la vez, se
// comían el contenedor, y había que esperar de nuevo a que se soltaran. Justo la
// tormenta que veníamos a quitar. Ahora la decisión va al disco, junto a la
// sesión, y sobrevive.
//
// LA MARCA VA EN NEGATIVO —«éste no»— Y ESO IMPORTA. Lo natural sería marcar a
// los vinculados, pero entonces el primer arranque tras este cambio dejaría sin
// levantar a los hoteles que YA están conectados, porque todavía no tendrían su
// marca, y nadie los levantaría hasta que alguien abriera su panel. En negativo,
// quien nunca ha sido liberado se comporta exactamente como antes: arranca.

const MARCA = ".kora-sin-vincular";

function rutaMarca(dataPath, id) {
  return path.join(dataPath, `session-${id}`, MARCA);
}

/** `true` si a este hotel se le soltó el navegador por no escanear. */
export function marcadoSinVincular(dataPath, id) {
  if (!dataPath || !id) return false;
  try {
    return existsSync(rutaMarca(dataPath, id));
  } catch {
    // Ante la duda, que arranque: es el lado barato de equivocarse.
    return false;
  }
}

/** Deja constancia de que nadie escaneó, para que el reinicio lo respete. */
export function marcarSinVincular(dataPath, id) {
  if (!dataPath || !id) return;
  try {
    mkdirSync(path.join(dataPath, `session-${id}`), { recursive: true });
    writeFileSync(rutaMarca(dataPath, id), new Date().toISOString());
  } catch (e) {
    console.error(`[camila] no pude marcar ${id} como sin vincular:`, e && e.message);
  }
}

/**
 * Se llama al CONECTAR. A partir de ahí el hotel vuelve a arrancar solo en cada
 * reinicio, que es lo que se espera de uno que ya está vinculado.
 */
export function limpiarMarcaSinVincular(dataPath, id) {
  if (!dataPath || !id) return;
  try {
    rmSync(rutaMarca(dataPath, id), { force: true });
  } catch (e) {
    // Si no se pudo borrar, el hotel arrancaría a mano la próxima vez. Se dice.
    console.error(`[camila] no pude quitar la marca de ${id}:`, e && e.message);
  }
}
