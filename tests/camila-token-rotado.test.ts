// Paso 6.4 — un hotel ya arrancado relee su token en cada pasada del fleet.
//
// EL DEFECTO (K-289): el runtime guardaba el token al ARRANCAR el hotel y no
// volvía a mirarlo nunca. Es la llave de toda la etapa 1: rotar los tokens —que
// es lo que exige cerrar la fuga de `agent_token`— habría dejado a los bots
// vivos mandando el viejo, `/api/agent` respondiendo 401 a todo, y a Camila
// muda en todos los hoteles a la vez sin que nadie supiera por qué.
//
// Lo que se fija aquí es el equilibrio del arreglo: refrescar SIEMPRE, pero
// invalidar las cachés SÓLO cuando el token cambia. Invalidarlas en cada pasada
// (cada 5 min) multiplicaría el gasto de `knowledge` sin motivo.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// El runtime de Camila es JS puro (corre en Railway), pero lleva JSDoc, así que
// TypeScript sí comprueba estas llamadas.
import { KoraHotel } from "../agentes/camila/kora.js";

const HOTEL = {
  id: "h1",
  slug: "hotel-magico",
  nombre: "Mágico",
  token: "kora_VIEJO",
  lang: "es" as const,
};

interface KoraHotelInterno {
  token: string;
  nombre: string;
  lang: string;
  _knowledge: unknown;
  _knowledgeAt: number;
  _status: unknown;
  _statusAt: number;
  actualizar(hotel: unknown): void;
}

function conCache(): KoraHotelInterno {
  const k = new KoraHotel({ ...HOTEL }) as KoraHotelInterno;
  k._knowledge = { nombre: "caché vieja" };
  k._knowledgeAt = Date.now();
  k._status = { enabled: true };
  k._statusAt = Date.now();
  return k;
}

beforeEach(() => vi.spyOn(console, "log").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("el runtime de Camila relee su token", () => {
  it("token rotado → lo adopta y tira las cachés", () => {
    const k = conCache();
    k.actualizar({ ...HOTEL, token: "kora_NUEVO" });
    expect(k.token).toBe("kora_NUEVO");
    expect(k._knowledge).toBeNull();
    expect(k._status).toBeNull();
  });

  it("sin cambio de token → CONSERVA las cachés (si no, el gasto se dispara)", () => {
    const k = conCache();
    k.actualizar({ ...HOTEL });
    expect(k._knowledge).not.toBeNull();
    expect(k._status).not.toBeNull();
  });

  it("nombre e idioma se refrescan aunque el token siga igual", () => {
    const k = conCache();
    k.actualizar({ ...HOTEL, nombre: "Mágico Resort", lang: "en" });
    expect(k.nombre).toBe("Mágico Resort");
    expect(k.lang).toBe("en");
    expect(k._knowledge).not.toBeNull(); // y sin tirar la caché
  });

  it("un idioma raro cae a español, no lo propaga", () => {
    const k = conCache();
    // A propósito fuera del tipo: el fleet es JSON de la red, no un objeto
    // tipado, así que esto puede llegar de verdad.
    k.actualizar({ ...HOTEL, lang: "klingon" as unknown as "es" });
    expect(k.lang).toBe("es");
  });

  it("un fleet que devuelve basura no tumba al bot", () => {
    const k = conCache();
    k.actualizar(null);
    k.actualizar(undefined);
    expect(k.token).toBe("kora_VIEJO");
  });
});

// Paso 6.3 — Camila se calla cuando no sabe nada del hotel.
//
// EL DEFECTO (K-287): el `catch` de `status()` asumía `enabled: true` ante
// CUALQUIER error. El fail-open se puso para los hipos de red — y está bien—,
// pero se tragaba también el 401 y el 403, que no son hipos: 401 = el token
// murió (lo rotaron, o borraron el hotel); 403 = la cuenta está bloqueada o la
// prueba venció. En esos dos casos Camila seguía conversando con un cerebro que
// ya no podía leer, inventándole a un huésped un hotel que no conoce.
describe("Camila distingue un token muerto de un hipo de red", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function responder(status: number) {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "x" }), {
        status,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
  }

  async function estadoTras(status: number) {
    responder(status);
    const k = new KoraHotel({ ...HOTEL }) as KoraHotelInterno & { status(): Promise<{ enabled: boolean }> };
    return await k.status();
  }

  it("401 (token muerto) → se calla", async () => {
    expect((await estadoTras(401)).enabled).toBe(false);
  });

  it("403 (cuenta bloqueada o prueba vencida) → se calla", async () => {
    expect((await estadoTras(403)).enabled).toBe(false);
  });

  it("503 (Kora tuvo un hipo) → NO se calla, que era para lo que estaba el fail-open", async () => {
    expect((await estadoTras(503)).enabled).toBe(true);
  });

  it("500 tampoco la calla", async () => {
    expect((await estadoTras(500)).enabled).toBe(true);
  });
});
