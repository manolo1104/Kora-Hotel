// El correo más delicado que manda Kora: "no pudimos cobrarte".
//
// K-193 — el cron subía `avisos_dunning` en CADA pasada. Dos invocaciones el
// mismo día (un `curl` suelto, un redespliegue) le vaciaban los 3 avisos de
// golpe al cliente: la secuencia entera en unas horas.
// K-194 — la lista se leía al empezar y los correos salían en serie. Si el pago
// entraba a mitad del bucle, al cliente le llegaba "tu pago no pasó" DESPUÉS de
// haber pagado.
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Fila { id: string; user_id: string; avisos_dunning: number; ultimo_aviso_dunning?: string | null }

let filas: Fila[] = [];
let estadoAlReleer: Record<string, { estado: string; avisos_dunning: number }> = {};
let columnaExiste = true;
const correos: Array<{ to: string }> = [];
const escrituras: Array<{ id: string; patch: Record<string, unknown> }> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tabla(): any {
  const ctx: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select(cols: string) { ctx.op = "select"; ctx.cols = cols; return b; },
    update(patch: Record<string, unknown>) { ctx.op = "update"; ctx.patch = patch; return b; },
    eq(col: string, val: string) { ctx[col] = val; return b; },
    lt() { return b; },
    async maybeSingle() {
      return { data: estadoAlReleer[String(ctx.id)] ?? null, error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: (v: unknown) => any) {
      if (ctx.op === "update") {
        escrituras.push({ id: String(ctx.id), patch: ctx.patch as Record<string, unknown> });
        return res({ data: null, error: null });
      }
      if (!columnaExiste && String(ctx.cols).includes("ultimo_aviso_dunning")) {
        return res({ data: null, error: { code: "42703", message: "column does not exist" } });
      }
      return res({ data: filas, error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: () => tabla(),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@ejemplo.com` } }, error: null }) } },
  }),
}));
vi.mock("@/lib/email/resend", () => ({
  enviarEmail: async (a: { to: string }) => { correos.push(a); return { ok: true }; },
  NOTIFY_EMAIL: "",
}));
vi.mock("@/lib/email/templates", () => ({ emailPagoVencido: () => ({ subject: "s", html: "h" }) }));
vi.mock("@/lib/alertas", () => ({ alertar: async () => {} }));

const { GET } = await import("@/app/api/cron/dunning/route");

const HOY = new Date("2026-08-26T18:00:00Z"); // 12:00 en México
process.env.CRON_SECRET = "secreto";

function correr() {
  return GET(new Request("http://localhost/api/cron/dunning", {
    headers: { authorization: "Bearer secreto" },
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
  correos.length = 0;
  escrituras.length = 0;
  columnaExiste = true;
  filas = [{ id: "s1", user_id: "u1", avisos_dunning: 0, ultimo_aviso_dunning: null }];
  estadoAlReleer = { s1: { estado: "pago_vencido", avisos_dunning: 0 } };
});

describe("K-193 · no se le escribe dos veces el mismo día", () => {
  it("la primera pasada del día sí manda", async () => {
    const r = await (await correr()).json();
    expect(r.enviados).toBe(1);
    expect(correos).toHaveLength(1);
  });

  it("deja marcado el día en que escribió", async () => {
    await correr();
    expect(escrituras[0].patch).toMatchObject({ avisos_dunning: 1, ultimo_aviso_dunning: "2026-08-26" });
  });

  // LA REGRESIÓN QUE IMPORTA: la segunda pasada del mismo día no manda nada.
  it("la segunda pasada del mismo día NO manda", async () => {
    filas = [{ id: "s1", user_id: "u1", avisos_dunning: 1, ultimo_aviso_dunning: "2026-08-26" }];
    const r = await (await correr()).json();
    expect(r.enviados).toBe(0);
    expect(r.repetidos).toBe(1);
    expect(correos).toHaveLength(0);
  });

  it("al día siguiente sí vuelve a mandar", async () => {
    filas = [{ id: "s1", user_id: "u1", avisos_dunning: 1, ultimo_aviso_dunning: "2026-08-25" }];
    expect((await (await correr()).json()).enviados).toBe(1);
  });

  // Sin la columna se sigue trabajando, pero se dice en voz alta.
  it("si falta la columna, funciona sin guarda y lo declara", async () => {
    columnaExiste = false;
    const r = await (await correr()).json();
    expect(r.sinGuardaDeDia).toBe(true);
    expect(r.enviados).toBe(1);
    expect(escrituras[0].patch).not.toHaveProperty("ultimo_aviso_dunning");
  });
});

describe("K-194 · si ya pagó, no se le manda el correo", () => {
  it("pagó entre la lectura de la lista y su turno → no se le escribe", async () => {
    estadoAlReleer = { s1: { estado: "activa", avisos_dunning: 0 } };
    const r = await (await correr()).json();
    expect(r.enviados).toBe(0);
    expect(r.yaPagaron).toBe(1);
    expect(correos).toHaveLength(0);
  });

  it("otra pasada ya le agotó los avisos → tampoco", async () => {
    estadoAlReleer = { s1: { estado: "pago_vencido", avisos_dunning: 3 } };
    expect((await (await correr()).json()).yaPagaron).toBe(1);
  });

  // El número de intento sale de lo RELEÍDO, no de la lista vieja.
  it("el intento se cuenta con el dato fresco", async () => {
    estadoAlReleer = { s1: { estado: "pago_vencido", avisos_dunning: 2 } };
    await correr();
    expect(escrituras[0].patch).toMatchObject({ avisos_dunning: 3 });
  });
});

describe("lo de siempre sigue en pie", () => {
  it("sin el secreto del cron, 401", async () => {
    const res = await GET(new Request("http://localhost/api/cron/dunning"));
    expect(res.status).toBe(401);
    expect(correos).toHaveLength(0);
  });
});
