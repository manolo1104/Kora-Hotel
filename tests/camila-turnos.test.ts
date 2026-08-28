// Paso 6.15 — candado por chat, purga de los Maps y parámetros por modelo.
//
// Los tres son del runtime de Camila (Railway). Aquí se prueba la LÓGICA, que es
// donde están los fallos: el resto es cableado que `node --check` ya cubre.
import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// EL DEFECTO (K-336): dos mensajes del mismo chat separados por más de
// MESSAGE_DEBOUNCE_MS se procesaban EN PARALELO sobre el mismo historial. Los
// dos leían la misma foto y el segundo `historiales.set` pisaba al primero: un
// turno entero desaparecido del hilo, y Camila contestando sin acordarse de lo
// que acababa de decir. La reproducción de abajo es la misma forma que tiene
// `procesar()` en index.js.
// ─────────────────────────────────────────────────────────────────────────────

/** Un turno: lee el historial, tarda, y escribe el historial + su respuesta. */
function turno(historiales: Map<string, string[]>, key: string, texto: string, ms: number) {
  return (async () => {
    const previo = historiales.get(key) ?? [];
    await new Promise((r) => setTimeout(r, ms));
    historiales.set(key, [...previo, texto]);
  })();
}

describe("un turno por chat a la vez", () => {
  it("SIN candado, el segundo turno pisa al primero (el defecto)", async () => {
    const h = new Map<string, string[]>();
    await Promise.all([turno(h, "k", "uno", 20), turno(h, "k", "dos", 5)]);
    // El lento escribe al final con la foto vieja: "dos" desaparece del hilo.
    expect(h.get("k")).toEqual(["uno"]);
  });

  it("CON candado, los dos turnos quedan en el hilo y en orden", async () => {
    const h = new Map<string, string[]>();
    const enCurso = new Map<string, Promise<unknown>>();

    async function procesar(key: string, texto: string, ms: number) {
      const anterior = enCurso.get(key);
      const t = (anterior ? anterior.catch(() => {}) : Promise.resolve()).then(() =>
        turno(h, key, texto, ms),
      );
      enCurso.set(key, t);
      try {
        await t;
      } finally {
        if (enCurso.get(key) === t) enCurso.delete(key);
      }
    }

    await Promise.all([procesar("k", "uno", 20), procesar("k", "dos", 5)]);
    expect(h.get("k")).toEqual(["uno", "dos"]);
    // Y el candado se suelta: si no, el chat se queda bloqueado para siempre.
    expect(enCurso.size).toBe(0);
  });

  it("chats DISTINTOS no se estorban entre sí", async () => {
    const h = new Map<string, string[]>();
    await Promise.all([turno(h, "a", "uno", 15), turno(h, "b", "dos", 5)]);
    expect(h.get("a")).toEqual(["uno"]);
    expect(h.get("b")).toEqual(["dos"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EL DEFECTO (K-170): los cuatro Maps por chat viven en un proceso que corre
// semanas sin reiniciar y nadie los limpiaba. Cada chat nuevo dejaba dentro su
// historial para siempre.
// ─────────────────────────────────────────────────────────────────────────────

describe("los chats inactivos se purgan", () => {
  const TTL = 6 * 60 * 60 * 1000;

  function purgar(
    ultima: Map<string, number>,
    mapas: Map<string, unknown>[],
    enCurso: Map<string, unknown>,
    ahora: number,
  ): number {
    const corte = ahora - TTL;
    let n = 0;
    for (const [key, at] of [...ultima.entries()]) {
      if (at > corte) continue;
      if (enCurso.has(key)) continue;
      for (const m of mapas) m.delete(key);
      ultima.delete(key);
      n += 1;
    }
    return n;
  }

  it("borra lo viejo de TODOS los mapas y conserva lo reciente", () => {
    const ahora = 1_000_000_000_000;
    const ultima = new Map([["viejo", ahora - TTL - 1], ["nuevo", ahora - 1000]]);
    const historiales = new Map<string, unknown>([["viejo", []], ["nuevo", []]]);
    const pausados = new Map<string, unknown>([["viejo", 1], ["nuevo", 1]]);
    const n = purgar(ultima, [historiales, pausados], new Map(), ahora);
    expect(n).toBe(1);
    expect(historiales.has("viejo")).toBe(false);
    expect(pausados.has("viejo")).toBe(false);
    expect(historiales.has("nuevo")).toBe(true);
  });

  it("NO purga un chat con un turno a medias: le borraría el historial debajo", () => {
    const ahora = 1_000_000_000_000;
    const ultima = new Map([["ocupado", ahora - TTL - 1]]);
    const historiales = new Map<string, unknown>([["ocupado", ["hola"]]]);
    const n = purgar(ultima, [historiales], new Map([["ocupado", Promise.resolve()]]), ahora);
    expect(n).toBe(0);
    expect(historiales.has("ocupado")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Parámetros de latencia por modelo. La lista de inclusión que había dejaba
// fuera cada modelo nuevo sin avisar, y desactivar el pensamiento no es seguro
// en todas las familias.
// ─────────────────────────────────────────────────────────────────────────────

describe("los parámetros que se le mandan a cada modelo", () => {
  const conEffort = (m: string) => !/haiku|claude-3|claude-2/.test(m);
  const sinPensar = (m: string) => conEffort(m) && !/claude-(opus-5|fable|mythos)/.test(m);

  it("un modelo NUEVO recibe esfuerzo por defecto (lista de exclusión)", () => {
    expect(conEffort("claude-opus-5")).toBe(true);
    expect(conEffort("claude-sonnet-6")).toBe(true);
  });

  it("Haiku no recibe ninguno de los dos: le dan 400", () => {
    expect(conEffort("claude-haiku-4-5")).toBe(false);
    expect(sinPensar("claude-haiku-4-5")).toBe(false);
  });

  // En Fable/Mythos el pensamiento está SIEMPRE encendido y mandar `disabled`
  // devuelve 400: dejaría a Camila muda en cuanto alguien cambiara el modelo.
  it("Fable y Mythos NO reciben thinking:disabled", () => {
    expect(sinPensar("claude-fable-5")).toBe(false);
    expect(sinPensar("claude-mythos-5")).toBe(false);
    expect(conEffort("claude-fable-5")).toBe(true);
  });

  // En Opus 5 lo acepta, pero con el pensamiento apagado a veces escribe la
  // llamada a la herramienta como TEXTO y la herramienta nunca corre.
  it("Opus 5 tampoco, aunque lo admita", () => {
    expect(sinPensar("claude-opus-5")).toBe(false);
  });

  it("en los que sí es seguro, se sigue mandando", () => {
    expect(sinPensar("claude-sonnet-5")).toBe(true);
    expect(sinPensar("claude-opus-4-8")).toBe(true);
  });
});
