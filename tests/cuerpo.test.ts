// 27 de las 45 rutas de escritura del panel no validaban su cuerpo (A17.1).
// Unas porque nadie se acordó, otras porque el `try/catch` sólo cubría el JSON
// roto y no la FORMA: `app/api/admin/clientes` mandaba `email` y `notas` a la
// base sin mirarlos, así que un objeto o un array llegaban tal cual.
//
// `leerCuerpo` es lo que las 24 arregladas usan ahora. Si esto se rompe, se
// rompen todas a la vez, así que vale la pena probarlo aparte.
import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import {
  leerCuerpo,
  zEmail,
  zTextoCorto,
  zTextoLargo,
  zId,
  zFecha,
} from "@/lib/api/cuerpo";

const pide = (cuerpo: unknown) =>
  new Request("https://kora-hotel.com/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });

const ESQUEMA = z.object({
  email: zEmail,
  notas: zTextoLargo.default(""),
});

afterEach(() => vi.restoreAllMocks());

describe("leerCuerpo", () => {
  it("devuelve los datos ya validados y con los valores por defecto puestos", async () => {
    const r = await leerCuerpo(pide({ email: "ana@hotel.mx" }), ESQUEMA);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos).toEqual({ email: "ana@hotel.mx", notas: "" });
  });

  it("un JSON roto es 400, no un 500", async () => {
    const r = await leerCuerpo(pide("{esto no es json"), ESQUEMA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(400);
  });

  it("un cuerpo con la forma equivocada es 400", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Esto es justo lo que llegaba a la base en `clientes`.
    const r = await leerCuerpo(pide({ email: { $ne: null }, notas: [] }), ESQUEMA);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.respuesta.status).toBe(400);
  });

  it("el 400 NO dice qué campo falló", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await leerCuerpo(pide({ email: "no-es-correo" }), ESQUEMA);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Quien llama a estas rutas es nuestro propio panel: el detalle sólo le
      // serviría a quien esté probando qué acepta la API. Va al log.
      const cuerpo = await r.respuesta.json();
      expect(cuerpo).toEqual({ error: "Datos inválidos." });
      expect(JSON.stringify(cuerpo)).not.toContain("email");
    }
  });

  it("pero sí lo deja en el registro del servidor", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await leerCuerpo(pide({ email: "no-es-correo" }), ESQUEMA);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0])).toContain("email");
  });

  it("descarta los campos que el esquema no declara", async () => {
    // Sin esto, un `rol: "dueno"` de más viajaría hasta el `update` de la base.
    const r = await leerCuerpo(pide({ email: "a@b.mx", rol: "dueno" }), ESQUEMA);
    expect(r.ok).toBe(true);
    if (r.ok) expect("rol" in r.datos).toBe(false);
  });
});

describe("las piezas que se repiten", () => {
  it("zEmail exige un correo de verdad, no una arroba suelta", () => {
    expect(zEmail.safeParse("ana@hotel.mx").success).toBe(true);
    expect(zEmail.safeParse("hola").success).toBe(false);
    expect(zEmail.safeParse("@").success).toBe(false);
    expect(zEmail.safeParse("a@b.mx" + "x".repeat(400)).success).toBe(false);
  });

  it("zTextoCorto no acepta vacío ni un texto de 40 MB", () => {
    expect(zTextoCorto.safeParse("Suite Jungla").success).toBe(true);
    expect(zTextoCorto.safeParse("   ").success).toBe(false);
    expect(zTextoCorto.safeParse("x".repeat(201)).success).toBe(false);
  });

  it("zTextoLargo acepta vacío pero tiene techo", () => {
    // Una nota sin tope entra en la base y sale luego en cada listado, en cada
    // correo y en el Excel que se descarga el hotelero.
    expect(zTextoLargo.safeParse("").success).toBe(true);
    expect(zTextoLargo.safeParse("x".repeat(5_001)).success).toBe(false);
  });

  it("zId no deja pasar un identificador absurdo", () => {
    expect(zId.safeParse("KORA-A1B2").success).toBe(true);
    expect(zId.safeParse("").success).toBe(false);
    expect(zId.safeParse("x".repeat(101)).success).toBe(false);
  });

  it("zFecha sólo acepta YYYY-MM-DD, que es lo que guarda la base", () => {
    expect(zFecha.safeParse("2026-09-12").success).toBe(true);
    expect(zFecha.safeParse("12/09/2026").success).toBe(false);
    expect(zFecha.safeParse("2026-9-1").success).toBe(false);
    expect(zFecha.safeParse("mañana").success).toBe(false);
  });
});
