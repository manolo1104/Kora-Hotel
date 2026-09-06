// Leer las conversaciones de Camila. La tabla llevaba semanas llenándose y no
// existía una sola función de lectura en todo el repo, mientras la página de
// venta prometía que «todas las conversaciones quedan en tu panel y puedes
// leerlas» (lib/whatsapp.ts:499).
import { describe, it, expect, vi, beforeEach } from "vitest";

const filas = vi.fn();
const unaFila = vi.fn();

// Cadena encadenable que devuelve lo que decida el test al final. `limit` cierra
// el listado y `maybeSingle` el detalle, igual que en lib/db/admin.ts.
function cadena() {
  const api: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "order", "gte"]) api[m] = () => api;
  api.limit = () => filas();
  api.maybeSingle = () => unaFila();
  return api;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cadena(), adminEnvReady: true }));

const { getHilosCamila, getHiloCamila } = await import("@/lib/db/admin");

const TURNOS = [
  { rol: "user", texto: "¿tienen para el sábado?", ts: "2026-09-04T10:00:00Z" },
  { rol: "assistant", texto: "¡Sí! Te quedan dos cabañas.", ts: "2026-09-04T10:00:20Z" },
];

beforeEach(() => vi.clearAllMocks());

describe("listado de hilos", () => {
  it("trae el teléfono legible, cuántos mensajes y el último texto", async () => {
    filas.mockResolvedValue({
      data: [{ chat_id: "5214811234567@c.us", mensajes: TURNOS, ultimo_at: "2026-09-04T10:00:20Z" }],
      error: null,
    });
    const [h] = await getHilosCamila("h1");
    expect(h.telefono).toBe("+52 481 123 4567");
    expect(h.mensajes).toBe(2);
    expect(h.ultimoTexto).toBe("¡Sí! Te quedan dos cabañas.");
  });

  // El hotelero no debe ver "5214811234567@c.us" en una lista que va a leer a
  // diario; y un chat_id raro no puede romper la pantalla.
  it("un chat_id que no es un teléfono no rompe nada", async () => {
    filas.mockResolvedValue({ data: [{ chat_id: "algo-raro", mensajes: [], ultimo_at: "2026-09-04T10:00:00Z" }], error: null });
    const [h] = await getHilosCamila("h1");
    expect(h.telefono).toBe("algo-raro");
    expect(h.mensajes).toBe(0);
  });

  // FAIL-SAFE, como el resto de lib/db/admin.ts: mientras el SQL no esté corrido
  // la pantalla enseña "todavía no hay conversaciones", no un error.
  it("sin tabla (o con error) devuelve lista vacía, no revienta", async () => {
    filas.mockResolvedValue({ data: null, error: { message: 'relation "camila_conversaciones" does not exist' } });
    expect(await getHilosCamila("h1")).toEqual([]);
  });

  it("mensajes corrupto (no es un arreglo) se trata como hilo vacío", async () => {
    filas.mockResolvedValue({ data: [{ chat_id: "5214811234567@c.us", mensajes: "roto", ultimo_at: "2026-09-04T10:00:00Z" }], error: null });
    const [h] = await getHilosCamila("h1");
    expect(h.mensajes).toBe(0);
  });
});

describe("un hilo concreto", () => {
  it("devuelve los turnos completos", async () => {
    unaFila.mockResolvedValue({ data: { chat_id: "5214811234567@c.us", mensajes: TURNOS, ultimo_at: "2026-09-04T10:00:20Z" }, error: null });
    const h = await getHiloCamila("h1", "5214811234567@c.us");
    expect(h?.turnos).toHaveLength(2);
    expect(h?.turnos?.[0].rol).toBe("user");
  });

  it("un teléfono sin conversación en ESTE hotel devuelve null", async () => {
    unaFila.mockResolvedValue({ data: null, error: null });
    expect(await getHiloCamila("h1", "5219999999999@c.us")).toBeNull();
  });
});
