/**
 * blog-agent/oferta.js
 * ─────────────────────────────────────────────────────────
 * Las cifras comerciales que el agente pone en la boca del modelo (precio,
 * días de prueba y la ruta del registro), leídas de la fuente única del sitio:
 * `lib/oferta.ts`.
 *
 * 🔴 POR QUÉ EXISTE. Hasta el 15 sep 2026 el prompt del agente decía, escrito a
 * mano, «prueba de 30 días sin tarjeta» y cerraba cada artículo con un enlace a
 * `/#contacto`. La prueba había bajado a 14 días el 6 sep y nadie tocó este
 * archivo: el agente siguió publicando cada 3 días artículos que prometían 30.
 * Es el mismo defecto de siempre —una cifra copiada a mano en un sitio que nadie
 * mira— y se arregla igual: leyendo la constante.
 *
 * El agente es JavaScript suelto (corre con `node index.js` en GitHub Actions,
 * con el repo entero descargado) y no puede importar TypeScript con los alias
 * `@/`. Por eso lee `lib/oferta.ts` como TEXTO y saca los valores con
 * expresiones regulares. Si alguna no encaja —porque alguien renombró la
 * constante o cambió su forma— NO se inventa un valor por defecto: se lanza un
 * error y ese día no se publica. Un artículo menos es barato; un artículo que
 * promete lo que el sistema no da, no.
 *
 * `tests/sitio-registro-ctas.test.ts` («el agente del blog lee la oferta de la
 * fuente única») comprueba que estas expresiones sacan exactamente lo que
 * `lib/oferta.ts` exporta, así que renombrar la constante rompe la prueba antes
 * de romper el agente.
 */

import { readFileSync } from "node:fs";

const PATRONES = {
  precio: /export const PRECIO_DESDE\s*=\s*(\d+)\s*;/,
  diasPrueba: /\bdiasPrueba\s*:\s*(\d+)\s*,/,
  rutaRegistro: /export const RUTA_REGISTRO\s*=\s*"([^"]+)"\s*;/,
};

/**
 * Saca la oferta del texto de `lib/oferta.ts`. Pura: no lee disco.
 * @param {string} texto
 * @returns {{ precio: number, diasPrueba: number, rutaRegistro: string }}
 */
export function leerOferta(texto) {
  const faltan = [];
  const sacar = (clave) => {
    const m = String(texto ?? "").match(PATRONES[clave]);
    if (!m) faltan.push(clave);
    return m ? m[1] : "";
  };
  const precio = Number(sacar("precio"));
  const diasPrueba = Number(sacar("diasPrueba"));
  const rutaRegistro = sacar("rutaRegistro");

  if (faltan.length > 0) {
    throw new Error(
      `No pude leer ${faltan.join(", ")} de lib/oferta.ts. ` +
        "¿Cambió el nombre o la forma de la constante? Ajusta blog-agent/oferta.js.",
    );
  }
  if (!(precio > 0) || !(diasPrueba > 0) || !rutaRegistro.startsWith("/")) {
    throw new Error(
      `Valores raros en lib/oferta.ts (precio ${precio}, días ${diasPrueba}, ruta ${rutaRegistro}).`,
    );
  }
  return { precio, diasPrueba, rutaRegistro };
}

/** Lee `lib/oferta.ts` del repo (la carpeta de arriba de blog-agent). */
export function ofertaDelRepo() {
  const texto = readFileSync(new URL("../lib/oferta.ts", import.meta.url), "utf8");
  return leerOferta(texto);
}
