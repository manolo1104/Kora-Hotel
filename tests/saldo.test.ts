// El saldo prepago del bot: qué cobra, qué NO cobra, y qué pasa cuando falla.
//
// Esto toca dinero de hoteles que ya están en producción, así que lo que se
// prueba aquí son las tres formas de hacer daño:
//
//  1. COBRAR DE MÁS — descontarle a un hotel por un mensaje que no escribió
//     Camila (el del huésped, el que el hotelero manda desde su móvil, el aviso
//     de «no puedo leer audios»), o cobrar dos veces el mismo.
//  2. CALLAR SIN MOTIVO — dejar mudo a un hotel porque la base tuvo un hipo.
//  3. AVISAR DE MÁS — mandarle al hotelero cinco correos idénticos porque cinco
//     mensajes cruzaron el umbral a la vez.
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── El doble de Supabase ─────────────────────────────────────────────────────

let saldoDeHotel: number | null = 300;
let errorDeLectura: { code?: string; message: string } | null = null;
let rpcs: { fn: string; args: Record<string, unknown> }[] = [];
/** Lo que devuelve cada RPC. Se ajusta por prueba. */
let respuestaRpc: (fn: string, args: Record<string, unknown>) => unknown = () => 299;

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(
              errorDeLectura
                ? { data: null, error: errorDeLectura }
                : { data: saldoDeHotel === null ? null : { mensajes: saldoDeHotel }, error: null },
            ),
        }),
        // `consumoDelMes` usa el conteo por cabecera.
        gte: () => Promise.resolve({ count: 90, error: null }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      return Promise.resolve({ data: respuestaRpc(fn, args), error: null });
    },
  }),
}));

const correosMandados: { to: string; subject: string }[] = [];
vi.mock("@/lib/email/resend", () => ({
  enviarEmail: (a: { to: string; subject: string }) => {
    correosMandados.push({ to: a.to, subject: a.subject });
    return Promise.resolve({ ok: true, id: "re_1" });
  },
  NOTIFY_EMAIL: "kora@test",
}));
vi.mock("@/lib/email/reserva", () => ({
  resolveHotelAvisoEmail: () => Promise.resolve("dueno@hotel.test"),
}));
const alertas: string[] = [];
vi.mock("@/lib/alertas", () => ({ alertar: (a: string) => { alertas.push(a); return Promise.resolve(); } }));

const { leerSaldo, sinSaldo, consumirMensaje, SIN_DATO } = await import("@/lib/db/saldo");
const { cobrable, cobrarMensaje } = await import("@/lib/saldo/cobro");
const { paquetePorMxn, PAQUETES, diasQueAlcanzan, MINIMO_MXN } = await import("@/lib/saldo/paquetes");

const HOTEL = { id: "h1", slug: "hotel-san-luis", nombre: "Hotel San Luis", owner_id: "u1" };

beforeEach(() => {
  saldoDeHotel = 300;
  errorDeLectura = null;
  rpcs = [];
  correosMandados.length = 0;
  alertas.length = 0;
  respuestaRpc = () => 299;
});

// ── 1. QUÉ COBRA Y QUÉ NO ────────────────────────────────────────────────────
//
// Las cinco formas reales que tiene `log-conv` en `agentes/camila/index.js`.
// Sólo la primera costó una llamada al modelo.

describe("sólo se cobra una respuesta que generó el modelo", () => {
  it("el turno real de Camila SÍ cobra", () => {
    expect(
      cobrable(true, [
        { rol: "user", texto: "¿tienen cuarto el sábado?" },
        { rol: "assistant", texto: "¡Claro! Nos queda la Suite Jungla." },
      ]),
    ).toBe(true);
  });

  it("lo que el hotelero escribe desde su teléfono NO cobra", () => {
    // `index.js:message_create` — lleva `por:"hotel"`.
    expect(cobrable(true, [{ rol: "assistant", texto: "Ahorita te digo", por: "hotel" }])).toBe(false);
  });

  it("el aviso de «no puedo leer audios» NO cobra", () => {
    // Ese camino no manda `cobrar`: es texto fijo, no llama al modelo.
    expect(cobrable(undefined, [{ rol: "assistant", texto: "Me llegó tu nota de voz…" }])).toBe(false);
  });

  it("guardar sólo el mensaje del huésped NO cobra", () => {
    expect(cobrable(true, [{ rol: "user", texto: "[el huésped mandó una foto]" }])).toBe(false);
  });

  it("una respuesta vacía NO cobra", () => {
    expect(cobrable(true, [{ rol: "assistant", texto: "   " }])).toBe(false);
  });

  // El `cobrar` lo pone el runtime; la forma del turno se comprueba en el
  // servidor. Hacen falta las dos: un runtime con un bug no puede cobrarle a un
  // hotel por el mensaje de un huésped.
  it("un `cobrar` suelto sin respuesta de Camila no basta", () => {
    expect(cobrable(true, [{ rol: "user", texto: "hola" }])).toBe(false);
    expect(cobrable(true, [])).toBe(false);
    expect(cobrable("sí" as unknown, [{ rol: "assistant", texto: "hola" }])).toBe(false);
  });
});

// ── 2. NO CALLAR SIN MOTIVO ──────────────────────────────────────────────────

describe("fail-open: un hipo de la base no calla a Camila", () => {
  it("si la lectura falla, el bot sigue contestando", async () => {
    errorDeLectura = { code: "57014", message: "canceling statement due to statement timeout" };
    const s = await leerSaldo("h1");
    expect(s.conocido).toBe(false);
    expect(sinSaldo(s)).toBe(false);
  });

  it("si el SQL no está corrido, el bot sigue contestando", async () => {
    errorDeLectura = { code: "42P01", message: 'relation "saldo_bot" does not exist' };
    expect(sinSaldo(await leerSaldo("h1"))).toBe(false);
  });

  it("un hotel SIN fila de saldo NO se bloquea", async () => {
    // Un regalo que no se aplicó no puede dejar mudo a un hotel que paga.
    saldoDeHotel = null;
    const s = await leerSaldo("h1");
    expect(s.mensajes).toBe(SIN_DATO);
    expect(sinSaldo(s)).toBe(false);
  });

  it("cero SÍ calla, y sólo cuando se leyó bien", async () => {
    saldoDeHotel = 0;
    expect(sinSaldo(await leerSaldo("h1"))).toBe(true);
    saldoDeHotel = 1;
    expect(sinSaldo(await leerSaldo("h1"))).toBe(false);
  });
});

describe("cobrar de menos antes que de más", () => {
  it("si el cobro falla, el mensaje sale gratis y nadie se entera por un error", async () => {
    respuestaRpc = () => { throw new Error("sin red"); };
    await expect(cobrarMensaje(HOTEL, "msg1")).resolves.toBeUndefined();
    expect(correosMandados).toHaveLength(0);
  });

  it("el `ref` del mensaje viaja al RPC, que es lo que impide el cobro doble", async () => {
    await cobrarMensaje(HOTEL, "false_5214811234567@c.us_ABC123");
    expect(rpcs[0]).toMatchObject({
      fn: "saldo_consumir",
      args: { p_hotel_id: "h1", p_ref: "false_5214811234567@c.us_ABC123" },
    });
  });

  it("sin `ref` se cobra igual: perder un cobro es peor que no tener el id", async () => {
    expect(await consumirMensaje("h1", "")).toBe(299);
    expect(rpcs[0].args.p_ref).toBe("");
  });
});

// ── 3. NO AVISAR DE MÁS ──────────────────────────────────────────────────────

describe("los correos de aviso", () => {
  it("con saldo de sobra no escribe a nadie", async () => {
    respuestaRpc = () => 299;
    await cobrarMensaje(HOTEL, "m1");
    expect(correosMandados).toHaveLength(0);
    expect(rpcs.map((r) => r.fn)).toEqual(["saldo_consumir"]); // ni siquiera reclama
  });

  it("al bajar del umbral avisa UNA vez, y sólo si la base le da el turno", async () => {
    respuestaRpc = (fn) => (fn === "saldo_consumir" ? 59 : true);
    await cobrarMensaje(HOTEL, "m1");
    expect(correosMandados).toHaveLength(1);
    expect(correosMandados[0].to).toBe("dueno@hotel.test");
    expect(correosMandados[0].subject).toContain("59 mensajes");
    expect(rpcs.find((r) => r.fn === "saldo_reclamar_aviso")?.args).toMatchObject({ p_cual: "bajo" });
  });

  it("si otro mensaje se adelantó, NO manda un segundo correo", async () => {
    // Es lo que pasa cuando tres mensajes cruzan el umbral a la vez: sólo uno
    // se lleva el `true` de `saldo_reclamar_aviso`.
    respuestaRpc = (fn) => (fn === "saldo_consumir" ? 58 : false);
    await cobrarMensaje(HOTEL, "m2");
    expect(correosMandados).toHaveLength(0);
  });

  it("al llegar a cero manda el de «se acabó», no el de «te queda poco»", async () => {
    respuestaRpc = (fn) => (fn === "saldo_consumir" ? 0 : true);
    await cobrarMensaje(HOTEL, "m3");
    expect(correosMandados).toHaveLength(1);
    expect(correosMandados[0].subject).toContain("se acabó el saldo");
    expect(rpcs.find((r) => r.fn === "saldo_reclamar_aviso")?.args).toMatchObject({ p_cual: "cero" });
  });

  it("un hotel sin fila de saldo no dispara ningún aviso", async () => {
    respuestaRpc = () => -1;
    await cobrarMensaje(HOTEL, "m4");
    expect(correosMandados).toHaveLength(0);
    expect(rpcs.map((r) => r.fn)).toEqual(["saldo_consumir"]);
  });
});

// ── 4. EL PRECIO NO SE PUEDE FALSIFICAR ──────────────────────────────────────

describe("los paquetes son una lista blanca", () => {
  it("un importe inventado no existe", () => {
    expect(paquetePorMxn(1)).toBeNull();
    expect(paquetePorMxn(99)).toBeNull();
    expect(paquetePorMxn("100")).toMatchObject({ mensajes: 300 });
    expect(paquetePorMxn(null)).toBeNull();
    expect(paquetePorMxn(Infinity)).toBeNull();
  });

  it("el mínimo son $100 = 300 mensajes, lo que se le prometió al cliente", () => {
    expect(MINIMO_MXN).toBe(100);
    expect(paquetePorMxn(100)?.mensajes).toBe(300);
  });

  it("todos los paquetes valen lo mismo por mensaje: nadie sale perdiendo", () => {
    const precios = PAQUETES.map((p) => p.mxn / p.mensajes);
    expect(new Set(precios.map((p) => p.toFixed(6))).size).toBe(1);
  });

  it("el precio cubre el coste con margen (coste real: $0.18 MXN/mensaje)", () => {
    // Si alguien baja el precio sin mirar, esto lo para.
    for (const p of PAQUETES) expect(p.mxn / p.mensajes).toBeGreaterThan(0.25);
  });
});

describe("cuántos días le duran", () => {
  it("sin consumo medido no se inventa un número", () => {
    expect(diasQueAlcanzan(300, 0)).toBeNull();
    expect(diasQueAlcanzan(300, NaN)).toBeNull();
  });
  it("con consumo, redondea hacia abajo (prometer de menos)", () => {
    expect(diasQueAlcanzan(300, 10)).toBe(30);
    expect(diasQueAlcanzan(59, 10)).toBe(5);
  });
  it("sin saldo, cero días", () => {
    expect(diasQueAlcanzan(0, 10)).toBe(0);
  });
});
