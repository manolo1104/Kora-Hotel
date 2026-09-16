// Los interruptores del prepago, leídos de la base (lib/saldo/fases.ts).
//
// Hasta el 15 sep 2026 eran variables de entorno. Moverlos a la base abre un
// riesgo nuevo que no existía: que la LECTURA falle. Una variable de entorno no
// tiene hipos; Supabase sí. Lo que se vigila aquí es la dirección de ese fallo:
//
//   · Tabla o fila ausente → las variables de siempre, tal cual (incluido un
//     SALDO_BLOQUEO=1 que ya estuviera puesto: nada cambia por correr el SQL).
//   · Lectura rota → el bloqueo APAGADO. Un parpadeo de la base no puede dejar
//     mudo el WhatsApp de todos los hoteles a la vez.
//   · Y nunca se calla a nadie sin la recarga abierta (candado de lectura).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Resp = { data: unknown; error: { code?: string; message: string } | null };
let lectura: Resp = { data: null, error: null };
let upserts: unknown[] = [];
let errorUpsert: { code?: string; message: string } | null = null;
let lecturas = 0;

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            lecturas++;
            return lectura;
          },
        }),
      }),
      upsert: async (fila: unknown) => {
        upserts.push(fila);
        return { error: errorUpsert };
      },
    }),
  }),
}));

const { fasesSaldo, recargaAbierta, bloqueoEncendido, guardarFasesSaldo, invalidarCacheFases } = await import(
  "@/lib/saldo/fases"
);

const ENV_ORIGINAL = { recarga: process.env.SALDO_RECARGA, bloqueo: process.env.SALDO_BLOQUEO };

beforeEach(() => {
  invalidarCacheFases();
  lectura = { data: null, error: null };
  upserts = [];
  errorUpsert = null;
  lecturas = 0;
  delete process.env.SALDO_RECARGA;
  delete process.env.SALDO_BLOQUEO;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (ENV_ORIGINAL.recarga === undefined) delete process.env.SALDO_RECARGA;
  else process.env.SALDO_RECARGA = ENV_ORIGINAL.recarga;
  if (ENV_ORIGINAL.bloqueo === undefined) delete process.env.SALDO_BLOQUEO;
  else process.env.SALDO_BLOQUEO = ENV_ORIGINAL.bloqueo;
});

describe("mientras nadie toque el botón, manda lo de siempre", () => {
  it("sin fila y sin variables: todo apagado, fuente entorno", async () => {
    expect(await fasesSaldo()).toEqual({ recarga: false, bloqueo: false, fuente: "entorno", actualizado: null });
  });

  it("sin fila y con las dos variables puestas: las respeta", async () => {
    process.env.SALDO_RECARGA = "1";
    process.env.SALDO_BLOQUEO = "1";
    expect(await bloqueoEncendido()).toBe(true);
  });

  it("sin la TABLA (SQL sin correr): igual que sin fila", async () => {
    process.env.SALDO_RECARGA = "1";
    process.env.SALDO_BLOQUEO = "1";
    lectura = { data: null, error: { code: "42P01", message: 'relation "kora_ajustes" does not exist' } };
    const f = await fasesSaldo();
    expect(f.fuente).toBe("entorno");
    expect(f.bloqueo).toBe(true);
  });
});

describe("con la fila guardada desde el CRM", () => {
  it("manda la base, no las variables", async () => {
    process.env.SALDO_RECARGA = "1";
    process.env.SALDO_BLOQUEO = "1";
    lectura = { data: { valor: { recarga: true, bloqueo: false }, updated_at: "2026-09-15T18:00:00Z" }, error: null };
    expect(await fasesSaldo()).toEqual({
      recarga: true,
      bloqueo: false,
      fuente: "base",
      actualizado: "2026-09-15T18:00:00Z",
    });
    expect(await bloqueoEncendido()).toBe(false);
  });

  it("sólo `true` de verdad enciende algo (un \"true\" de texto, no)", async () => {
    lectura = { data: { valor: { recarga: "true", bloqueo: 1 }, updated_at: null }, error: null };
    expect(await recargaAbierta()).toBe(false);
    expect(await bloqueoEncendido()).toBe(false);
  });
});

describe("una lectura ROTA nunca calla a Camila", () => {
  it("error de red con SALDO_BLOQUEO=1 en el entorno: bloqueo apagado", async () => {
    process.env.SALDO_RECARGA = "1";
    process.env.SALDO_BLOQUEO = "1";
    lectura = { data: null, error: { code: "08006", message: "connection failure" } };
    const f = await fasesSaldo();
    expect(f.bloqueo).toBe(false);
    expect(f.recarga).toBe(true);
    expect(await bloqueoEncendido()).toBe(false);
  });

  it("una fila con basura en `valor`: bloqueo apagado", async () => {
    process.env.SALDO_RECARGA = "1";
    process.env.SALDO_BLOQUEO = "1";
    lectura = { data: { valor: "encendido", updated_at: null }, error: null };
    expect(await bloqueoEncendido()).toBe(false);
  });
});

describe("el candado de lectura", () => {
  it("bloqueo guardado sin recarga: NO cuenta como encendido", async () => {
    lectura = { data: { valor: { recarga: false, bloqueo: true }, updated_at: null }, error: null };
    const f = await fasesSaldo();
    expect(f.bloqueo).toBe(true); // el dato crudo se enseña tal cual…
    expect(await bloqueoEncendido()).toBe(false); // …pero no calla a nadie
  });

  it("lo mismo con las variables de entorno mal puestas", async () => {
    process.env.SALDO_BLOQUEO = "1";
    expect(await bloqueoEncendido()).toBe(false);
  });
});

describe("la caché", () => {
  it("dentro de 60 s no vuelve a leer la base", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    await fasesSaldo();
    await fasesSaldo();
    expect(lecturas).toBe(1);
    vi.setSystemTime(new Date("2026-09-15T12:01:01Z"));
    await fasesSaldo();
    expect(lecturas).toBe(2);
  });

  it("tras un fallo reintenta antes (10 s), para no dejar el respaldo un minuto", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));
    lectura = { data: null, error: { message: "timeout" } };
    await fasesSaldo();
    vi.setSystemTime(new Date("2026-09-15T12:00:11Z"));
    await fasesSaldo();
    expect(lecturas).toBe(2);
  });

  it("guardar invalida la caché: la siguiente lectura va a la base", async () => {
    await fasesSaldo();
    lectura = { data: { valor: { recarga: true, bloqueo: false }, updated_at: null }, error: null };
    expect(await guardarFasesSaldo({ recarga: true, bloqueo: false })).toEqual({ ok: true });
    expect(upserts).toHaveLength(1);
    expect(await recargaAbierta()).toBe(true);
  });
});

describe("guardarFasesSaldo", () => {
  it("rechaza lo que no son booleanos, sin escribir", async () => {
    // @ts-expect-error — a propósito: lo que llegaría de un JSON mal formado.
    expect(await guardarFasesSaldo({ recarga: "1", bloqueo: false })).toEqual({ ok: false, error: "datos-invalidos" });
    expect(upserts).toHaveLength(0);
  });

  it("distingue «falta el SQL» de un fallo real", async () => {
    errorUpsert = { code: "PGRST205", message: "Could not find the table 'public.kora_ajustes'" };
    expect(await guardarFasesSaldo({ recarga: true, bloqueo: false })).toEqual({ ok: false, error: "falta-sql" });
    errorUpsert = { code: "57014", message: "canceling statement due to statement timeout" };
    expect(await guardarFasesSaldo({ recarga: true, bloqueo: false })).toEqual({ ok: false, error: "no-guardado" });
  });
});
