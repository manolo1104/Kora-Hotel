// Que un fallo no se disfrace de éxito, en las dos acciones de `/api/agent` que
// ESCRIBEN: `log-conv` (texto libre en la base) y `set-status` (apaga el bot).
//
// Los dos defectos que fija esta prueba salieron de la auditoría de Camila:
//   · `log-conv` era la ÚNICA acción sin segundo factor Y sin tope. Con el token
//     del hotel —una sola credencial— cualquiera podía llenarle la tabla de
//     conversaciones al hotel y envenenar lo que su dueño lee en el panel.
//   · `set-status` contestaba `ok:true` aunque la escritura fallara, porque
//     `setBotStatus` devolvía `void` y se tragaba el error. El dueño mandaba
//     "apagar" por WhatsApp, recibía "🔕 Camila apagada", y Camila seguía
//     atendiendo huéspedes.
import { describe, it, expect, vi, beforeEach } from "vitest";

const logCamilaConversacion = vi.fn(async () => {});
const setBotStatus = vi.fn(async () => true);
const logAgentActivity = vi.fn(async () => {});

const HOTEL = {
  id: "h1", owner_id: "u1", slug: "hotel-prueba", nombre: "Hotel de prueba",
  extras: {}, config: {}, publicado: true, created_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/lib/db/bot-token", () => ({ hotelIdPorBotToken: async () => "h1" }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cadena: any = new Proxy({}, { get: () => () => cadena });
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cadena, adminEnvReady: true }));
vi.mock("@/lib/db/result", () => ({ leer: async () => HOTEL }));
vi.mock("@/lib/suscripcion", () => ({
  accesoDelHotel: async () => ({ activo: true, planActivo: true, prueba: null, bloqueado: false, mensajeBloqueo: null, puedeCobrar: true }),
}));
vi.mock("@/lib/db/admin", () => ({
  logAgentActivity: (...a: unknown[]) => logAgentActivity(...(a as [])),
  setBotStatus: (...a: unknown[]) => setBotStatus(...(a as [])),
  logCamilaConversacion: (...a: unknown[]) => logCamilaConversacion(...(a as [])),
}));
vi.mock("@/lib/bot/tools", () => ({ botAvailability: async () => ({ hayDisponibilidad: true, disponibles: [] }) }));
vi.mock("@/lib/bot/knowledge", () => ({ buildHotelKnowledge: () => ({ nombre: "Hotel de prueba" }) }));
vi.mock("@/lib/bot/prompt", () => ({ buildBotSystemPrompt: () => "prompt" }));
vi.mock("@/lib/agent-booking", () => ({ crearLinkReservaAgente: async () => ({ ok: true, habitacion: "x" }) }));
// Ver el comentario de tests/agent-acceso.test.ts: sin este mock el Proxy de
// arriba devuelve una función para `.then` y el `await` se cuelga para siempre.
const limitado = vi.fn(async () => false);
vi.mock("@/lib/api/rate-limit", () => ({
  limitado: (...a: unknown[]) => limitado(...(a as [])),
  ipDe: () => "1.2.3.4",
}));

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

const TURNOS = [{ rol: "user", texto: "hola" }, { rol: "assistant", texto: "¡hola!" }];

beforeEach(() => {
  vi.clearAllMocks();
  limitado.mockResolvedValue(false);
  setBotStatus.mockResolvedValue(true);
});

describe("log-conv: escribir en la base exige el segundo factor", () => {
  it("SIN el secreto de flota → 403, y no se escribe nada", async () => {
    const res = await pedir({ action: "log-conv", conv: "5214811234567", turnos: TURNOS });
    expect(res.status).toBe(403);
    expect(logCamilaConversacion).not.toHaveBeenCalled();
  });

  it("con el secreto → 200 y se guarda", async () => {
    const res = await pedir({ action: "log-conv", conv: "5214811234567", turnos: TURNOS }, true);
    expect(res.status).toBe(200);
    expect(logCamilaConversacion).toHaveBeenCalledWith("h1", "5214811234567", TURNOS);
  });

  // Antes retornaba ANTES del rate limit, así que un runtime en bucle podía
  // escribir sin tope. Ahora pasa por la misma puerta que el resto.
  it("queda TOPADO como el resto: si el hotel se pasó, 429 y no escribe", async () => {
    limitado.mockResolvedValue(true);
    const res = await pedir({ action: "log-conv", conv: "521481", turnos: TURNOS }, true);
    expect(res.status).toBe(429);
    expect(logCamilaConversacion).not.toHaveBeenCalled();
  });

  // Guardar el TEXTO de un turno no es un turno nuevo: contarlo inflaría las
  // conversaciones del panel al doble.
  it("no cuenta como conversación en las métricas del panel", async () => {
    await pedir({ action: "log-conv", conv: "521481", turnos: TURNOS }, true);
    expect(logAgentActivity).not.toHaveBeenCalled();
  });
});

describe("set-status: el acuse dice la verdad", () => {
  it("si se guardó → ok:true", async () => {
    const res = await pedir({ action: "set-status", enabled: false }, true);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, enabled: false });
  });

  // El acuse es la ÚNICA señal que tiene el dueño. Mentirle ahí es peor que no
  // contestarle: cree que apagó a Camila y Camila sigue hablando con huéspedes.
  it("si la base falló → 503 y ok:false, NO un ok:true de mentira", async () => {
    setBotStatus.mockResolvedValue(false);
    const res = await pedir({ action: "set-status", enabled: false }, true);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false });
  });
});
