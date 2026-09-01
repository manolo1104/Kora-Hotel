// Generador mínimo de archivos .xlsx, sin dependencias.
//
// Por qué a mano y no con una librería: el hotelero necesita UN archivo que
// abra en Excel con sus reservas, sus huéspedes y sus cotizaciones en hojas
// separadas. Un CSV no tiene hojas, y las librerías de Excel pesan entre 7 y 20
// MB dentro de una función serverless que en Vercel Hobby se corta a los 60 s.
// Un .xlsx es un ZIP con cinco XML dentro; el subconjunto que Excel necesita
// para abrir una tabla cabe en este archivo.
//
// Lo que soporta a propósito: varias hojas, encabezado en negrita y congelado,
// filtros, ancho de columna y números de verdad (no texto que parece número).
// Lo que NO soporta: fórmulas, formato condicional, colores por celda, fechas
// como tipo Excel. Las fechas van como texto ISO porque es lo que hay en la
// base y porque `2026-08-31` no se le desordena a nadie al abrirlo.

import { deflateRawSync } from "node:zlib";

export type Celda = string | number | null | undefined;

export interface Hoja {
  /** Nombre de la pestaña. Excel corta a 31 caracteres y prohíbe : \ / ? * [ ] */
  nombre: string;
  /** Encabezados de columna. Salen en negrita, congelados y con filtro. */
  encabezados: string[];
  /** Una fila por elemento; cada fila alineada con `encabezados`. */
  filas: Celda[][];
  /** Ancho de cada columna en caracteres. Por defecto, 18. */
  anchos?: number[];
}

// ─── XML ──────────────────────────────────────────────────────────────────────

// Excel RECHAZA EL ARCHIVO ENTERO si una celda trae un carácter de control, y
// las notas de un hotelero llegan con lo que haya pegado del WhatsApp. Se
// quitan todos salvo tabulación (09), salto de línea (0A) y retorno (0D).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

const esc = (v: string): string =>
  v
    .replace(CONTROL, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 1 → "A", 27 → "AA". */
export function columna(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const esNumero = (v: Celda): v is number =>
  typeof v === "number" && Number.isFinite(v);

function celdaXml(ref: string, v: Celda, estilo: number): string {
  if (v === null || v === undefined || v === "") return "";
  if (esNumero(v)) return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
  // `t="inlineStr"` evita tener que mantener un sharedStrings.xml aparte.
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function hojaXml(hoja: Hoja): string {
  const nCols = hoja.encabezados.length;
  const cols = Array.from({ length: nCols }, (_, i) => {
    const ancho = hoja.anchos?.[i] ?? 18;
    return `<col min="${i + 1}" max="${i + 1}" width="${ancho}" customWidth="1"/>`;
  }).join("");

  const encabezado =
    `<row r="1">` +
    hoja.encabezados
      .map((h, i) => celdaXml(`${columna(i + 1)}1`, h, 1))
      .join("") +
    `</row>`;

  const cuerpo = hoja.filas
    .map((fila, f) => {
      const r = f + 2;
      const celdas = Array.from({ length: nCols }, (_, i) =>
        celdaXml(`${columna(i + 1)}${r}`, fila[i], esNumero(fila[i]) ? 2 : 0)
      ).join("");
      return `<row r="${r}">${celdas}</row>`;
    })
    .join("");

  const ultima = `${columna(nCols)}${hoja.filas.length + 1}`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // Congelar el encabezado: con 300 reservas, sin esto no se sabe qué columna
    // se está mirando en cuanto uno baja.
    `<sheetViews><sheetView workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` +
    `</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${encabezado}${cuerpo}</sheetData>` +
    `<autoFilter ref="A1:${ultima}"/>` +
    `</worksheet>`
  );
}

/** Excel prohíbe : \ / ? * [ ] en el nombre de una pestaña, y la corta a 31. */
const nombreHoja = (n: string): string =>
  esc(n.replace(/[:\\/?*[\]]/g, " ").slice(0, 31)) || "Hoja";

// ─── ZIP ──────────────────────────────────────────────────────────────────────

const TABLA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

interface Entrada {
  nombre: string;
  crudo: Buffer;
  comprimido: Buffer;
  crc: number;
}

/**
 * ZIP con deflate (método 8), sin descriptor de datos: se conocen todos los
 * tamaños antes de escribir porque todo está en memoria. Fechas fijas
 * (1980-01-01) a propósito: el mismo contenido produce el mismo byte, así que
 * la salida es comprobable en una prueba.
 */
function zip(entradas: { nombre: string; contenido: string }[]): Buffer {
  const items: Entrada[] = entradas.map((e) => {
    const crudo = Buffer.from(e.contenido, "utf8");
    return { nombre: e.nombre, crudo, comprimido: deflateRawSync(crudo), crc: crc32(crudo) };
  });

  const locales: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const it of items) {
    const nombre = Buffer.from(it.nombre, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // firma de cabecera local
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0, 6); // banderas
    local.writeUInt16LE(8, 8); // método: deflate
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(33, 12); // fecha: 1980-01-01
    local.writeUInt32LE(it.crc, 14);
    local.writeUInt32LE(it.comprimido.length, 18);
    local.writeUInt32LE(it.crudo.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28); // campo extra
    locales.push(local, nombre, it.comprimido);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // firma de directorio central
    dir.writeUInt16LE(20, 4); // versión que lo creó
    dir.writeUInt16LE(20, 6); // versión necesaria
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(33, 14);
    dir.writeUInt32LE(it.crc, 16);
    dir.writeUInt32LE(it.comprimido.length, 20);
    dir.writeUInt32LE(it.crudo.length, 24);
    dir.writeUInt16LE(nombre.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comentario
    dir.writeUInt16LE(0, 34); // disco
    dir.writeUInt16LE(0, 36); // atributos internos
    dir.writeUInt32LE(0, 38); // atributos externos
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nombre);

    offset += 30 + nombre.length + it.comprimido.length;
  }

  const cuerpoCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); // fin del directorio central
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(items.length, 8);
  fin.writeUInt16LE(items.length, 10);
  fin.writeUInt32LE(cuerpoCentral.length, 12);
  fin.writeUInt32LE(offset, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...locales, cuerpoCentral, fin]);
}

// ─── Armado del libro ─────────────────────────────────────────────────────────

/** Devuelve el .xlsx completo. Una hoja por elemento de `hojas`, en ese orden. */
export function construirXlsx(hojas: Hoja[]): Buffer {
  if (hojas.length === 0) throw new Error("Un libro necesita al menos una hoja");

  const ids = hojas.map((_, i) => i + 1);

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    ids
      .map(
        (i) =>
          `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    hojas
      .map(
        (h, i) =>
          `<sheet name="${nombreHoja(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
      )
      .join("") +
    `</sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    ids
      .map(
        (i) =>
          `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`
      )
      .join("") +
    `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  // Tres estilos: 0 = texto normal, 1 = encabezado (negrita verde sobre gris
  // claro), 2 = número con separador de miles y dos decimales.
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>` +
    `<fonts count="2">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FF1B4332"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFEAF2EC"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="3">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  return zip([
    { nombre: "[Content_Types].xml", contenido: contentTypes },
    { nombre: "_rels/.rels", contenido: rels },
    { nombre: "xl/workbook.xml", contenido: workbook },
    { nombre: "xl/_rels/workbook.xml.rels", contenido: workbookRels },
    { nombre: "xl/styles.xml", contenido: styles },
    ...hojas.map((h, i) => ({
      nombre: `xl/worksheets/sheet${i + 1}.xml`,
      contenido: hojaXml(h),
    })),
  ]);
}
