// Los días extra de prueba que Kora regala desde el CRM (15 sep 2026).
//
// «Dame una semana más» no tenía forma de concederse sin SQL. La tentación era
// mover `pruebas.inicio`, y eso es justo lo que no se puede hacer: el inicio es
// el ancla que cierra la prueba infinita (K-108) y moverlo hacia atrás VENCE la
// prueba de golpe. Los días extra van aparte y se SUMAN al final.
//
// Lo que se vigila aquí son las tres formas de romperlo:
//   1. Que sumar días cambie el inicio o las reglas de 30/14 de cada quien.
//   2. Que un dato raro (negativo, NaN, 3000 por un dedo) regale o quite días.
//   3. Que el CRM y el sistema calculen fechas distintas para el mismo hotel.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { pruebaDelHotel, finDePrueba, inicioDePrueba, PRUEBA_DIAS } from "@/lib/suscripcion";

const DIA = 86_400_000;
// Un «hoy» lo bastante posterior al cambio a 14 días (6 sep 2026) para que las
// altas de hace varias semanas ya tengan 14 y no 30.
const HOY = new Date("2026-10-20T12:00:00Z");
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(HOY); });
afterAll(() => { vi.useRealTimers(); });

const hace = (d: number) => new Date(HOY.getTime() - d * DIA).toISOString();
const LANZAMIENTO = Date.parse("2026-07-10T00:00:00-06:00");
// Alta de antes del cambio a 14 días (conserva 30).
const ANTES_DEL_CAMBIO = Date.parse("2026-08-20T12:00:00-06:00");

describe("sin días extra, nada cambia", () => {
  it("omitir el parámetro es lo mismo que pasar 0", () => {
    const a = pruebaDelHotel({ created_at: hace(5) });
    const b = pruebaDelHotel({ created_at: hace(5) }, null, 0);
    expect(a!.fin.getTime()).toBe(b!.fin.getTime());
  });

  it("un alta de hoy sigue teniendo PRUEBA_DIAS", () => {
    const p = pruebaDelHotel({ created_at: HOY.toISOString() });
    expect(p!.fin.getTime()).toBe(HOY.getTime() + PRUEBA_DIAS * DIA);
  });
});

describe("los días extra se suman al FINAL", () => {
  it("7 extra sobre un alta de hace 5 días: le quedan 16", () => {
    const p = pruebaDelHotel({ created_at: hace(5) }, null, 7);
    expect(p!.fin.getTime()).toBe(Date.parse(hace(5)) + (PRUEBA_DIAS + 7) * DIA);
    expect(p!.diasRestantes).toBe(PRUEBA_DIAS - 5 + 7);
  });

  // El caso por el que existe finDePrueba: una prueba vencida hace 10 días con
  // 14 extra NO arranca de cero, le quedan 4.
  it("una prueba vencida hace 10 días con 14 extra queda con 4 por delante", () => {
    const creado = hace(PRUEBA_DIAS + 10);
    expect(pruebaDelHotel({ created_at: creado })!.vencida).toBe(true);
    const p = pruebaDelHotel({ created_at: creado }, null, 14);
    expect(p!.vencida).toBe(false);
    expect(p!.diasRestantes).toBe(4);
  });

  it("con pocos extra, la vencida sigue vencida", () => {
    const p = pruebaDelHotel({ created_at: hace(PRUEBA_DIAS + 10) }, null, 3);
    expect(p!.vencida).toBe(true);
    expect(p!.diasRestantes).toBe(0);
  });

  it("quien entró con 30 días conserva sus 30 y los extra van encima", () => {
    const p = pruebaDelHotel({ created_at: new Date(ANTES_DEL_CAMBIO).toISOString() }, null, 10);
    expect(p!.fin.getTime()).toBe(ANTES_DEL_CAMBIO + (30 + 10) * DIA);
  });

  it("el ancla del dueño sigue mandando: los extra no reinician la prueba del hotel recreado", () => {
    // Hotel recreado hoy, pero su dueño empezó hace 40 días.
    const p = pruebaDelHotel({ created_at: HOY.toISOString() }, hace(40), 7);
    expect(p!.fin.getTime()).toBe(Date.parse(hace(40)) + (PRUEBA_DIAS + 7) * DIA);
    expect(p!.vencida).toBe(true);
  });

  it("el hotel demo sigue sin prueba, tenga los extra que tenga", () => {
    expect(pruebaDelHotel({ created_at: hace(5), extras: { demo: true } }, null, 30)).toBeNull();
  });
});

describe("un dato raro no regala ni quita días", () => {
  const base = () => pruebaDelHotel({ created_at: hace(5) })!.fin.getTime();

  it.each([
    ["negativo", -7],
    ["NaN", Number.NaN],
    ["infinito", Number.POSITIVE_INFINITY],
  ])("%s cuenta como 0", (_, valor) => {
    expect(pruebaDelHotel({ created_at: hace(5) }, null, valor)!.fin.getTime()).toBe(base());
  });

  it("los decimales se redondean hacia abajo (medio día no es un día)", () => {
    const p = pruebaDelHotel({ created_at: hace(5) }, null, 2.9);
    expect(p!.fin.getTime()).toBe(base() + 2 * DIA);
  });

  it("3000 por un dedo de más se queda en el tope de 365, igual que la base", () => {
    const p = pruebaDelHotel({ created_at: hace(5) }, null, 3000);
    expect(p!.fin.getTime()).toBe(base() + 365 * DIA);
  });
});

describe("el CRM calcula lo mismo que el sistema", () => {
  it("finDePrueba(inicioDePrueba(...)) es exactamente el fin de pruebaDelHotel", () => {
    for (const [creado, ancla, extra] of [
      [hace(3), null, 0],
      [hace(3), hace(20), 5],
      [new Date(ANTES_DEL_CAMBIO).toISOString(), null, 12],
      ["2026-01-01T00:00:00Z", null, 1],
    ] as const) {
      const p = pruebaDelHotel({ created_at: creado }, ancla, extra);
      expect(finDePrueba(inicioDePrueba(creado, ancla), extra).getTime()).toBe(p!.fin.getTime());
    }
  });

  it("finDePrueba aplica el mínimo del lanzamiento aunque le pasen la fecha cruda", () => {
    const crudo = Date.parse("2026-01-01T00:00:00Z");
    expect(finDePrueba(crudo, 0).getTime()).toBe(LANZAMIENTO + 30 * DIA);
  });

  it("inicioDePrueba toma la fecha más antigua y cae al lanzamiento sin datos", () => {
    expect(inicioDePrueba(hace(3), hace(9))).toBe(Date.parse(hace(9)));
    expect(inicioDePrueba(null, null)).toBe(LANZAMIENTO);
    expect(inicioDePrueba("basura", undefined)).toBe(LANZAMIENTO);
  });

  it("para dar «N días desde hoy», los extra salen de finDePrueba sin adivinar", () => {
    // Lo que hará el botón del CRM: prueba vencida, quiere 7 días desde hoy.
    const creado = hace(PRUEBA_DIAS + 10);
    const inicio = inicioDePrueba(creado, null);
    const finSinExtra = finDePrueba(inicio, 0).getTime();
    const extra = Math.ceil((HOY.getTime() + 7 * DIA - finSinExtra) / DIA);
    expect(pruebaDelHotel({ created_at: creado }, null, extra)!.diasRestantes).toBe(7);
  });
});
