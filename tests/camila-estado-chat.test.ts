// El estado de trabajo de un hilo: etiquetas, «yo contesto» y no leídos.
//
// Las tres columnas son NUEVAS (sql/kora-camila-bandeja.sql). El riesgo real no
// es que fallen: es que mientras Manolo no corra ese SQL, la pantalla que HOY
// funciona se quede en blanco, o —peor— que el panel diga «Camila pausada» sobre
// una base que no guardó nada y Camila siga contestando encima del hotelero.
import { describe, it, expect, vi, beforeEach } from "vitest";

let filas: unknown = { data: [], error: null };
let unaFila: unknown = { data: null, error: null };
let respuestaUpdate: unknown = { data: [{ chat_id: "1@c.us" }], error: null };
let ultimoPatch: Record<string, unknown> = {};
let ultimosFiltros: Record<string, unknown> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cadena(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    from: () => b,
    select: () => b,
    order: () => b,
    eq: (col: string, val: unknown) => {
      ultimosFiltros[col] = val;
      return b;
    },
    update: (patch: Record<string, unknown>) => {
      ultimoPatch = patch;
      b._update = true;
      return b;
    },
    limit: () => filas,
    maybeSingle: () => unaFila,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: (res: (v: unknown) => any) => res(respuestaUpdate),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cadena(), adminEnvReady: true }));

const { getHilosCamila, guardarEstadoChat, pausaDeChat, limpiarEtiquetas, ETIQUETAS_CHAT } =
  await import("@/lib/db/admin");

const TURNOS = [
  { rol: "user", texto: "¿tienen para el sábado?", ts: "2026-09-04T10:00:00Z" },
  { rol: "assistant", texto: "Sí, dos cabañas.", ts: "2026-09-04T10:00:20Z" },
  { rol: "user", texto: "¿me la apartas?", ts: "2026-09-05T09:00:00Z" },
];

beforeEach(() => {
  filas = { data: [], error: null };
  unaFila = { data: null, error: null };
  respuestaUpdate = { data: [{ chat_id: "1@c.us" }], error: null };
  ultimoPatch = {};
  ultimosFiltros = {};
  vi.clearAllMocks();
});

describe("la bandeja lee lo nuevo sin exigirlo", () => {
  it("trae etiquetas, pausa y no leídos cuando las columnas existen", async () => {
    filas = {
      data: [
        {
          chat_id: "5214811234567@c.us",
          mensajes: TURNOS,
          ultimo_at: "2026-09-05T09:00:00Z",
          etiquetas: ["Cotizando"],
          pausado_hasta: "2026-09-05T11:00:00Z",
          visto_at: "2026-09-04T12:00:00Z",
        },
      ],
      error: null,
    };
    const [h] = await getHilosCamila("h1");
    expect(h.etiquetas).toEqual(["Cotizando"]);
    expect(h.pausadoHasta).toBe("2026-09-05T11:00:00Z");
    // Sólo el mensaje del huésped POSTERIOR a que el hotelero mirara.
    expect(h.noLeidos).toBe(1);
  });

  // Éste es el caso que importa: el SQL sin correr. La pantalla tiene que
  // seguir viéndose igual que ayer.
  it("sin las columnas nuevas la bandeja sigue funcionando", async () => {
    filas = {
      data: [{ chat_id: "5214811234567@c.us", mensajes: TURNOS, ultimo_at: "2026-09-05T09:00:00Z" }],
      error: null,
    };
    const [h] = await getHilosCamila("h1");
    expect(h.etiquetas).toEqual([]);
    expect(h.pausadoHasta).toBeNull();
    expect(h.telefono).toBe("+52 481 123 4567");
  });

  it("un hilo que nunca se abrió tiene TODO sin leer", async () => {
    filas = {
      data: [{ chat_id: "1@c.us", mensajes: TURNOS, ultimo_at: "2026-09-05T09:00:00Z", visto_at: null }],
      error: null,
    };
    const [h] = await getHilosCamila("h1");
    expect(h.noLeidos).toBe(2); // los dos del huésped; la respuesta de Camila no cuenta
  });

  it("el aislamiento por hotel sigue siendo el filtro, no la confianza", async () => {
    filas = { data: [], error: null };
    await getHilosCamila("hotel-de-manolo");
    expect(ultimosFiltros.hotel_id).toBe("hotel-de-manolo");
  });
});

describe("las etiquetas son un juego cerrado", () => {
  it("una etiqueta inventada no entra", () => {
    expect(limpiarEtiquetas(["Cotizando", "loquesea", 7, null])).toEqual(["Cotizando"]);
  });

  it("no se repiten", () => {
    expect(limpiarEtiquetas(["Nueva", "Nueva"])).toEqual(["Nueva"]);
  });

  it("lo que no es lista se trata como vacío", () => {
    expect(limpiarEtiquetas("Nueva")).toEqual([]);
    expect(limpiarEtiquetas(undefined)).toEqual([]);
  });

  it("el juego tiene las cinco de la bandeja", () => {
    expect([...ETIQUETAS_CHAT]).toEqual(["Nueva", "Cotizando", "Reservó", "Perdida", "Atender yo"]);
  });
});

describe("guardar el estado de un hilo dice la VERDAD", () => {
  it("guarda etiquetas, pausa y visto", async () => {
    const ok = await guardarEstadoChat("h1", "1@c.us", {
      etiquetas: ["Reservó"],
      pausadoHasta: "2026-09-05T11:00:00Z",
      vistoAt: "2026-09-05T10:00:00Z",
    });
    expect(ok).toBe(true);
    expect(ultimoPatch).toEqual({
      etiquetas: ["Reservó"],
      pausado_hasta: "2026-09-05T11:00:00Z",
      visto_at: "2026-09-05T10:00:00Z",
    });
  });

  // Sin esto, el panel pintaría «Camila pausada» y Camila seguiría contestando.
  it("si la columna no existe (SQL sin correr) devuelve false", async () => {
    respuestaUpdate = { data: null, error: { message: 'column "etiquetas" does not exist' } };
    expect(await guardarEstadoChat("h1", "1@c.us", { etiquetas: ["Nueva"] })).toBe(false);
  });

  it("si el hilo no existe no se inventa una fila vacía", async () => {
    respuestaUpdate = { data: [], error: null };
    expect(await guardarEstadoChat("h1", "no-existe@c.us", { etiquetas: ["Nueva"] })).toBe(false);
  });

  it("sólo se toca lo que se manda", async () => {
    await guardarEstadoChat("h1", "1@c.us", { vistoAt: "2026-09-05T10:00:00Z" });
    expect(Object.keys(ultimoPatch)).toEqual(["visto_at"]);
  });

  it("null en la pausa es «reanuda», y sí se escribe", async () => {
    await guardarEstadoChat("h1", "1@c.us", { pausadoHasta: null });
    expect(ultimoPatch).toEqual({ pausado_hasta: null });
  });

  it("una etiqueta inventada no llega a la base", async () => {
    await guardarEstadoChat("h1", "1@c.us", { etiquetas: ["Nueva", "borrar-todo"] });
    expect(ultimoPatch.etiquetas).toEqual(["Nueva"]);
  });
});

describe("la pausa que lee el runtime es fail-open", () => {
  it("devuelve la fecha guardada", async () => {
    unaFila = { data: { pausado_hasta: "2026-09-05T11:00:00Z" }, error: null };
    expect(await pausaDeChat("h1", "1@c.us")).toBe("2026-09-05T11:00:00Z");
  });

  // Callar a Camila por un hipo de la base dejaría muda a la de un hotel que
  // paga. Una respuesta de más es mucho más barata.
  it("ante un error de la base, Camila sigue contestando", async () => {
    unaFila = { data: null, error: { message: "boom" } };
    expect(await pausaDeChat("h1", "1@c.us")).toBeNull();
  });

  it("un hilo sin pausa no pausa", async () => {
    unaFila = { data: { chat_id: "1@c.us" }, error: null };
    expect(await pausaDeChat("h1", "1@c.us")).toBeNull();
  });
});
