// Qué hace el runtime de Camila cuando el hotel se quedó sin saldo.
//
// Lo delicado aquí no es el descuento —eso vive en Postgres y se prueba en
// `saldo.test.ts`— sino lo que ve una PERSONA: el huésped que escribe y el
// hotelero que pregunta qué pasa. Las dos formas de quedar mal son decirle al
// huésped que se acabó el saldo del hotel, y decirle al hotelero que Camila
// está «apagada» cuando su interruptor está encendido.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { avisoSinSaldo } from "../agentes/camila/saldo.js";

describe("lo que se le dice al huésped", () => {
  const aviso = avisoSinSaldo();

  it("le confirma que su mensaje llegó y que alguien lo va a atender", () => {
    expect(aviso).toMatch(/recibimos tu mensaje/i);
    expect(aviso).toMatch(/una persona del hotel/i);
  });

  // El huésped no es cliente de Kora. Contarle la administración del hotel sólo
  // sirve para que el hotel quede mal delante de quien iba a reservar.
  it("NO le cuenta que el hotel se quedó sin saldo", () => {
    for (const palabra of ["saldo", "crédito", "credito", "pago", "recarga", "bot", "Kora", "desactivad"]) {
      expect(aviso.toLowerCase(), palabra).not.toContain(palabra.toLowerCase());
    }
  });

  it("no promete nada que no vaya a pasar", () => {
    // «lo reviso luego» o «te contesto en un momento» en primera persona serían
    // mentira: Camila no va a volver hasta que alguien recargue.
    expect(aviso).not.toMatch(/te (contesto|respondo|escribo) (luego|más tarde|en un momento)/i);
  });
});

// El runtime no se puede importar (abre Chromium al cargarse), así que el
// contrato entre las cuatro piezas se comprueba sobre el texto de los archivos.
//
// No es un rodeo: `motivo: "sin-saldo"` es una cadena suelta que viaja de Vercel
// a Railway. Nadie la tipa, así que renombrarla en un sitio y no en los otros
// compila, pasa el `tsc`, y deja a Camila callada sin avisar a nadie —el fallo
// más silencioso que puede tener esta feature.
describe("el contrato de «sin-saldo» entre Vercel y Railway", () => {
  const lee = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

  it("lo emite la API, lo cachea el cliente y lo consumen las dos ramas del runtime", () => {
    // Quien lo EMITE.
    expect(lee("app/api/agent/route.ts")).toContain('motivo: sin ? "sin-saldo" : null');
    // Quien lo GUARDA (si esto se cae, el runtime nunca ve el motivo).
    expect(lee("agentes/camila/kora.js")).toMatch(/motivo: typeof data\.motivo === "string"/);
    // Y los tres sitios que lo LEEN: el aviso al huésped, el comando `estado` y
    // el acuse de `encender`.
    const runtime = lee("agentes/camila/index.js");
    expect(runtime.match(/"sin-saldo"/g) ?? []).toHaveLength(3);
    expect(lee("agentes/camila/kora.js")).toContain('motivo !== "sin-saldo"');
  });

  it("el bloqueo va detrás de un interruptor, para poder desplegar midiendo antes de callar", () => {
    // La ruta pregunta por el helper y el helper es quien lee el entorno, para
    // que los dos interruptores del prepago vivan en un solo archivo.
    expect(lee("app/api/agent/route.ts")).toContain("if (bloqueoActivo())");
    expect(lee("lib/saldo/paquetes.ts")).toContain('process.env.SALDO_BLOQUEO === "1"');
    expect(lee("lib/saldo/paquetes.ts")).toContain('process.env.SALDO_RECARGA === "1"');
  });
});
