// Los comandos con los que el hotelero maneja a Camila desde su WhatsApp.
//
// Nunca habían estado bajo prueba —vivían en index.js, que abre navegadores al
// importarse— y son las órdenes que apagan el bot de un hotel entero.
import { describe, it, expect } from "vitest";
import { mismoNumero, parseComando, textoAyuda, COMANDOS } from "../agentes/camila/comandos.js";

const ADMIN = "524891251458"; // como se guarda en el panel, con lada

describe("quién puede dar órdenes", () => {
  it("reconoce al dueño escriba como escriba su número", () => {
    for (const chat of [
      "524891251458@c.us",
      "5214891251458@c.us", // el 1 que México mete a veces
      "4891251458@c.us",
      "+52 489 125 1458",
    ]) {
      expect(mismoNumero(chat, ADMIN), chat).toBe(true);
    }
  });

  it("un huésped cualquiera no manda", () => {
    expect(mismoNumero("5215512345678@c.us", ADMIN)).toBe(false);
  });

  // El hueco que tenía: comparaba `Math.min(10, a.length, b.length)` dígitos.
  // Un remitente de cuatro dígitos que casaran con el final del número del dueño
  // —los códigos cortos de servicio existen— podía apagarle el bot al hotel.
  it("un remitente corto NO puede colarse comparando pocos dígitos", () => {
    expect(mismoNumero("1458@c.us", ADMIN)).toBe(false);
    expect(mismoNumero("251458@c.us", ADMIN)).toBe(false);
  });

  it("sin número autorizado no manda nadie", () => {
    expect(mismoNumero("524891251458@c.us", "")).toBe(false);
    expect(mismoNumero("524891251458@c.us", "12345")).toBe(false);
  });

  // LIMITACIÓN REAL, no un defecto de la prueba: un @lid es un identificador
  // opaco, no un teléfono. Si el dueño escribe desde un chat así, sus comandos
  // no se reconocen — y eso hay que decírselo en el panel.
  it("un @lid no se reconoce como el número del dueño", () => {
    expect(mismoNumero("165332417282214@lid", ADMIN)).toBe(false);
  });
});

describe("qué se entiende como orden", () => {
  it("apaga con cualquiera de sus palabras", () => {
    for (const p of COMANDOS.off) expect(parseComando(p), p).toBe("off");
  });

  it("enciende con cualquiera de sus palabras", () => {
    for (const p of COMANDOS.on) expect(parseComando(p), p).toBe("on");
  });

  it("acepta «camila» delante, mayúsculas, acentos y signos", () => {
    for (const t of ["Camila, apágate", "CAMILA APAGAR", "apágate.", "¿apagar?", "camila: pausa"]) {
      expect(parseComando(t), t).toBe("off");
    }
  });

  // Lo que protege al hotelero de apagarse el bot sin querer.
  it("una frase normal NO es una orden", () => {
    for (const t of [
      "hay que pausar las reservas del sábado",
      "apagar la luz del cuarto 3",
      "¿puedes apagar el bot un rato?",
      "off season",
      "activa la promoción",
    ]) {
      expect(parseComando(t), t).toBeNull();
    }
  });

  it("un mensaje vacío no es nada", () => {
    expect(parseComando("")).toBeNull();
    expect(parseComando("   ")).toBeNull();
  });

  it("estado y ayuda también son órdenes", () => {
    expect(parseComando("estado")).toBe("estado");
    expect(parseComando("ayuda")).toBe("ayuda");
    expect(parseComando("Camila, ayuda")).toBe("ayuda");
  });
});

describe("la chuleta que Camila manda con «ayuda»", () => {
  it("lista las cuatro órdenes", () => {
    const t = textoAyuda("Selva");
    for (const p of ["apagar", "encender", "estado", "ayuda"]) expect(t).toContain(p);
  });

  it("dice las dos condiciones que más confunden", () => {
    const t = textoAyuda("Selva");
    expect(t).toContain("número que diste de alta");
    expect(t).toContain("la palabra sola");
  });

  it("usa el nombre que el hotel le puso", () => {
    expect(textoAyuda("Selva")).toContain("Selva");
  });
});
