// `apartarUnidades` — cómo traduce lo que le contesta la base.
//
// El candado vive en Postgres y ya se probó contra un Postgres 17 real (con una
// carrera de dos sesiones sobre la última unidad: con candado queda 1 apartado,
// sin candado quedan 2). Lo que se fija AQUÍ es lo otro, que también se puede
// romper sin que nadie lo note: que cada respuesta de la base se convierta en la
// decisión correcta del servidor. En particular, que un "la función todavía no
// existe" DEGRADE al camino viejo en vez de dejar de vender — es la diferencia
// entre un despliegue que no arregla y un despliegue que tumba el motor.
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const alertar = vi.fn(async () => {});

/**
 * Lo que la degradación escribe de verdad. No se espía `createTemporaryHold`:
 * dentro de un módulo ES la llamada está enlazada directamente y un espía no la
 * intercepta — daría un verde falso. Se mira la ESCRITURA, que además es la
 * afirmación que importa: que el camino viejo aparte los cuartos correctos.
 */
const escrituras: { op: string; datos: unknown }[] = [];

// Cliente encadenable: cualquier método devuelve la cadena, y la cadena se
// puede esperar (resuelve `{data:null,error:null}` = escritura correcta).
function cadena(): unknown {
  const self: Record<string, unknown> = {};
  const p: unknown = new Proxy(self, {
    get(_t, prop) {
      if (prop === "then") return (res: (v: unknown) => void) => res({ data: null, error: null });
      return (...args: unknown[]) => {
        if (prop === "insert" || prop === "delete") escrituras.push({ op: String(prop), datos: args[0] });
        return p;
      };
    },
  });
  return p;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: (...a: unknown[]) => rpc(...(a as [])),
    from: () => cadena(),
  }),
  adminEnvReady: true,
}));
vi.mock("@/lib/alertas", () => ({ alertar: (...a: unknown[]) => alertar(...(a as [])) }));

const mod = await import("@/lib/db/availability");

const CAND = [{ tipo: "Cabaña", cantidad: 2, unidades: ["Cabaña", "Cabaña 2", "Cabaña 3"] }];

function apartar(opts: Parameters<typeof mod.apartarUnidades>[5] = {}) {
  return mod.apartarUnidades("h1", CAND, "2027-10-10", "2027-10-12", "web_x", opts);
}

beforeEach(() => {
  rpc.mockReset();
  alertar.mockClear();
  escrituras.length = 0;
});

describe("apartarUnidades traduce lo que dice la base", () => {
  it("el candado apartó → devuelve las unidades que ÉL eligió", async () => {
    rpc.mockResolvedValue({ data: ["Cabaña 2", "Cabaña 3"], error: null });
    const r = await apartar();
    expect(r.ok).toBe(true);
    expect(r.unidades).toEqual(["Cabaña 2", "Cabaña 3"]);
    expect(r.degradado).toBeFalsy();
  });

  it("le pasa al candado las CANDIDATAS, no una elección ya hecha", async () => {
    rpc.mockResolvedValue({ data: ["Cabaña", "Cabaña 2"], error: null });
    await apartar({ minutos: 35, maxUnidades: 7, prevSession: "web_viejo" });
    const [nombre, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(nombre).toBe("apartar_unidades_atomico");
    expect(args.p_asignacion).toEqual(CAND);
    expect(args.p_max_holds).toBe(7);
    expect(args.p_prev_session).toBe("web_viejo");
  });

  it("no alcanzó → 'no-disponible' (el motor responde 409, no 500)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "CUARTO_NO_DISPONIBLE: Cabaña (pedidas 2, libres 1)" } });
    const r = await apartar();
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("no-disponible");
  });

  it("se pasó del tope → 'tope-de-apartados', que se distingue del anterior", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "TOPE_DE_APARTADOS: 12 unidades pedidas, tope 7" } });
    const r = await apartar();
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("tope-de-apartados");
  });

  // LO IMPORTANTE: sin esto, desplegar el código antes de correr el SQL dejaría
  // al motor sin vender nada.
  it("la función no existe todavía → DEGRADA y aparta por el camino viejo", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.apartar_unidades_atomico" },
    });
    const r = await apartar();
    expect(r.ok).toBe(true);
    expect(r.degradado).toBe(true);
    expect(r.unidades).toEqual(["Cabaña", "Cabaña 2"]);
    // Y apartó DE VERDAD las dos primeras candidatas, con su vencimiento.
    const alta = escrituras.find((e) => e.op === "insert");
    expect((alta?.datos as { habitacion: string }[])?.map((f) => f.habitacion)).toEqual([
      "Cabaña",
      "Cabaña 2",
    ]);
    expect(alertar).toHaveBeenCalledOnce(); // y queda dicho, no disimulado
  });

  it("al degradar, también suelta el apartado anterior del huésped", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist" } });
    await apartar({ prevSession: "web_viejo" });
    // Primero suelta el viejo, después aparta el nuevo. Al revés, el apartado
    // propio del huésped le bloquearía su propio cuarto.
    expect(escrituras.map((e) => e.op)).toEqual(["delete", "insert"]);
  });

  it("si el candado devolviera MENOS de lo pedido, se corta: apartar de menos es vender aire", async () => {
    rpc.mockResolvedValue({ data: ["Cabaña"], error: null });
    const r = await apartar();
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("error");
  });

  it("un error cualquiera de la base NO se confunde con 'no hay lugar'", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } });
    const r = await apartar();
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("error");
    expect(escrituras).toEqual([]); // un timeout NO puede acabar apartando nada
  });

  it("no se pide nada → no se llama a la base", async () => {
    const r = await mod.apartarUnidades("h1", [], "2027-10-10", "2027-10-12", "web_x");
    expect(r.ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
