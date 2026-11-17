// «Ya le avisé al equipo» tiene que ser VERDAD.
//
// Antes el prompt le hacía decir eso a Camila y no existía ningún aviso: ni una
// alerta, ni una etiqueta. Ahora `pasar_a_persona` llama a la acción `escalar`
// de /api/agent: marca el chat «Atender yo», lo pausa y devuelve a quién
// mandarle el WhatsApp (que manda el runtime, que es quien tiene la sesión).
import { describe, it, expect, vi, beforeEach } from "vitest";

const escalarChat = vi.fn(async () => true);
let HOTEL: Record<string, unknown> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cadena: any = new Proxy({}, { get: (_d, prop) => (prop === "then" ? undefined : () => cadena) });
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => cadena, adminEnvReady: true }));
vi.mock("@/lib/db/bot-token", () => ({ hotelIdPorBotToken: async () => "h1" }));
vi.mock("@/lib/db/result", () => ({ leer: async () => HOTEL }));
vi.mock("@/lib/suscripcion", () => ({
  accesoDelHotel: async () => ({ activo: true, puedeCobrar: true, planActivo: true, prueba: null, bloqueado: false }),
}));
vi.mock("@/lib/db/admin", () => ({
  logAgentActivity: async () => {},
  setBotStatus: async () => true,
  logCamilaConversacion: async () => {},
  escalarChat: (...a: unknown[]) => escalarChat(...(a as [])),
}));
vi.mock("@/lib/api/rate-limit", () => ({ limitado: async () => false, ipDe: () => "1.2.3.4" }));

const { POST } = await import("@/app/api/agent/route");
const SECRETO = "secreto-de-flota";
process.env.BOT_FLEET_SECRET = SECRETO;

function escalar(body: Record<string, unknown>, conSecreto = true) {
  return POST(
    new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json", ...(conSecreto ? { authorization: `Bearer ${SECRETO}` } : {}) },
      body: JSON.stringify({ token: "tok", action: "escalar", ...body }),
    }),
  );
}

const base = (extrasBot: Record<string, unknown>, config: Record<string, unknown> = {}) => ({
  id: "h1",
  slug: "casa-ceiba",
  nombre: "Casa Ceiba",
  whatsapp: "+52 481 123 4567",
  extras: { bot: { nombre: "Lupita", ...extrasBot } },
  config,
});

beforeEach(() => vi.clearAllMocks());

describe("escalar a una persona", () => {
  it("marca el chat y lo pausa (12 h como máximo)", async () => {
    HOTEL = base({ escalarWhatsapp: "+52 444 999 8877" });
    const r = await (await escalar({ conv: "5214811111111", motivo: "problema-hospedado", resumen: "No hay agua caliente en la Cabaña Río." })).json();
    expect(r.ok).toBe(true);
    expect(escalarChat).toHaveBeenCalledWith("h1", "5214811111111", r.pausadoHasta);
    const horas = (Date.parse(r.pausadoHasta) - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(11.9);
    expect(horas).toBeLessThanOrEqual(12);
  });

  it("le avisa al número de «pasar con una persona», con el resumen y el link al chat", async () => {
    HOTEL = base({ escalarWhatsapp: "+52 444 999 8877" });
    const r = await (await escalar({ conv: "5214811111111", motivo: "comprobante-pago", resumen: "Dice que ya transfirió $2,800." })).json();
    expect(r.avisarA).toBe("524449998877");
    expect(r.aviso).toContain("Lupita necesita a una persona");
    expect(r.aviso).toContain("Comprobante de pago por revisar");
    expect(r.aviso).toContain("Dice que ya transfirió $2,800.");
    expect(r.aviso).toContain("/panel/casa-ceiba/camila?chat=5214811111111");
  });

  it("si ese número es el MISMO que atiende Camila, usa el teléfono de control del dueño", async () => {
    HOTEL = base({ escalarWhatsapp: "481 123 4567" }, { bot_admin_phone: "5215512345678" });
    const r = await (await escalar({ conv: "5214811111111", motivo: "otro", resumen: "x" })).json();
    expect(r.avisarA).toBe("5215512345678");
  });

  it("sin ningún número válido, el chat queda marcado igual (el hotelero lo ve en el panel)", async () => {
    HOTEL = base({});
    const r = await (await escalar({ conv: "5214811111111", motivo: "otro", resumen: "x" })).json();
    expect(r.ok).toBe(true);
    expect(r.avisarA).toBeNull();
    expect(escalarChat).toHaveBeenCalled();
  });

  it("exige el secreto de flota: con sólo el token no se pausa a nadie", async () => {
    HOTEL = base({});
    const res = await escalar({ conv: "5214811111111", motivo: "otro", resumen: "x" }, false);
    expect(res.status).toBe(403);
    expect(escalarChat).not.toHaveBeenCalled();
  });

  it("sin chat no hay a quién escalar", async () => {
    HOTEL = base({});
    const res = await escalar({ motivo: "otro", resumen: "x" });
    expect(res.status).toBe(400);
  });
});
