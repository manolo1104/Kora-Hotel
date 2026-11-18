// Guardar la configuración de Camila POR CAMPOS.
//
// EL DEFECTO (encontrado en la revisión de nov 2026): la ruta armaba `bot.pago`
// aunque no viniera, con todos sus campos en `undefined`, y `saveBotConfig`
// escribía el objeto entero. Resultado: cada autoguardado de la encargada —que no
// ve ni puede tocar los datos bancarios— BORRABA la CLABE del dueño.
import { describe, it, expect, vi, beforeEach } from "vitest";

let fila: { config: Record<string, unknown>; extras: Record<string, unknown> };
let escrito: { config: Record<string, unknown>; extras: Record<string, unknown> } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }),
      update: (u: typeof escrito) => ({
        eq: async () => {
          escrito = u;
          return { error: null };
        },
      }),
    }),
  }),
}));

const { saveBotConfig } = await import("@/lib/db/admin");

const PAGO_DUENO = { titular: "Casa Ceiba SA", banco: "BBVA", clabe: "012180001234567891" };

beforeEach(() => {
  escrito = null;
  fila = {
    config: { bot_enabled: true },
    extras: {
      bot: {
        nombre: "Lupita",
        saludo: "Hola",
        pago: PAGO_DUENO,
        faqs: [{ q: "¿Hay estacionamiento?", a: "Sí" }],
      },
    },
  };
});

const botGuardado = () => (escrito?.extras.bot ?? {}) as Record<string, unknown>;

describe("guardar sólo lo que vino", () => {
  it("cambiar el saludo NO toca los datos bancarios", async () => {
    await saveBotConfig("h1", { bot: { saludo: "¡Bienvenido!" } });
    expect(botGuardado().saludo).toBe("¡Bienvenido!");
    expect(botGuardado().pago).toEqual(PAGO_DUENO);
    expect(botGuardado().nombre).toBe("Lupita");
  });

  it("cambiar sólo el banco conserva la CLABE", async () => {
    await saveBotConfig("h1", { bot: { pago: { banco: "Santander" } } });
    expect(botGuardado().pago).toEqual({ ...PAGO_DUENO, banco: "Santander" });
  });

  it("un campo en undefined no borra lo guardado", async () => {
    await saveBotConfig("h1", { bot: { nombre: undefined, tono: "Cálida" } });
    expect(botGuardado().nombre).toBe("Lupita");
    expect(botGuardado().tono).toBe("Cálida");
  });

  it("las preguntas se combinan con lo que ya había (no se reemplazan)", async () => {
    // Mientras la pantalla estaba abierta, «Corregir» agregó una.
    fila.extras.bot = { ...(fila.extras.bot as object), faqs: [{ q: "¿Hay estacionamiento?", a: "Sí" }, { q: "¿Aceptan perros?", a: "Sí" }] };
    await saveBotConfig("h1", {
      faqsCambio: {
        base: [{ q: "¿Hay estacionamiento?", a: "Sí" }],
        nuevo: [{ q: "¿Hay estacionamiento?", a: "Sí, techado" }],
      },
    });
    expect(botGuardado().faqs).toEqual([
      { q: "¿Hay estacionamiento?", a: "Sí, techado" },
      { q: "¿Aceptan perros?", a: "Sí" },
    ]);
  });
});

// ── La ruta ─────────────────────────────────────────────────────────────────
const saveMock = vi.fn(async () => true);
let puede = true;
vi.mock("@/lib/panel/active-hotel", () => ({
  getActiveHotel: async () => ({ hotelId: "h1", hotel: { id: "h1", config: {}, extras: {} }, rol: "dueno" }),
}));
vi.mock("@/lib/panel/permisos", () => ({
  negar: () => null,
  puedeCtx: () => puede,
}));

describe("la ruta de configuración", () => {
  beforeEach(() => {
    saveMock.mockClear();
    puede = true;
  });

  async function post(body: Record<string, unknown>) {
    vi.doMock("@/lib/db/admin", async (orig) => ({ ...(await orig<object>()), saveBotConfig: saveMock }));
    vi.resetModules();
    const { POST } = await import("@/app/api/admin/bot-config/route");
    return POST(new Request("http://x/api/admin/bot-config", { method: "POST", body: JSON.stringify(body) }));
  }

  it("quien no es dueño guarda su cambio SIN tocar el pago (antes lo borraba)", async () => {
    puede = false;
    const r = await post({ bot: { saludo: "Hola", pago: { clabe: "999" } } });
    expect(r.status).toBe(200);
    const input = (saveMock.mock.calls[0] as unknown as [string, { bot: Record<string, unknown> }])[1];
    expect(input.bot).toEqual({ saludo: "Hola" });
  });

  it("sólo manda los campos que vinieron", async () => {
    await post({ bot: { saludo: "Hola" } });
    const input = (saveMock.mock.calls[0] as unknown as [string, { bot: Record<string, unknown> }])[1];
    expect(Object.keys(input.bot)).toEqual(["saludo"]);
  });

  it("una CLABE mal escrita no se guarda y se dice por qué", async () => {
    const r = await post({ bot: { pago: { clabe: "0121800012" } } });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: "clabe-invalida", campo: "clabe" });
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("un teléfono de aviso a medias no se guarda", async () => {
    const r = await post({ bot: { escalarWhatsapp: "481 12" } });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: "telefono-invalido", campo: "escalarWhatsapp" });
  });

  it("vaciar el teléfono sí se permite", async () => {
    const r = await post({ bot: { escalarWhatsapp: "" } });
    expect(r.status).toBe(200);
  });
});
