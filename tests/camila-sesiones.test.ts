// ¿Este hotel ya vinculó su WhatsApp? Es la pregunta que decide si el runtime le
// abre un navegador al arrancar, así que equivocarse cuesta caro en las dos
// direcciones: de más, un Chromium inútil; de menos, un hotel conectado que ya
// no arranca y nadie sabe por qué.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tieneSesion } from "../agentes/camila/sesiones.js";

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
