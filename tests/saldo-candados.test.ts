// Los candados del prepago de Camila en el CRM (lib/saldo/candados.ts) y el
// contrato con el script que sustituyen (scripts/regalar-saldo.mjs).
//
// Desde el 15 sep 2026 los interruptores y los regalos a todos se mueven con
// botones en /crm/prepago. Un botón es más fácil de pulsar que un comando, así
// que lo que se vigila aquí son las formas de hacer daño con un clic:
//
//  1. CALLAR SIN SALIDA — encender el bloqueo con las recargas cerradas, o
//     cerrarlas con el bloqueo encendido.
//  2. CALLAR DE GOLPE — encender el bloqueo sin la recarga de seguridad, o sin
//     haber podido comprobarla.
//  3. REGALAR DOS VECES — que el CRM use otro `ref` que el script, y un regalo
//     hecho antes por la terminal no cuente.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  ETIQUETA_SEGURIDAD,
  MENSAJES_SEGURIDAD,
  MENSAJES_TODOS_MAX,
  efectivas,
  estadoSaldoHotel,
  etiquetaValida,
  evaluarCambioFases,
  mensajesTodosValidos,
  mudosSiSeEnciende,
  normalizarEtiqueta,
  pedidoAlTocar,
  planRegaloATodos,
  refDeRegalo,
  seguridadDelPrepago,
} from "@/lib/saldo/candados";

const lee = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), "utf8");

/** Sólo el código, sin comentarios: aquí se comprueba lo que HACE. */
const sinComentarios = (s: string) =>
  s
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/*"))
    .join("\n");

const APAGADO = { recarga: false, bloqueo: false };
const RECARGA = { recarga: true, bloqueo: false };
const TODO = { recarga: true, bloqueo: true };
const INSTALADO_Y_SEGURO = { saldoInstalado: true, seguridad: { leida: true, faltan: 0 } };

// ── 1 y 2. Los interruptores ─────────────────────────────────────────────────

describe("no se calla a nadie sin forma de recargar", () => {
  it("no se enciende el bloqueo si las recargas quedan cerradas", () => {
    const v = evaluarCambioFases({ actual: APAGADO, pedido: { recarga: false, bloqueo: true }, ...INSTALADO_Y_SEGURO });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toMatch(/abre las recargas/);
  });

  it("no se cierran las recargas con el bloqueo encendido: primero se apaga el bloqueo", () => {
    for (const pedido of [APAGADO, { recarga: false, bloqueo: true }]) {
      const v = evaluarCambioFases({ actual: TODO, pedido, ...INSTALADO_Y_SEGURO });
      expect(v.ok).toBe(false);
      expect(!v.ok && v.motivo).toMatch(/Primero apaga/);
    }
  });

  it("apagar el bloqueo pasa siempre, aunque no se pueda leer nada", () => {
    expect(
      evaluarCambioFases({
        actual: TODO,
        pedido: RECARGA,
        saldoInstalado: false,
        seguridad: { leida: false, faltan: 99 },
      }),
    ).toEqual({ ok: true });
  });

  it("cerrar las recargas con el bloqueo ya apagado sí se puede", () => {
    expect(evaluarCambioFases({ actual: RECARGA, pedido: APAGADO, ...INSTALADO_Y_SEGURO })).toEqual({ ok: true });
  });
});

describe("no se calla a nadie de golpe", () => {
  it("sin la recarga de seguridad en TODOS los hoteles con saldo, no", () => {
    const v = evaluarCambioFases({
      actual: RECARGA,
      pedido: TODO,
      saldoInstalado: true,
      seguridad: { leida: true, faltan: 1 },
    });
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toMatch(/Falta la recarga de seguridad en 1 hotel\./);
  });

  it("si no se pudo comprobar, tampoco: un «no pude leer» no es un «está hecha»", () => {
    const v = evaluarCambioFases({
      actual: RECARGA,
      pedido: TODO,
      saldoInstalado: true,
      seguridad: { leida: false, faltan: 0 },
    });
    expect(v.ok).toBe(false);
  });

  it("con la recarga de seguridad hecha y las recargas abiertas, sí", () => {
    expect(evaluarCambioFases({ actual: RECARGA, pedido: TODO, ...INSTALADO_Y_SEGURO })).toEqual({ ok: true });
  });

  it("abrir recargas y encender el bloqueo en la misma petición exige lo mismo", () => {
    expect(
      evaluarCambioFases({ actual: APAGADO, pedido: TODO, saldoInstalado: true, seguridad: { leida: true, faltan: 2 } }).ok,
    ).toBe(false);
    expect(evaluarCambioFases({ actual: APAGADO, pedido: TODO, ...INSTALADO_Y_SEGURO }).ok).toBe(true);
  });

  it("sin el prepago instalado no se enciende nada", () => {
    for (const [actual, pedido] of [
      [APAGADO, RECARGA],
      [RECARGA, TODO],
    ] as const) {
      const v = evaluarCambioFases({ actual, pedido, saldoInstalado: false, seguridad: { leida: true, faltan: 0 } });
      expect(v.ok).toBe(false);
      expect(!v.ok && v.motivo).toMatch(/kora-saldo-bot\.sql/);
    }
  });

  it("un bloqueo guardado SIN recargas cuenta como apagado: encenderlo de verdad pide el candado", () => {
    // Lo que puede dejar una variable de entorno mal puesta.
    const raro = { recarga: false, bloqueo: true };
    expect(efectivas(raro)).toEqual(APAGADO);
    const v = evaluarCambioFases({
      actual: raro,
      pedido: TODO,
      saldoInstalado: true,
      seguridad: { leida: true, faltan: 3 },
    });
    expect(v.ok).toBe(false);
  });
});

describe("tocar un interruptor cambia sólo ese interruptor", () => {
  it("abrir recargas no arrastra un bloqueo guardado a medias", () => {
    // Si se partiera del dato crudo, esto guardaría {recarga:true, bloqueo:true}
    // y callaría a Camila sin que nadie tocara ese botón.
    expect(pedidoAlTocar({ recarga: false, bloqueo: true }, "recarga")).toEqual(RECARGA);
  });

  it("cada botón invierte lo efectivo", () => {
    expect(pedidoAlTocar(APAGADO, "recarga")).toEqual(RECARGA);
    expect(pedidoAlTocar(RECARGA, "bloqueo")).toEqual(TODO);
    expect(pedidoAlTocar(TODO, "bloqueo")).toEqual(RECARGA);
    expect(pedidoAlTocar(TODO, "recarga")).toEqual({ recarga: false, bloqueo: true }); // …que el candado rechaza
  });
});

// ── La recarga de seguridad ──────────────────────────────────────────────────

describe("la recarga de seguridad", () => {
  it("sólo cuenta a los hoteles con fila: a uno fuera del prepago nunca se le calla", () => {
    const s = seguridadDelPrepago(["h1", "h2", "h3"], new Set(["h1", "h3", "h-sin-fila"]));
    expect(s).toEqual({ leida: true, total: 3, faltan: ["h2"] });
  });

  it("sin hoteles con saldo no falta nada", () => {
    expect(seguridadDelPrepago([], new Set())).toEqual({ leida: true, total: 0, faltan: [] });
  });

  it("los que se callarían al encender: sólo los que están en cero", () => {
    expect(mudosSiSeEnciende([{ mensajes: 0 }, { mensajes: 1 }, { mensajes: 300 }, { mensajes: 0 }])).toBe(2);
    expect(mudosSiSeEnciende([])).toBe(0);
  });

  it("regala lo mismo que el script por defecto", () => {
    expect(MENSAJES_SEGURIDAD).toBe(300);
  });
});

// ── 3. Regalar dos veces ─────────────────────────────────────────────────────

describe("el CRM y el script usan el MISMO `ref`", () => {
  const script = lee("scripts/regalar-saldo.mjs");

  it("formato `regalo-<etiqueta>`, tipo `regalo`", () => {
    expect(script).toContain("p_ref: `regalo-${ETIQUETA}`");
    expect(script).toContain('p_tipo: "regalo"');
    expect(refDeRegalo("antes-del-bloqueo")).toBe("regalo-antes-del-bloqueo");
    expect(refDeRegalo("arranque-2026-09")).toBe("regalo-arranque-2026-09");
  });

  it("la etiqueta de la recarga de seguridad es la que documenta el script", () => {
    expect(script).toContain(`--todos --etiqueta ${ETIQUETA_SEGURIDAD}`);
  });

  it("la ruta acredita con ese `ref` y con tipo `regalo`", () => {
    const ruta = sinComentarios(lee("app/api/crm/saldo/route.ts"));
    const lib = sinComentarios(lee("lib/saldo/prepago-crm.ts"));
    expect(ruta).toContain("const ref = refDeRegalo(etiqueta);");
    expect(ruta).toContain("aplicarRegaloATodos(plan.tocan, mensajes, ref)");
    expect(lib).toContain('acreditarMensajes(hotel.id, mensajes, ref, "regalo")');
  });
});

describe("la etiqueta", () => {
  it("minúsculas, números y guiones", () => {
    for (const ok of ["antes-del-bloqueo", "disculpa-sep", "arranque-2026-09", "abc"]) {
      expect(etiquetaValida(ok), ok).toBe(true);
    }
    for (const mal of ["", "ab", "Disculpa", "con espacio", "-empieza", "acaba-", "doble--guion", "señal", "a_b", 42, null, "x".repeat(61)]) {
      expect(etiquetaValida(mal), String(mal)).toBe(false);
    }
  });

  it("la pantalla normaliza lo que se teclea, pero no inventa letras", () => {
    expect(normalizarEtiqueta("  Disculpa Septiembre ")).toBe("disculpa-septiembre");
    expect(normalizarEtiqueta("a__b  c")).toBe("a-b-c");
    expect(etiquetaValida(normalizarEtiqueta("señal"))).toBe(false);
  });

  it("los mensajes son enteros con tope", () => {
    expect(mensajesTodosValidos(300)).toBe(true);
    expect(mensajesTodosValidos(MENSAJES_TODOS_MAX)).toBe(true);
    for (const mal of [0, -1, 1.5, MENSAJES_TODOS_MAX + 1, "300", NaN]) {
      expect(mensajesTodosValidos(mal), String(mal)).toBe(false);
    }
  });
});

describe("a quién le toca un regalo a todos", () => {
  it("a todos menos a quien ya tiene ese `ref`", () => {
    const hoteles = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const plan = planRegaloATodos(hoteles, new Set(["b"]));
    expect(plan.tocan.map((h) => h.id)).toEqual(["a", "c"]);
    expect(plan.yaLoTenian.map((h) => h.id)).toEqual(["b"]);
  });
});

// ── La puerta está en el servidor ────────────────────────────────────────────

describe("la API aplica los candados, no sólo la pantalla", () => {
  const ruta = sinComentarios(lee("app/api/crm/saldo/route.ts"));

  it("escribir exige la guarda de mutación del CRM; leer, la sesión", () => {
    expect(ruta).toContain("await requireCrmMutacion(req)");
    expect(ruta).toContain("await requireCrmAuth()");
  });

  it("los candados se evalúan ANTES de guardar las fases", () => {
    const candado = ruta.indexOf("evaluarCambioFases(");
    const guardar = ruta.indexOf("guardarFasesSaldo(pedido)");
    expect(candado).toBeGreaterThan(-1);
    expect(guardar).toBeGreaterThan(-1);
    expect(candado).toBeLessThan(guardar);
    expect(ruta).toContain("if (!veredicto.ok)");
  });

  it("el ensayo responde ANTES de acreditar nada", () => {
    const ensayo = ruta.indexOf("if (ensayo)");
    const aplicar = ruta.indexOf("aplicarRegaloATodos(");
    expect(ensayo).toBeGreaterThan(-1);
    expect(ensayo).toBeLessThan(aplicar);
  });

  it("todo queda en la bitácora", () => {
    expect(ruta).toContain('accion: "saldo.fases"');
    expect(ruta).toContain('accion: "saldo.regalar_todos"');
  });
});

// ── 4. Un fallo de lectura no se pinta como un dato ──────────────────────────
//
// «Fuera del prepago» es una afirmación: «nunca se le acreditó nada, así que a
// este hotel no se le calla por saldo». Si la lectura de `saldo_bot` falla, TODOS
// los hoteles llegan con `mensajes: null`; pintarlos así sería afirmar eso de
// todos a la vez, y esta es la pantalla desde la que se decide callar a Camila.

describe("el silencio y el cero se ven distintos en la tabla", () => {
  it("con el saldo leído: un número es un número, y un null es «fuera del prepago»", () => {
    expect(estadoSaldoHotel(300, true)).toBe("numero");
    expect(estadoSaldoHotel(0, true)).toBe("numero");
    expect(estadoSaldoHotel(null, true)).toBe("fuera");
  });

  it("sin el saldo leído: no se afirma nada de nadie", () => {
    expect(estadoSaldoHotel(null, false)).toBe("sin-leer");
  });

  it("la pantalla lo usa en vez de mirar el null a pelo", () => {
    const pantalla = lee("components/crm/Prepago.tsx");
    expect(pantalla).toContain("estadoSaldoHotel(m, datos.saldosLeidos)");
    expect(pantalla).toContain('estado === "sin-leer"');
    // Y los dos contadores de arriba tampoco inventan un total con la lista de
    // hoteles sin leer.
    expect(pantalla).toContain("datos.hotelesLeidos");
  });
});

describe("la pantalla no arrastra la service-role al navegador", () => {
  it("Prepago.tsx sólo importa módulos puros (o tipos)", () => {
    const pantalla = lee("components/crm/Prepago.tsx");
    for (const m of ["@/lib/saldo/prepago-crm", "@/lib/saldo/fases", "@/lib/crm/fuentes", "@/lib/supabase/admin", "@/lib/db/saldo"]) {
      expect(pantalla, m).not.toContain(`from "${m}"`);
    }
  });

  it("candados.ts, que carga el navegador, sólo trae TIPOS de lo de servidor", () => {
    const c = lee("lib/saldo/candados.ts");
    expect(c).toContain('import type { FasesSaldo } from "@/lib/saldo/fases"');
    expect(c).not.toMatch(/^import \{[^}]*\} from "@\/lib\/(saldo\/fases|saldo\/prepago-crm|db\/|supabase\/|crm\/fuentes)/m);
  });
});
