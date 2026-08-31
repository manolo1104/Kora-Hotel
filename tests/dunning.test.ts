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

// Simula lo justo de PostgREST: un UPDATE con `.eq(...)` sólo toca la fila si
// TODAS las condiciones casan con el estado real, y con `.select()` devuelve las
// que tocó. Eso es lo que hace atómico el reclamo del aviso, así que el fake
// tiene que respetarlo o el test aprobaría un cron que manda correos de más.
// `estadoAlReleer` es "lo que hay en la BD ahora mismo", que puede haber cambiado
// desde que el cron leyó su lista.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tabla(): any {
  const ctx: Record<string, unknown> = {};
  let devuelveFilas = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select(cols: string) {
      if (ctx.op === "update") devuelveFilas = true;
      else { ctx.op = "select"; ctx.cols = cols; }
      return b;
    },
    update(patch: Record<string, unknown>) { ctx.op = "update"; ctx.patch = patch; return b; },
    eq(col: string, val: unknown) { ctx[col] = val; return b; },
    lt() { return b; },
    async maybeSingle() {
      return { data: estadoAlReleer[String(ctx.id)] ?? null, error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: (v: unknown) => any) {
      if (ctx.op === "update") {
        const real = estadoAlReleer[String(ctx.id)];
        // Las condiciones del WHERE, comparadas contra el estado real.
        const casa =
          Boolean(real) &&
          (!("estado" in ctx) || real.estado === ctx.estado) &&
          (!("avisos_dunning" in ctx) || real.avisos_dunning === ctx.avisos_dunning);
        if (casa) {
          escrituras.push({ id: String(ctx.id), patch: ctx.patch as Record<string, unknown> });
          // El UPDATE que gana deja el estado como lo escribió: así una segunda
          // pasada dentro del mismo test ya no encuentra la fila.
          const patch = ctx.patch as Record<string, unknown>;
          if (typeof patch.avisos_dunning === "number") {
            estadoAlReleer[String(ctx.id)] = { ...real, avisos_dunning: patch.avisos_dunning };
          }
        }
        return res({ data: devuelveFilas ? (casa ? [{ id: ctx.id }] : []) : null, error: null });
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

/** Pone la BD de acuerdo con la lista que el cron va a leer. */
function bdCoincideConLaLista() {
  estadoAlReleer = Object.fromEntries(
    filas.map((f) => [f.id, { estado: "pago_vencido", avisos_dunning: f.avisos_dunning }]),
  );
}

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
    bdCoincideConLaLista();
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

  // Si el contador cambió desde que se leyó la lista, el UPDATE condicionado no
  // casa y NO se manda nada: el cron de mañana lo hará con el dato bueno. Antes
  // el cron releía y mandaba igual, y dos pasadas simultáneas leían el mismo
  // número y mandaban el mismo aviso dos veces.
  it("si otra pasada ya subió el contador, no se manda y se reintenta mañana", async () => {
    estadoAlReleer = { s1: { estado: "pago_vencido", avisos_dunning: 2 } };
    const r = await (await correr()).json();
    expect(r.enviados).toBe(0);
    expect(r.yaPagaron).toBe(1);
    expect(correos).toHaveLength(0);
    expect(escrituras).toHaveLength(0);
  });

  // LA REGRESIÓN QUE IMPORTA de este paso: dos pasadas a la vez leen la misma
  // lista y sólo UNA gana la fila. Antes las dos mandaban el mismo aviso.
  it("dos pasadas simultáneas mandan UN solo correo", async () => {
    bdCoincideConLaLista();
    const [a, b] = await Promise.all([correr(), correr()]);
    const [ra, rb] = [await a.json(), await b.json()];
    expect(ra.enviados + rb.enviados).toBe(1);
    expect(correos).toHaveLength(1);
  });
});

describe("lo de siempre sigue en pie", () => {
  it("sin el secreto del cron, 401", async () => {
    const res = await GET(new Request("http://localhost/api/cron/dunning"));
    expect(res.status).toBe(401);
    expect(correos).toHaveLength(0);
  });
});
