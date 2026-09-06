// Los arreglos del RUNTIME de Camila (agentes/camila), probados contra el código
// real —igual que tests/camila-token-rotado.test.ts, que importa kora.js
// directamente— porque son la mitad que habla con los huéspedes y la que menos
// cobertura tenía.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { KoraHotel } from "../agentes/camila/kora.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const HOTEL = { id: "h1", slug: "hotel-prueba", nombre: "Hotel", token: "tok", lang: "es" } as const;

function respuesta(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => respuesta({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** El cuerpo JSON del enésimo POST a /api/agent. */
function cuerpo(n = 0) {
  return JSON.parse(fetchMock.mock.calls[n][1].body);
}

describe("el número de huéspedes llega hasta la cotización", () => {
  // EL defecto que abrió la auditoría: el esquema de la herramienta le promete
  // al modelo que el número de personas cambia el total "y es el mismo que
  // cobrará el link de pago", el modelo lo mandaba, y el runtime lo tiraba. El
  // servidor caía a su default de 2 y Camila cotizaba para dos a un grupo de
  // cinco.
  it("availability manda huespedes cuando se le pasa", async () => {
    const k = new KoraHotel(HOTEL);
    await k.availability("2026-10-10", "2026-10-12", { conv: "5214811234567", huespedes: 5 });
    expect(cuerpo()).toMatchObject({ action: "availability", huespedes: 5 });
  });

  it("no lo manda si no lo sabe (el servidor decide el default)", async () => {
    const k = new KoraHotel(HOTEL);
    await k.availability("2026-10-10", "2026-10-12", { conv: "521481" });
    expect(cuerpo()).not.toHaveProperty("huespedes");
  });

  it("un valor absurdo no viaja", async () => {
    const k = new KoraHotel(HOTEL);
    await k.availability("2026-10-10", "2026-10-12", { huespedes: 0 });
    expect(cuerpo()).not.toHaveProperty("huespedes");
  });
});

describe("el cerebro cacheado no puede quedarse en el día de ayer", () => {
  // El prompt lleva dentro "hoy es …" y se cachea 15 min. Entre las 00:00 y las
  // 00:15, Camila seguía creyendo que hoy es ayer y cotizaba la noche anterior
  // al huésped varado que pregunta "¿tienen algo para hoy?".
  it("cambiar de día invalida la caché aunque no hayan pasado los 15 min", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T23:58:00-06:00"));
    const k = new KoraHotel(HOTEL);
    fetchMock.mockResolvedValue(respuesta({ systemPrompt: "hoy es 10" }));
    await k.knowledge({});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Dos minutos después: mismo día no, día NUEVO. La caché tiene que caducar.
    vi.setSystemTime(new Date("2026-09-11T00:00:30-06:00"));
    await k.knowledge({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dentro del mismo día y de los 15 min, sigue cacheando", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00-06:00"));
    const k = new KoraHotel(HOTEL);
    fetchMock.mockResolvedValue(respuesta({ systemPrompt: "hoy es 10" }));
    await k.knowledge({});
    vi.setSystemTime(new Date("2026-09-10T12:05:00-06:00"));
    await k.knowledge({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ninguna llamada a Kora se queda colgada para siempre", () => {
  // Sin techo, un turno colgado bloquea TODO lo que ese huésped escriba después,
  // por el candado que serializa los turnos de cada chat.
  it("un fetch que nunca responde acaba en un error 504, no en una espera eterna", async () => {
    // El techo se lee al cargar el módulo, así que hay que fijarlo ANTES de
    // importarlo: con `vi.stubEnv` a secas se quedaría con los 20 s de
    // producción y la prueba tardaría eso en fallar.
    vi.stubEnv("KORA_TIMEOUT_MS", "30");
    vi.resetModules();
    const { KoraHotel: KoraRapida } = await import("../agentes/camila/kora.js");

    // Un fetch que sólo termina cuando se aborta.
    fetchMock.mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_res, rej) => {
          opts.signal.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            rej(e);
          });
        }),
    );
    const k = new KoraRapida(HOTEL);
    await expect(k.availability("2026-10-10", "2026-10-12", {})).rejects.toMatchObject({ status: 504 });
    vi.unstubAllEnvs();
  });
});

describe("el historial se puede recuperar tras un reinicio", () => {
  it("convierte los turnos guardados al formato del modelo", async () => {
    fetchMock.mockResolvedValue(
      respuesta({ ok: true, turnos: [
        { rol: "user", texto: "¿tienen para el sábado?" },
        { rol: "assistant", texto: "Sí, quedan dos." },
      ] }),
    );
    const k = new KoraHotel(HOTEL);
    const h = await k.historial({ conv: "5214811234567" });
    expect(h).toEqual([
      { role: "user", content: "¿tienen para el sábado?" },
      { role: "assistant", content: "Sí, quedan dos." },
    ]);
  });

  // Rehidratar es una mejora, no puede impedir que se conteste.
  it("si falla, devuelve vacío en vez de reventar el turno", async () => {
    fetchMock.mockResolvedValue(respuesta({ error: "boom" }, false));
    const k = new KoraHotel(HOTEL);
    expect(await k.historial({ conv: "521481" })).toEqual([]);
  });

  it("sin conversación no llama a nadie", async () => {
    const k = new KoraHotel(HOTEL);
    expect(await k.historial({})).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
