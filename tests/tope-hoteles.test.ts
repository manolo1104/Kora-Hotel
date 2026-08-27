// "Una cuenta = un hotel". Es una decisión de negocio, no técnica: el plan son
// $550/mes y el acceso se concede por `owner_id`, así que con el tope en 2 un
// solo dueño pagaba una vez y operaba dos hoteles.
import { describe, it, expect, vi, beforeEach } from "vitest";

let conteo: { count: number | null; error: { message: string; code: string } | null } = {
  count: 0,
  error: null,
};
let estadoSub: string | null = null;
let lecturaOk = true;

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: async () => conteo }) }),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase/env", () => ({ supabaseEnvReady: true, SUPABASE_URL: "", SUPABASE_ANON_KEY: "" }));
vi.mock("@/lib/suscripcion", () => ({
  leerSuscripcion: async () => ({ ok: lecturaOk, sub: estadoSub ? { estado: estadoSub } : null }),
}));

const { alcanzoTopeDeHoteles, MAX_HOTELES_POR_CUENTA } = await import("@/lib/tenant");

beforeEach(() => {
  conteo = { count: 0, error: null };
  estadoSub = null;
  lecturaOk = true;
});

describe("el tope de hoteles por cuenta", () => {
  it("el tope es UNO", () => expect(MAX_HOTELES_POR_CUENTA).toBe(1));

  it("sin hoteles todavía, puede crear", async () =>
    expect((await alcanzoTopeDeHoteles("u1")).alcanzado).toBe(false));

  it("con un hotel ya no puede crear otro", async () => {
    conteo = { count: 1, error: null };
    expect((await alcanzoTopeDeHoteles("u1")).alcanzado).toBe(true);
  });

  // Los que ya tenían dos se quedan, y siguen pudiendo operar: la regla nueva es
  // para altas nuevas, no le apaga un hotel a nadie.
  it("una cuenta de CORTESÍA queda exenta", async () => {
    conteo = { count: 2, error: null };
    estadoSub = "cortesia";
    expect((await alcanzoTopeDeHoteles("u1")).alcanzado).toBe(false);
  });

  it("una cuenta que PAGA no queda exenta: paga un hotel", async () => {
    conteo = { count: 1, error: null };
    estadoSub = "activa";
    expect((await alcanzoTopeDeHoteles("u1")).alcanzado).toBe(true);
  });

  // Fallar ABIERTO aquí sería regalar hoteles por un hipo de la base, que es
  // justo lo que este tope existe para impedir (K-333).
  it("si no se puede leer la suscripción, se aplica el tope (falla CERRADO)", async () => {
    conteo = { count: 1, error: null };
    lecturaOk = false;
    expect((await alcanzoTopeDeHoteles("u1")).alcanzado).toBe(true);
  });

  it("si no se pueden contar los hoteles, LANZA (nadie crea a ciegas)", async () => {
    conteo = { count: null, error: { message: "boom", code: "XX000" } };
    await expect(alcanzoTopeDeHoteles("u1")).rejects.toThrow();
  });
});
