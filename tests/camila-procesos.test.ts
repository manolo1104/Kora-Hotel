// El guardia que impide que el servidor de Camila se vuelva a quedar sin
// procesos. Nació del incidente del 21 sep 2026: el contenedor llegó a 1.001
// procesos con un tope de 1.000, no pudo abrir el navegador del hotel que paga,
// y cada reintento fallido dejaba restos que empeoraban el siguiente.
//
// Lo que estas pruebas protegen, en una frase: **sin sitio no se arranca**, y
// **si no se puede medir, no se estorba**.
import { describe, it, expect } from "vitest";
import {
  procesosDelContenedor,
  haySitioParaOtroNavegador,
  RESERVA_PIDS,
} from "../agentes/camila/procesos.js";

/**
 * Un lector de mentira del cgroup: devuelve lo que se le diga.
 *
 * El `as never` es porque el módulo declara su parámetro como el `readFileSync`
 * de Node entero (que acepta rutas, buffers y descriptores) y aquí sólo hacen
 * falta rutas de texto. Es del test, no del código de producción.
 */
function lector(valores: Record<string, string>) {
  return ((ruta: string) => {
    if (!(ruta in valores)) throw new Error("ENOENT");
    return valores[ruta];
  }) as never;
}

const MAX = "/sys/fs/cgroup/pids.max";
const USADOS = "/sys/fs/cgroup/pids.current";

describe("leer el tope de procesos", () => {
  it("lee los dos números y calcula los libres", () => {
    const p = procesosDelContenedor(lector({ [MAX]: "1000\n", [USADOS]: "300\n" }));
    expect(p).toEqual({ max: 1000, usados: 300, libres: 700 });
  });

  it("fuera de un contenedor (sin los archivos) devuelve null, y eso NO bloquea a nadie", () => {
    expect(procesosDelContenedor(lector({}))).toBeNull();
    expect(haySitioParaOtroNavegador(lector({})).ok).toBe(true);
  });

  it("sin límite («max») también devuelve null: no hay techo que vigilar", () => {
    expect(procesosDelContenedor(lector({ [MAX]: "max", [USADOS]: "120" }))).toBeNull();
  });

  it("un archivo con basura no rompe nada", () => {
    expect(procesosDelContenedor(lector({ [MAX]: "ni idea", [USADOS]: "300" }))).toBeNull();
  });
});

describe("¿cabe otro navegador?", () => {
  it("con el contenedor vacío, sí", () => {
    const r = haySitioParaOtroNavegador(lector({ [MAX]: "1000", [USADOS]: "120" }));
    expect(r.ok).toBe(true);
    expect("libres" in r && r.libres).toBe(880);
  });

  it("justo en la reserva, todavía cabe", () => {
    const usados = 1000 - RESERVA_PIDS;
    const r = haySitioParaOtroNavegador(lector({ [MAX]: "1000", [USADOS]: String(usados) }));
    expect(r.ok).toBe(true);
  });

  it("un proceso por debajo de la reserva, YA NO cabe", () => {
    const usados = 1000 - RESERVA_PIDS + 1;
    const r = haySitioParaOtroNavegador(lector({ [MAX]: "1000", [USADOS]: String(usados) }));
    expect(r.ok).toBe(false);
  });

  it("EL CASO DEL INCIDENTE: 1.001 de 1.000 → no arranca, y el motivo se puede enseñar", () => {
    const r = haySitioParaOtroNavegador(lector({ [MAX]: "1000", [USADOS]: "1001" }));
    expect(r.ok).toBe(false);
    expect("libres" in r && r.libres).toBe(-1);
    // El motivo va escrito para una persona, con los números dentro: es lo que
    // se le enseña al hotelero en su panel y al fundador en el CRM.
    const motivo = ("motivo" in r && r.motivo) || "";
    expect(motivo).toContain("1001 de 1000");
    expect(motivo).not.toMatch(/pids|cgroup|pthread/i);
  });

  it("el motivo nunca viene vacío cuando no cabe", () => {
    const r = haySitioParaOtroNavegador(lector({ [MAX]: "1000", [USADOS]: "990" }));
    expect(r.ok).toBe(false);
    expect((("motivo" in r && r.motivo) || "").length).toBeGreaterThan(20);
  });
});
