// La PUERTA de Camila: qué hoteles pueden usar `/api/agent`.
//
// Antes sólo la acción `reservar` miraba `accesoDelHotel`. A un hotel con la
// prueba vencida se le cerraba la caja pero se le seguía dando el producto:
// Camila contestaba, cotizaba y gastaba cuota de Anthropic. Esta prueba fija que
// la comprobación está ARRIBA, antes de que ninguna acción haga trabajo.
import { describe, it, expect, vi, beforeEach } from "vitest";

const accesoDelHotel = vi.fn();
const botAvailability = vi.fn(async () => ({ hayDisponibilidad: true, disponibles: [] }));
const buildHotelKnowledge = vi.fn(() => ({ nombre: "Hotel de prueba" }));
const logAgentActivity = vi.fn(async () => {});
const setBotStatus = vi.fn(async () => {});

const HOTEL = {
  id: "h1", owner_id: "u1", slug: "hotel-prueba", nombre: "Hotel de prueba",
  extras: {}, config: {}, publicado: true, created_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/lib/db/bot-token", () => ({ hotelIdPorBotToken: async () => "h1" }));
// Cliente encadenable de mentira: `.from().select().eq().maybeSingle()` no debe
// lanzar. Lo que devuelve la consulta lo decide el mock de `leer`, más abajo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cadena: any = new Proxy({}, { get: () => () => cadena });
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cadena, adminEnvReady: true }));
vi.mock("@/lib/db/result", () => ({ leer: async () => HOTEL }));
vi.mock("@/lib/suscripcion", () => ({ accesoDelHotel: (h: unknown) => accesoDelHotel(h) }));
vi.mock("@/lib/db/admin", () => ({
  logAgentActivity: (...a: unknown[]) => logAgentActivity(...(a as [])),
  setBotStatus: (...a: unknown[]) => setBotStatus(...(a as [])),
  logCamilaConversacion: async () => {},
}));
vi.mock("@/lib/bot/tools", () => ({ botAvailability: (...a: unknown[]) => botAvailability(...(a as [])) }));
vi.mock("@/lib/bot/knowledge", () => ({ buildHotelKnowledge: () => buildHotelKnowledge() }));
vi.mock("@/lib/bot/prompt", () => ({ buildBotSystemPrompt: () => "prompt" }));
vi.mock("@/lib/agent-booking", () => ({ crearLinkReservaAgente: async () => ({ ok: true, habitacion: "x" }) }));

const { POST } = await import("@/app/api/agent/route");

const SECRETO = "secreto-de-flota";
process.env.BOT_FLEET_SECRET = SECRETO;

function pedir(body: Record<string, unknown>, conSecreto = false) {
  return POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(conSecreto ? { authorization: `Bearer ${SECRETO}` } : {}),
      },
      body: JSON.stringify({ token: "tok", ...body }),
    }),
  );
}

const ACTIVO = { activo: true, planActivo: true, prueba: null, bloqueado: false, mensajeBloqueo: null };
const VENCIDO = { activo: false, planActivo: false, prueba: { vencida: true }, bloqueado: false, mensajeBloqueo: null };
const BLOQUEADO = { activo: false, planActivo: false, prueba: null, bloqueado: true, mensajeBloqueo: "Falta de pago" };

beforeEach(() => vi.clearAllMocks());

describe("hotel con la prueba VENCIDA y sin plan", () => {
  beforeEach(() => accesoDelHotel.mockResolvedValue(VENCIDO));

  it("availability → 403 motor-pausado, y NO se calcula disponibilidad", async () => {
    const res = await pedir({ action: "availability", checkin: "2026-10-10", checkout: "2026-10-12" });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "motor-pausado" });
    expect(botAvailability).not.toHaveBeenCalled();
  });

  it("knowledge (sin action) → 403, y NO se arma el cerebro del hotel", async () => {
    const res = await pedir({});
    expect(res.status).toBe(403);
    expect(buildHotelKnowledge).not.toHaveBeenCalled();
  });

  it("no se le cuenta actividad: ni métricas ni cuota gastada", async () => {
    await pedir({ action: "availability", checkin: "2026-10-10", checkout: "2026-10-12" });
    expect(logAgentActivity).not.toHaveBeenCalled();
  });

  // A PROPÓSITO no es un 403: `kora.status()` del runtime es FAIL-OPEN ante
  // error, así que un 403 lo dejaría creyendo que Camila sigue encendida.
  // Un 200 con enabled:false sí la calla de verdad (index.js:258).
  it("status → 200 con enabled:false, que es lo que de verdad la calla", async () => {
    const res = await pedir({ action: "status" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, enabled: false });
  });

  it("set-status no puede volver a encenderla", async () => {
    const res = await pedir({ action: "set-status", enabled: true }, true);
    expect(res.status).toBe(403);
    expect(setBotStatus).not.toHaveBeenCalled();
  });
});

describe("cuenta BLOQUEADA por Kora", () => {
  beforeEach(() => accesoDelHotel.mockResolvedValue(BLOQUEADO));
  it("se distingue del plan vencido: cuenta-bloqueada", async () => {
    const res = await pedir({ action: "availability", checkin: "2026-10-10", checkout: "2026-10-12" });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "cuenta-bloqueada" });
  });
});

describe("hotel AL CORRIENTE (que es a quien no podemos romper)", () => {
  beforeEach(() => accesoDelHotel.mockResolvedValue(ACTIVO));

  it("availability sigue funcionando", async () => {
    const res = await pedir({ action: "availability", checkin: "2026-10-10", checkout: "2026-10-12" });
    expect(res.status).toBe(200);
    expect(botAvailability).toHaveBeenCalled();
  });

  it("knowledge sigue funcionando", async () => {
    const res = await pedir({});
    expect(res.status).toBe(200);
    expect(buildHotelKnowledge).toHaveBeenCalled();
  });

  it("status dice encendido", async () => {
    expect(await (await pedir({ action: "status" })).json()).toMatchObject({ enabled: true });
  });
});
