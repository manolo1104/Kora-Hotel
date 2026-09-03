// La política de cancelación: quién decide cuánto se devuelve.
//
// 🔴 EL DEFECTO QUE ESTO CIERRA. Había CUATRO modelos de datos para lo mismo y
// ninguno era el bueno: la regla estructurada (`cancelacionDias`) era la única
// que el código aplicaba, el texto libre era lo que el huésped leía, el PDF
// llevaba «7 días» quemado igual para todos los hoteles, y el generador de
// documentos de marketing tenía el único modelo con escalones… sin guardarse.
//
// Lo peor no era tener cuatro: era que en el motor **el texto libre GANABA para
// lo que el huésped aceptaba** mientras el enforcement aplicaba sólo la regla.
// El huésped aceptaba una cosa y el sistema hacía otra. Quien cancela a 5 días
// y ve negado su reembolso tiene la política del hotel por escrito a su favor —
// eso es un contracargo perdido, y lo pierde el hotel, no Kora.
//
// Estas pruebas fijan lo que no puede volver a moverse: que el texto SALGA de
// los escalones, y que el dinero salga de la misma función que el texto.
import { describe, it, expect } from "vitest";
import {
  politicaDe,
  saneaEscalones,
  reembolsoPorCancelar,
  fechaLimiteDevolucion,
  diasDeAntelacion,
  textoPolitica,
  DIAS_GRATIS_POR_DEFECTO,
  type Politica,
} from "@/lib/politica";

const ESCALONADA: Politica = {
  escalones: [
    { diasAntes: 7, reembolsoPct: 100 },
    { diasAntes: 3, reembolsoPct: 50 },
  ],
  noShowPct: 0,
};

describe("compatibilidad: ningún hotel se queda sin política", () => {
  it("un hotel que sólo tiene `cancelacionDias` obtiene lo mismo que tenía", () => {
    const p = politicaDe({ cancelacionDias: 2 });
    expect(p.escalones).toEqual([{ diasAntes: 2, reembolsoPct: 100 }]);
    expect(p.noShowPct).toBe(0);
  });

  it("sin nada configurado, el plazo por defecto es el de siempre", () => {
    expect(politicaDe({}).escalones).toEqual([
      { diasAntes: DIAS_GRATIS_POR_DEFECTO, reembolsoPct: 100 },
    ]);
  });

  it("`cancelacionDias: 0` significa que no hay cancelación gratis", () => {
    expect(politicaDe({ cancelacionDias: 0 }).escalones).toEqual([]);
  });

  it("los escalones, si existen, mandan sobre la regla vieja", () => {
    const p = politicaDe({ escalones: ESCALONADA.escalones, cancelacionDias: 2 });
    expect(p.escalones).toHaveLength(2);
    expect(p.escalones[0].diasAntes).toBe(7);
  });
});

describe("el saneado de escalones", () => {
  it("los ordena de MÁS antelación a menos", () => {
    // Si llegaran desordenados, un escalón de 2 días evaluado primero se comería
    // al de 7 y el huésped cobraría de menos.
    const e = saneaEscalones([
      { diasAntes: 3, reembolsoPct: 50 },
      { diasAntes: 7, reembolsoPct: 100 },
    ]);
    expect(e.map((x) => x.diasAntes)).toEqual([7, 3]);
  });

  it("con el mismo plazo dos veces gana el más generoso", () => {
    // Es el que el huésped podría reclamar por escrito.
    const e = saneaEscalones([
      { diasAntes: 7, reembolsoPct: 50 },
      { diasAntes: 7, reembolsoPct: 100 },
    ]);
    expect(e).toEqual([{ diasAntes: 7, reembolsoPct: 100 }]);
  });

  it("descarta la basura y acota los porcentajes imposibles", () => {
    expect(saneaEscalones("no es un array")).toEqual([]);
    expect(saneaEscalones([{ diasAntes: "x", reembolsoPct: 100 }])).toEqual([]);
    expect(saneaEscalones([{ diasAntes: 5, reembolsoPct: 900 }])).toEqual([
      { diasAntes: 5, reembolsoPct: 100 },
    ]);
    expect(saneaEscalones([{ diasAntes: -3, reembolsoPct: -50 }])).toEqual([
      { diasAntes: 0, reembolsoPct: 0 },
    ]);
  });
});

describe("cuánto se devuelve: la única función que decide dinero", () => {
  it("con mucha antelación, todo", () => {
    const r = reembolsoPorCancelar({ politica: ESCALONADA, checkin: "2026-10-20", hoy: "2026-10-01" });
    expect(r.pct).toBe(100);
    expect(r.regla).toBe("escalon");
  });

  it("EL CASO DEL HALLAZGO: a 5 días de llegar cae en el escalón del 50 %", () => {
    // Antes era binario: o cancelabas gratis o no cancelabas. El huésped que
    // leía «7 días 100 %, 3 días 50 %» y cancelaba a 5 se encontraba con que el
    // sistema aplicaba «gratis hasta 2 días» y le negaba todo.
    const r = reembolsoPorCancelar({ politica: ESCALONADA, checkin: "2026-10-20", hoy: "2026-10-15" });
    expect(r.pct).toBe(50);
  });

  it("pasado el último escalón, nada", () => {
    const r = reembolsoPorCancelar({ politica: ESCALONADA, checkin: "2026-10-20", hoy: "2026-10-19" });
    expect(r.pct).toBe(0);
    expect(r.regla).toBe("sin-plazo");
  });

  it("justo EN el día del escalón todavía cuenta", () => {
    // El borde es donde se pierden las reclamaciones. 7 días exactos = 100 %.
    expect(
      reembolsoPorCancelar({ politica: ESCALONADA, checkin: "2026-10-20", hoy: "2026-10-13" }).pct,
    ).toBe(100);
    expect(
      reembolsoPorCancelar({ politica: ESCALONADA, checkin: "2026-10-20", hoy: "2026-10-14" }).pct,
    ).toBe(50);
  });

  it("la tarifa no reembolsable no devuelve nada, ni con un mes de antelación", () => {
    const r = reembolsoPorCancelar({
      politica: ESCALONADA, checkin: "2026-12-20", hoy: "2026-10-01", ratePlan: "nrf",
    });
    expect(r.pct).toBe(0);
    expect(r.regla).toBe("no-reembolsable");
  });

  it("LA QUINTA REGLA, que no estaba escrita: si cancela el HOTEL, se devuelve todo", () => {
    // Vivía como un `reembolsable: true` suelto en dos rutas del panel, sin
    // aparecer en ninguna documentación al huésped. Es correcto —la culpa es del
    // hotel— pero tenía que ser un caso explícito.
    const r = reembolsoPorCancelar({
      politica: ESCALONADA, checkin: "2026-10-20", hoy: "2026-10-19",
      ratePlan: "nrf", origen: "hotel",
    });
    expect(r.pct).toBe(100);
    expect(r.regla).toBe("cancela-el-hotel");
  });

  it("el no-show usa su propio porcentaje", () => {
    const r = reembolsoPorCancelar({
      politica: { ...ESCALONADA, noShowPct: 0 }, checkin: "2026-10-20", hoy: "2026-10-20", noShow: true,
    });
    expect(r.pct).toBe(0);
    expect(r.regla).toBe("no-show");
  });

  it("una política sin escalones no devuelve nunca", () => {
    const r = reembolsoPorCancelar({
      politica: { escalones: [], noShowPct: 0 }, checkin: "2026-12-20", hoy: "2026-10-01",
    });
    expect(r.pct).toBe(0);
  });
});

describe("la fecha límite y la antelación", () => {
  it("la fecha límite es la del escalón MENOS generoso que aún devuelve algo", () => {
    expect(fechaLimiteDevolucion(ESCALONADA, "2026-10-20")).toBe("2026-10-17");
  });

  it("sin devolución posible, no hay fecha límite", () => {
    expect(fechaLimiteDevolucion({ escalones: [], noShowPct: 0 }, "2026-10-20")).toBeNull();
    expect(
      fechaLimiteDevolucion({ escalones: [{ diasAntes: 5, reembolsoPct: 0 }], noShowPct: 0 }, "2026-10-20"),
    ).toBeNull();
  });

  it("cruza el cambio de mes sin descuadrarse", () => {
    expect(diasDeAntelacion("2026-11-02", "2026-10-30")).toBe(3);
    expect(fechaLimiteDevolucion(ESCALONADA, "2026-11-02")).toBe("2026-10-30");
  });

  it("un check-in que ya pasó da antelación negativa, no cero", () => {
    expect(diasDeAntelacion("2026-10-10", "2026-10-15")).toBe(-5);
  });
});

describe("el texto SALE de los escalones, no al revés", () => {
  it("dice exactamente lo que el sistema va a hacer", () => {
    const t = textoPolitica(ESCALONADA);
    expect(t).toContain("7 días");
    expect(t).toContain("50%");
    expect(t).toContain("3 días");
  });

  it("una política simple se lee como siempre se leyó", () => {
    // La frase empieza con mayúscula al ser el inicio del texto, así que se
    // compara sin distinguirla: lo que importa es el contenido.
    expect(textoPolitica(politicaDe({ cancelacionDias: 2 })).toLowerCase()).toContain(
      "cancelación gratis hasta 2 días antes de llegar",
    );
  });

  it("el singular no dice «1 días»", () => {
    expect(textoPolitica(politicaDe({ cancelacionDias: 1 }))).toContain("1 día antes");
    expect(textoPolitica(politicaDe({ cancelacionDias: 1 }))).not.toContain("1 días");
  });

  it("sin cancelación posible lo dice claro, no se calla", () => {
    const t = textoPolitica({ escalones: [], noShowPct: 0 });
    expect(t).toMatch(/no admite cancelación/i);
  });

  it("la nota del hotelero se AÑADE, nunca sustituye", () => {
    // Es lo que invierte la precedencia vieja: antes el texto libre tapaba la
    // regla y por eso podían contradecirse.
    const t = textoPolitica({ ...ESCALONADA, nota: "Escríbenos si es una urgencia." });
    expect(t).toContain("7 días");
    expect(t).toContain("Escríbenos si es una urgencia.");
  });

  it("también habla inglés, con la misma estructura", () => {
    const t = textoPolitica(ESCALONADA, "en");
    expect(t).toContain("7 days");
    expect(t).toContain("50%");
    expect(t).not.toMatch(/días/);
  });
});
