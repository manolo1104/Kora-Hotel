// El .xlsx se arma a mano (lib/xlsx.ts). Si el ZIP o el XML salen mal, Excel no
// avisa de qué falla: dice "no se puede abrir" y el hotelero se queda sin sus
// datos justo cuando le prometimos que eran suyos. Estas pruebas comprueban la
// estructura del contenedor; que Excel lo abra de verdad se verificó a mano,
// abriéndolo con Microsoft Excel.
import { describe, it, expect } from "vitest";
import { inflateRawSync } from "node:zlib";
import { construirXlsx, columna, type Hoja } from "@/lib/xlsx";

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/** Lee un ZIP hecho por `construirXlsx` y devuelve {ruta: contenido}. */
function abrirZip(buf: Buffer): Record<string, string> {
  const salida: Record<string, string> = {};
  let i = 0;
  while (i < buf.length - 4 && buf.readUInt32LE(i) === 0x04034b50) {
    const compLen = buf.readUInt32LE(i + 18);
    const nombreLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const nombre = buf.subarray(i + 30, i + 30 + nombreLen).toString("utf8");
    const inicio = i + 30 + nombreLen + extraLen;
    salida[nombre] = inflateRawSync(buf.subarray(inicio, inicio + compLen)).toString("utf8");
    i = inicio + compLen;
  }
  return salida;
}

const HOJAS: Hoja[] = [
  {
    nombre: "Reservas",
    encabezados: ["Confirmación", "Huésped", "Total"],
    filas: [
      ["KORA-001", "Ana & Luis <casa>", 3500],
      ["KORA-002", 'Comillas "dobles"', 1200.5],
      ["KORA-003", "", null],
    ],
  },
  { nombre: "Huéspedes", encabezados: ["Correo"], filas: [["a@b.mx"]] },
];

describe("el .xlsx que se lleva el hotelero", () => {
  const buf = construirXlsx(HOJAS);
  const partes = abrirZip(buf);

  it("empieza por la firma de un ZIP (si no, Excel ni lo intenta)", () => {
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("trae las cinco piezas fijas más una hoja por pestaña", () => {
    expect(Object.keys(partes).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);
  });

  it("cada hoja declarada en el libro tiene su relación y su archivo", () => {
    const libro = partes["xl/workbook.xml"];
    const rels = partes["xl/_rels/workbook.xml.rels"];
    for (const id of ["rId1", "rId2"]) {
      expect(libro).toContain(`r:id="${id}"`);
      expect(rels).toContain(`Id="${id}"`);
    }
    // La hoja de estilos va con el id siguiente al de la última pestaña.
    expect(rels).toContain('Id="rId3"');
    expect(rels).toContain('Target="styles.xml"');
  });

  it("declara el tipo de contenido de cada hoja (si falta, Excel la ignora)", () => {
    const tipos = partes["[Content_Types].xml"];
    expect(tipos).toContain("/xl/worksheets/sheet1.xml");
    expect(tipos).toContain("/xl/worksheets/sheet2.xml");
    expect(tipos).toContain("/xl/styles.xml");
  });

  it("escapa lo que rompería el XML sin perder el dato", () => {
    const h1 = partes["xl/worksheets/sheet1.xml"];
    expect(h1).toContain("Ana &amp; Luis &lt;casa&gt;");
    expect(h1).toContain("Comillas &quot;dobles&quot;");
    // Ni un `&` suelto fuera de una entidad.
    expect(/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(h1)).toBe(false);
  });

  it("los números van como número, no como texto que lo parece", () => {
    const h1 = partes["xl/worksheets/sheet1.xml"];
    expect(h1).toContain("<v>3500</v>");
    expect(h1).toContain("<v>1200.5</v>");
    expect(h1).not.toContain('<t xml:space="preserve">3500</t>');
  });

  it("una celda vacía no ocupa celda (Excel la trata como vacía, no como cero)", () => {
    const h1 = partes["xl/worksheets/sheet1.xml"];
    // La fila 4 es la del texto vacío y el null: sólo debe traer A4.
    const fila4 = h1.match(/<row r="4">.*?<\/row>/)?.[0] ?? "";
    expect(fila4).toContain('r="A4"');
    expect(fila4).not.toContain('r="B4"');
    expect(fila4).not.toContain('r="C4"');
  });

  it("congela el encabezado y pone filtro sobre el rango real", () => {
    const h1 = partes["xl/worksheets/sheet1.xml"];
    expect(h1).toContain('state="frozen"');
    expect(h1).toContain('<autoFilter ref="A1:C4"/>');
  });

  it("el mismo contenido produce el mismo archivo (sin fechas del reloj)", () => {
    expect(construirXlsx(HOJAS).equals(buf)).toBe(true);
  });

  it("un carácter de control no tira el archivo entero", () => {
    const sucio = construirXlsx([
      { nombre: "X", encabezados: ["a"], filas: [["hola\u0000mundo\u0007"]] },
    ]);
    const xml = abrirZip(sucio)["xl/worksheets/sheet1.xml"];
    expect(xml).toContain("holamundo");
    expect(CONTROL.test(xml)).toBe(false);
  });

  it("un nombre de pestaña ilegal se limpia en vez de romper Excel", () => {
    const raro = construirXlsx([
      {
        nombre: "Ingresos/2026 [dic]: totales del año pasado y del otro",
        encabezados: ["a"],
        filas: [],
      },
    ]);
    const libro = abrirZip(raro)["xl/workbook.xml"];
    const nombre = libro.match(/name="([^"]*)"/)?.[1] ?? "";
    expect(nombre.length).toBeLessThanOrEqual(31);
    expect(/[:\\/?*[\]]/.test(nombre)).toBe(false);
  });

  it("un libro sin hojas es un error, no un archivo que Excel rechaza", () => {
    expect(() => construirXlsx([])).toThrow();
  });
});

describe("columna", () => {
  it("cuenta como Excel", () => {
    expect([1, 26, 27, 28, 52, 53].map(columna)).toEqual([
      "A",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });
});
