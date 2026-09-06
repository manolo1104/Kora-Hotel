// El enlace de WhatsApp de un hotel real estaba MUERTO en producción: el número
// se guardó como lo dice el hotelero en voz alta ("489 122 2835") y wa.me
// necesita clave de país. Con 10 dígitos, WhatsApp lee "489…" como un prefijo
// internacional que no existe y no abre chat con nadie — el huésped hace tap y
// no pasa nada. A ese hotel, además, le tenían el motor pausado: era su ÚNICO
// canal de venta.
import { describe, it, expect } from "vitest";
import { waNumero } from "@/lib/contacto";

describe("un número mexicano tecleado a la mexicana", () => {
  it("10 dígitos reciben su clave de país", () => {
    expect(waNumero("4891222835")).toBe("524891222835");
  });

  it("da igual cómo lo escriba el hotelero", () => {
    expect(waNumero("489 122 28 35")).toBe("524891222835");
    expect(waNumero("(489) 122-2835")).toBe("524891222835");
  });

  // El formato viejo de México llevaba un "1" para móviles que WhatsApp ya no
  // usa. Si se deja, el enlace tampoco abre.
  it("el 52-1 del formato viejo se normaliza", () => {
    expect(waNumero("5214891222835")).toBe("524891222835");
    expect(waNumero("+52 1 489 122 2835")).toBe("524891222835");
  });
});

describe("lo que ya está bien no se toca", () => {
  it("un número mexicano completo pasa igual", () => {
    expect(waNumero("524421295743")).toBe("524421295743");
    expect(waNumero("+52 442 129 5743")).toBe("524421295743");
  });

  // Sólo se asume México para 10 dígitos exactos: un extranjero legítimo ya
  // trae su propia clave y romperlo sería peor que el bug original.
  it("un número de otro país se respeta", () => {
    expect(waNumero("+1 415 555 0132")).toBe("14155550132");
    expect(waNumero("+34 600 123 456")).toBe("34600123456");
  });
});

describe("lo que no se puede usar devuelve null, para no pintar el botón", () => {
  // Ésta es la mitad importante del contrato: un botón que no abre chat con
  // nadie es peor que ningún botón, porque el huésped cree que ya escribió.
  it("vacío, nulo o basura", () => {
    expect(waNumero("")).toBeNull();
    expect(waNumero(null)).toBeNull();
    expect(waNumero(undefined)).toBeNull();
    expect(waNumero("no tengo")).toBeNull();
  });

  it("demasiado corto para ser un teléfono", () => {
    expect(waNumero("12345")).toBeNull();
    expect(waNumero("489122283")).toBeNull(); // 9 dígitos: le falta uno
  });

  it("demasiado largo para ser un teléfono", () => {
    expect(waNumero("1234567890123456")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("la política que manda y la nota del hotel van separadas", () => {
  // El Paraíso enseñaba en su página: "Cancelación gratis hasta 3 días antes de
  // llegar; después, sin devolución. Cancelación con 7 días de anticipación
  // (100% de reembolso). Cancelaciones con 3 días de anticipación (50%)".
  // Las dos cosas a la vez, sobre el mismo día, en la misma frase. El que se
  // aplica es el primero; el que el huésped puede citar si reclama, el segundo.
  it("la regla no se contamina con la nota libre", async () => {
    const { partesPolitica, politicaDe } = await import("@/lib/politica");
    const { regla, nota } = partesPolitica(
      politicaDe({ cancelacionDias: 3, nota: "Cancelaciones con 3 días de anticipación (50%)." }),
    );
    expect(regla).toContain("3 días");
    expect(regla).not.toContain("50%");
    expect(nota).toBe("Cancelaciones con 3 días de anticipación (50%).");
  });

  it("sin nota, la regla se lee igual que siempre", async () => {
    const { partesPolitica, textoPolitica, politicaDe } = await import("@/lib/politica");
    const p = politicaDe({ cancelacionDias: 2 });
    expect(partesPolitica(p).regla).toBe(textoPolitica(p));
    expect(partesPolitica(p).nota).toBe("");
  });
});
