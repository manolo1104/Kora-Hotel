// ¿Este hotel ya vinculó su WhatsApp? Es la pregunta que decide si el runtime le
// abre un navegador al arrancar, así que equivocarse cuesta caro en las dos
// direcciones: de más, un Chromium inútil; de menos, un hotel conectado que ya
// no arranca y nadie sabe por qué.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  tieneSesion,
  marcadoSinVincular,
  marcarSinVincular,
  limpiarMarcaSinVincular,
} from "../agentes/camila/sesiones.js";

const BASE = path.join(tmpdir(), "kora-sesiones-test");

beforeEach(() => {
  rmSync(BASE, { recursive: true, force: true });
  mkdirSync(BASE, { recursive: true });
});
afterEach(() => rmSync(BASE, { recursive: true, force: true }));

describe("saber si ya escaneó", () => {
  it("con sesión en disco, sí", () => {
    const dir = path.join(BASE, "session-abc-123");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "Default"), "x");
    expect(tieneSesion(BASE, "abc-123")).toBe(true);
  });

  it("sin carpeta, no", () => {
    expect(tieneSesion(BASE, "nunca-escaneo")).toBe(false);
  });

  // Es lo que deja un escaneo a medias: la carpeta creada y nada dentro.
  it("una carpeta vacía cuenta como NO vinculado", () => {
    mkdirSync(path.join(BASE, "session-vacio"), { recursive: true });
    expect(tieneSesion(BASE, "vacio")).toBe(false);
  });

  // Ante la duda, que arranque: un Chromium de más cuesta memoria; uno de menos
  // deja mudo a un hotel que ya estaba conectado.
  it("sin datos suficientes, se asume que sí", () => {
    expect(tieneSesion("", "abc")).toBe(true);
    expect(tieneSesion(BASE, "")).toBe(true);
  });
});

// La marca que sobrevive al reinicio. Sin ella, el estado "liberado" vivía sólo
// en memoria y CADA despliegue volvía a levantar a todos los hoteles sin
// vincular a la vez — repitiendo la tormenta que esto vino a quitar.
describe("recordar a quién NO hay que levantar", () => {
  it("un hotel recién visto no está marcado", () => {
    expect(marcadoSinVincular(BASE, "nuevo")).toBe(false);
  });

  it("marcar y leer sobrevive a releer el disco", () => {
    marcarSinVincular(BASE, "abc");
    expect(marcadoSinVincular(BASE, "abc")).toBe(true);
  });

  // Se marca aunque el hotel nunca haya llegado a crear su carpeta.
  it("marcar crea la carpeta si no existía", () => {
    marcarSinVincular(BASE, "sin-carpeta");
    expect(marcadoSinVincular(BASE, "sin-carpeta")).toBe(true);
  });

  it("al conectar se quita, y vuelve a arrancar solo", () => {
    marcarSinVincular(BASE, "abc");
    limpiarMarcaSinVincular(BASE, "abc");
    expect(marcadoSinVincular(BASE, "abc")).toBe(false);
  });

  it("quitarla dos veces no revienta", () => {
    limpiarMarcaSinVincular(BASE, "no-existe");
    expect(marcadoSinVincular(BASE, "no-existe")).toBe(false);
  });

  // Ante la duda, que arranque: es el lado barato de equivocarse.
  it("sin datos suficientes no se marca a nadie", () => {
    expect(marcadoSinVincular("", "abc")).toBe(false);
    expect(marcadoSinVincular(BASE, "")).toBe(false);
  });

  // La marca va DENTRO de la carpeta de sesión, así que no puede hacer que
  // `tieneSesion` cambie de opinión sobre un hotel que sí tenía sesión.
  it("marcar no borra la sesión que ya estaba", () => {
    const dir = path.join(BASE, "session-conectado");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "Default"), "x");
    marcarSinVincular(BASE, "conectado");
    expect(tieneSesion(BASE, "conectado")).toBe(true);
    limpiarMarcaSinVincular(BASE, "conectado");
    expect(tieneSesion(BASE, "conectado")).toBe(true);
  });
});
