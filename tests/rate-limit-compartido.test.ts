// El limitador por IP protege nueve rutas, y dos de ellas son lo bastante caras
// como para que valga la pena probarlo: `crm/login` (fuerza bruta contra la
// contraseña del fundador) y las dos rutas de IA (la factura de Anthropic).
//
// Hasta el paso 9.9 el contador vivía en la MEMORIA DEL PROCESO y Vercel levanta
// varias instancias: el tope real se multiplicaba por el número de instancias
// vivas y quien repartía sus peticiones lo esquivaba del todo. Ahora el contador
// está en Postgres (`sql/kora-e9-limitador-ip.sql`).
//
// Lo que estas pruebas cuidan NO es la aritmética del contador —eso lo hace
// Postgres— sino lo que pasa cuando la base falla. Un limitador que se cae
// abierto ante un parpadeo de la base es peor que no tenerlo, porque nadie se
// entera.
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({ rpc }),
}));

const { limitado, rateLimited, ipDe, limpiarLimitador } = await import("@/lib/api/rate-limit");

// Cada prueba usa su propio nombre de tope y su propia IP: el contador en
// memoria es un módulo compartido y vive entre pruebas.
let n = 0;
const nuevo = () => `t${++n}`;
const IP = "203.0.113.7";

// ⚠️ LAS LLAVES IMPORTAN. Con `beforeEach(() => rpc.mockReset())` el hook
// DEVUELVE el mock, vitest lo espera como si fuera una promesa, y en un mock
// cuya implementación lanza eso hace estallar el hook: el test falla con el
// error del mock aunque el código lo capture perfectamente. Costó un rato de
// depuración creer que el fallo estaba en el hook y no en `limitado`.
beforeEach(() => {
  rpc.mockReset();
});

/** Silencia `console.error` y devuelve el espía para poder comprobarlo. */
function callarError() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("limitado — el camino normal", () => {
  it("manda lo que diga Postgres, no lo que crea esta instancia", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    // El contador local va por 1 de 100: si mandara el local, esto sería false.
    expect(await limitado(nuevo(), IP, { max: 100, ventanaMs: 60_000 })).toBe(true);
  });

  it("convierte la ventana a segundos y compone la clave con el tope y la IP", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const nombre = nuevo();
    await limitado(nombre, IP, { max: 5, ventanaMs: 600_000 });
    expect(rpc).toHaveBeenCalledWith("rl_consumir", {
      p_clave: `${nombre}:${IP}`,
      p_max: 5,
      p_ventana_s: 600,
    });
  });

  it("nunca pide una ventana de 0 segundos (Postgres la rechazaría)", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await limitado(nuevo(), IP, { max: 3, ventanaMs: 200 });
    expect(rpc.mock.calls[0][1].p_ventana_s).toBe(1);
  });

  it("un `data` que no sea exactamente true no bloquea a nadie", async () => {
    // Si algún día la RPC devuelve null o un objeto raro, la respuesta correcta
    // es dejar pasar: bloquear por un valor que no entendemos deja al hotelero
    // sin formulario sin que nada lo explique.
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await limitado(nuevo(), IP, { max: 100, ventanaMs: 60_000 })).toBe(false);
  });
});

describe("limitado — cuando la base falla, cae al respaldo", () => {
  it("con la RPC caída sigue limitando con el contador en memoria", async () => {
    const err = callarError();
    rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "timeout" } });
    const nombre = nuevo();
    const opts = { max: 2, ventanaMs: 60_000 };
    expect(await limitado(nombre, IP, opts)).toBe(false); // 1
    expect(await limitado(nombre, IP, opts)).toBe(false); // 2
    expect(await limitado(nombre, IP, opts)).toBe(true); // 3 → se pasó
    err.mockRestore();
  });

  it("si la RPC lanza, tampoco se cae abierto", async () => {
    const err = callarError();
    rpc.mockImplementation(() => {
      throw new Error("ECONNRESET");
    });
    const nombre = nuevo();
    const opts = { max: 1, ventanaMs: 60_000 };
    expect(await limitado(nombre, IP, opts)).toBe(false);
    expect(await limitado(nombre, IP, opts)).toBe(true);
    err.mockRestore();
  });

  it("con el SQL sin correr (42883) no ensucia los registros", async () => {
    const err = callarError();
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "no existe" } });
    await limitado(nuevo(), IP, { max: 5, ventanaMs: 60_000 });
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  it("cualquier OTRO error sí se registra (si no, nadie se entera)", async () => {
    const err = callarError();
    rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "timeout" } });
    await limitado(nuevo(), IP, { max: 5, ventanaMs: 60_000 });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("el contador local se consume aunque Postgres conteste", async () => {
    // Si sólo se consumiera cuando la base falla, el respaldo empezaría de cero
    // justo en el momento en que hace falta — y el atacante tendría el tope
    // entero otra vez, gratis.
    rpc.mockResolvedValue({ data: false, error: null });
    const nombre = nuevo();
    const opts = { max: 1, ventanaMs: 60_000 };
    await limitado(nombre, IP, opts);
    await limitado(nombre, IP, opts);
    // Ahora la base cae: el local ya lleva 2 de 1.
    const err = callarError();
    rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "x" } });
    expect(await limitado(nombre, IP, opts)).toBe(true);
    err.mockRestore();
  });
});

describe("aislamiento entre topes e IPs", () => {
  it("agotar un tope no agota los otros", async () => {
    const err = callarError();
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "" } });
    const a = nuevo();
    const b = nuevo();
    const opts = { max: 1, ventanaMs: 60_000 };
    await limitado(a, IP, opts);
    expect(await limitado(a, IP, opts)).toBe(true);
    expect(await limitado(b, IP, opts)).toBe(false);
    err.mockRestore();
  });

  it("el tope de una IP no gasta el de otra", () => {
    const nombre = nuevo();
    const opts = { max: 1, ventanaMs: 60_000 };
    rateLimited(nombre, "198.51.100.1", opts);
    expect(rateLimited(nombre, "198.51.100.1", opts)).toBe(true);
    expect(rateLimited(nombre, "198.51.100.2", opts)).toBe(false);
  });
});

describe("limpiarLimitador", () => {
  it("devuelve cuántas filas borró", async () => {
    rpc.mockResolvedValue({ data: 42, error: null });
    expect(await limpiarLimitador()).toBe(42);
  });

  it("devuelve null en vez de reventar el cron que la llama", async () => {
    const err = callarError();
    rpc.mockImplementation(() => {
      throw new Error("caída");
    });
    expect(await limpiarLimitador()).toBe(null);
    err.mockRestore();
  });
});

describe("ipDe", () => {
  it("toma la primera IP de x-forwarded-for, que es la del visitante", () => {
    const req = new Request("https://kora-hotel.com", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" },
    });
    expect(ipDe(req)).toBe("203.0.113.7");
  });

  it("cae a x-real-ip si no hay x-forwarded-for", () => {
    const req = new Request("https://kora-hotel.com", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(ipDe(req)).toBe("203.0.113.9");
  });

  it("sin ninguna cabecera devuelve una clave fija, no una vacía", () => {
    // Con "" todas las peticiones sin cabecera compartirían la clave `nombre:`,
    // que es lo mismo, pero además rompería la validación de la RPC si la clave
    // acabara vacía.
    expect(ipDe(new Request("https://kora-hotel.com"))).toBe("desconocida");
  });
});
