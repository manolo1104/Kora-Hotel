// `publicado` se respetaba en 5 superficies y se ignoraba en 7: el motor de un
// hotel DESPUBLICADO seguía cobrando con tarjeta (K-124, K-158). Despublicar es
// la forma que tiene un hotelero de decir "esto no está al público".
//
// La clave del diseño: `publicado` NO entra dentro de `activo`. Un hotel recién
// creado está sin publicar mientras lo montan y su dueño tiene que poder usar el
// panel entero; lo que no puede es COBRAR.
import { describe, it, expect, vi, beforeEach } from "vitest";

let fila: { estado: string } | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fila, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/db/prueba-dueno", () => ({ inicioPruebaDelDueno: async () => null }));
vi.mock("@/lib/alertas", () => ({ alertar: async () => {} }));

const { accesoDelHotel } = await import("@/lib/suscripcion");

const HOY = new Date("2026-08-26T12:00:00Z");
const hace = (d: number) => new Date(HOY.getTime() - d * 86_400_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
  fila = null;
});

describe("un hotel que PAGA", () => {
  beforeEach(() => { fila = { estado: "activa" }; });

  it("publicado: opera y cobra", async () => {
    const a = await accesoDelHotel({ owner_id: "u1", created_at: hace(200), publicado: true });
    expect(a.activo).toBe(true);
    expect(a.puedeCobrar).toBe(true);
  });

  // EL CASO QUE CERRAMOS: paga, su panel funciona, pero su sitio está apagado.
  it("DESPUBLICADO: su panel sigue vivo pero NO puede cobrar", async () => {
    const a = await accesoDelHotel({ owner_id: "u1", created_at: hace(200), publicado: false });
    expect(a.activo).toBe(true); // el dueño no pierde su panel
    expect(a.publicado).toBe(false);
    expect(a.puedeCobrar).toBe(false); // pero la caja está cerrada
  });
});

describe("un hotel en PRUEBA vigente", () => {
  it("publicado: cobra", async () => {
    const a = await accesoDelHotel({ owner_id: "u1", created_at: hace(5), publicado: true });
    expect(a.puedeCobrar).toBe(true);
  });
  it("despublicado: no cobra", async () => {
    const a = await accesoDelHotel({ owner_id: "u1", created_at: hace(5), publicado: false });
    expect(a.activo).toBe(true);
    expect(a.puedeCobrar).toBe(false);
  });
});

describe("los casos que ya estaban cerrados siguen cerrados", () => {
  it("prueba vencida y publicado: ni opera ni cobra", async () => {
    const a = await accesoDelHotel({ owner_id: "u1", created_at: hace(200), publicado: true });
    expect(a.activo).toBe(false);
    expect(a.puedeCobrar).toBe(false);
  });

  it("cuenta bloqueada por Kora: nunca cobra, aunque esté publicado", async () => {
    fila = { estado: "activa" };
    const a = await accesoDelHotel({
      owner_id: "u1", created_at: hace(5), publicado: true,
      extras: { bloqueo: { activo: true, mensaje: "Falta de pago" } },
    });
    expect(a.bloqueado).toBe(true);
    expect(a.puedeCobrar).toBe(false);
  });
});

// Compatibilidad: quien no pasa `publicado` se comporta EXACTAMENTE como antes.
// Es lo que evita que este cambio apague nada por sorpresa.
describe("sin el dato de publicado", () => {
  it("se asume publicado y puedeCobrar sigue a activo", async () => {
    fila = { estado: "activa" };
    const a = await accesoDelHotel({ owner_id: "u1", created_at: hace(200) });
    expect(a.publicado).toBe(true);
    expect(a.puedeCobrar).toBe(a.activo);
  });
});
