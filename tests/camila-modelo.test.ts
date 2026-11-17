// Las dos piezas que viven DUPLICADAS a propósito —una en el sitio (TypeScript,
// la usa la vista previa del panel) y otra en el runtime de WhatsApp (JS, otro
// despliegue)— tienen que decir exactamente lo mismo. Si no, el hotelero prueba
// a Camila en el panel con unos parámetros y los huéspedes reciben otros.
import { describe, it, expect } from "vitest";
import * as ts from "@/lib/bot/modelo";
import * as tsTurno from "@/lib/bot/turno";
import * as js from "@/agentes/camila/modelo.js";
import * as jsTurno from "@/agentes/camila/turno.js";

const MODELOS = [
  "claude-sonnet-5",
  "claude-sonnet-5-5",
  "claude-opus-5",
  "claude-opus-5-5",
  "claude-opus-4-8",
  "claude-fable-5-2",
  "claude-mythos-5-2",
  "claude-haiku-5-5",
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
];

describe("parámetros del modelo", () => {
  it.each(MODELOS)("%s: el panel y WhatsApp mandan lo mismo", (m) => {
    expect(js.opcionesModelo(m)).toEqual(ts.opcionesModelo(m));
    expect(js.maxTokensModelo(m)).toBe(ts.maxTokensModelo(m));
  });

  // EL DEFECTO: la regex de exclusión no conocía a Sonnet 5.5, que rechaza
  // `thinking: disabled` con un 400. Cambiar CAMILA_MODEL la dejaba muda.
  it("Sonnet 5.5 NO recibe thinking:disabled (le da 400): usa between_tools", () => {
    expect(ts.opcionesModelo("claude-sonnet-5-5")).toEqual({
      output_config: { effort: "low" },
      thinking: { type: "between_tools" },
    });
  });

  it("Opus 5/5.5, Fable, Mythos y Haiku 5.5 no reciben ningún `thinking` (siempre piensan o no conviene apagarlo)", () => {
    for (const m of ["claude-opus-5", "claude-opus-5-5", "claude-fable-5-2", "claude-mythos-5-2", "claude-haiku-5-5"]) {
      expect(ts.opcionesModelo(m)).not.toHaveProperty("thinking");
      expect(ts.opcionesModelo(m)).toHaveProperty("output_config.effort", "low");
    }
  });

  it("Sonnet 5 (el de hoy) sigue igual: esfuerzo bajo y sin pensar", () => {
    expect(ts.opcionesModelo("claude-sonnet-5")).toEqual({
      output_config: { effort: "low" },
      thinking: { type: "disabled" },
    });
  });

  it("los modelos viejos no reciben parámetros que no conocen", () => {
    expect(ts.opcionesModelo("claude-haiku-4-5")).toEqual({});
    expect(ts.opcionesModelo("claude-3-5-sonnet")).toEqual({});
  });

  it("cuando el modelo piensa, hay más margen de tokens (el pensamiento también cuenta)", () => {
    expect(ts.maxTokensModelo("claude-opus-5-5")).toBeGreaterThan(ts.maxTokensModelo("claude-sonnet-5"));
  });
});

describe("el bloque de cada turno (fecha y quién escribe)", () => {
  const FECHAS = [
    "2026-11-17T23:30:00Z", // martes en UTC, todavía martes 17:30 en CDMX
    "2026-11-18T05:30:00Z", // ya miércoles en UTC, pero martes 23:30 en CDMX
    "2026-11-20T18:00:00Z", // viernes
    "2026-11-21T18:00:00Z", // sábado
    "2026-11-22T18:00:00Z", // domingo
    "2026-12-31T23:59:00Z", // cambio de año
  ];

  it.each(FECHAS)("%s: el panel y WhatsApp escriben exactamente lo mismo", (iso) => {
    const ahora = new Date(iso);
    expect(jsTurno.bloqueTurno({ ahora, conv: "5214811234567" })).toBe(tsTurno.bloqueTurno({ ahora, conv: "5214811234567" }));
  });

  it("usa la hora del HOTEL, no la de UTC (a medianoche Camila creía que hoy era ayer)", () => {
    const b = tsTurno.bloqueTurno({ ahora: new Date("2026-11-18T05:30:00Z") });
    expect(b).toContain("martes 17 de noviembre de 2026 (2026-11-17), 23:30");
  });

  it("el fin de semana: un martes apunta al viernes que viene", () => {
    const b = tsTurno.bloqueTurno({ ahora: new Date("2026-11-17T18:00:00Z") });
    expect(b).toContain("(2026-11-20) al domingo");
    expect(b).toContain("(2026-11-22)");
  });

  it("un sábado, el fin de semana es el que está en curso", () => {
    const b = tsTurno.bloqueTurno({ ahora: new Date("2026-11-21T18:00:00Z") });
    expect(b).toContain("(2026-11-20) al domingo");
  });

  it("da el teléfono del huésped para que no se lo pida", () => {
    const b = tsTurno.bloqueTurno({ conv: "5214811234567" });
    expect(b).toContain("+5214811234567");
    expect(b).toContain("nunca se lo pidas");
  });

  it("un id de chat que no es teléfono (@lid) no se presenta como teléfono", () => {
    expect(tsTurno.bloqueTurno({ conv: "123456789012345678" })).not.toContain("QUIÉN ESCRIBE");
    expect(tsTurno.telefonoDelChat("abc")).toBeNull();
  });
});
