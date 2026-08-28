// Paso 6.5 — generar el token del bot deja de ser una carrera (K-293).
//
// EL DEFECTO: `asegurarBotToken` leía, y si no había token, generaba uno y lo
// guardaba con un `upsert` que PISA. Hay dos caminos que la llaman a la vez sin
// saberlo — la pasada del fleet (cada 5 min, para todos los hoteles elegibles) y
// el dueño pulsando "Ver token" en el panel —, así que los dos generaban un
// token distinto, ganaba el último en escribir, y el otro se iba con un token
// que ya no existía en la base: el panel enseñaba uno muerto, o el runtime
// arrancaba con uno que `/api/agent` rechazaba.
//
// Medido contra un Postgres real: con el `upsert` que pisa, la base se queda con
// el token de uno y el otro devuelve el suyo. Con `on conflict do nothing` +
// releer, los dos devuelven exactamente lo que hay guardado.
import { describe, it, expect, vi, beforeEach } from "vitest";

/** Lo que la base "tiene" en esta prueba. null = el hotel no tiene token. */
let guardado: string | null = null;
/** Las escrituras que se intentaron, en orden. */
const escrituras: { token: string; ignoraDuplicados: boolean }[] = [];

function cadena(): unknown {
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (res: (v: unknown) => void) =>
            res({ data: guardado ? { token: guardado } : null, error: null });
        }
        return (...args: unknown[]) => {
          if (prop === "upsert") {
            const fila = args[0] as { token: string };
            const opts = (args[1] ?? {}) as { ignoreDuplicates?: boolean };
            escrituras.push({ token: fila.token, ignoraDuplicados: Boolean(opts.ignoreDuplicates) });
            // La base decide: si ya hay fila y se pidió ignorar duplicados, no
            // se pisa. Es exactamente lo que hace la clave primaria hotel_id.
            if (guardado === null || !opts.ignoreDuplicates) guardado = fila.token;
          }
          return p;
        };
      },
    },
  );
  return p;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => cadena() }),
  adminEnvReady: true,
}));

const { asegurarBotToken } = await import("@/lib/db/bot-token");

beforeEach(() => {
  guardado = null;
  escrituras.length = 0;
});

describe("asegurarBotToken no puede devolver un token que no está guardado", () => {
  it("hotel sin token → genera uno y devuelve EL QUE QUEDÓ guardado", async () => {
    const t = await asegurarBotToken("h1");
    expect(t).toMatch(/^kora_[0-9a-f]{32}$/);
    expect(t).toBe(guardado);
  });

  it("hotel que ya tiene token → lo devuelve sin escribir nada", async () => {
    guardado = "kora_yaexistia";
    const t = await asegurarBotToken("h1");
    expect(t).toBe("kora_yaexistia");
    expect(escrituras).toEqual([]);
  });

  // EL DEFECTO, exactamente: otro proceso ganó la carrera entre la lectura y la
  // escritura. Antes esta función devolvía el token que ELLA generó.
  it("si otro gana la carrera, devuelve el token del GANADOR, no el suyo", async () => {
    const original = asegurarBotToken("h1");
    // El otro camino escribe mientras tanto (la lectura ya dijo "no hay").
    guardado = "kora_delotro";
    const t = await original;
    expect(t).toBe("kora_delotro");
    expect(guardado).toBe("kora_delotro"); // y no se pisó
  });

  it("la escritura pide IGNORAR duplicados: es lo que impide pisar al ganador", async () => {
    await asegurarBotToken("h1");
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].ignoraDuplicados).toBe(true);
  });

  it("si tras generar sigue sin haber token, LANZA en vez de devolver uno falso", async () => {
    // Simula una base que acepta la escritura y no guarda nada: devolver un
    // token inventado dejaría al bot mudo sin que nadie se entere.
    const rota: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") return (res: (v: unknown) => void) => res({ data: null, error: null });
          return () => rota;
        },
      },
    );
    const admin = await import("@/lib/supabase/admin");
    vi.spyOn(admin, "createAdminClient").mockReturnValue(
      rota as ReturnType<typeof admin.createAdminClient>,
    );
    await expect(asegurarBotToken("h1")).rejects.toThrow(/sigue sin token/);
    vi.restoreAllMocks();
  });
});
