// Qué se trae del registro del huésped al formulario de la reserva.
//
// LO QUE PROTEGE: hay dos versiones de los mismos datos —los que capturó
// recepción y los que escribió el huésped— y pisar unos con otros en silencio
// borra el trabajo de alguien. Esta función es la única que decide qué se pisa.

import { describe, it, expect } from "vitest";
import { importarDelHuesped, type ValoresReserva } from "@/lib/booking/importar-pre-checkin";

const reserva = (p: Partial<ValoresReserva> = {}): ValoresReserva => ({
  cliente: "", telefono: "", email: "", ...p,
});

describe("huecos vacíos: se rellenan solos", () => {
  it("un teléfono que faltaba entra sin preguntar", () => {
    const r = importarDelHuesped(reserva({ cliente: "Manuel Gonzales" }), { telefono: "4491234567" });
    expect(r.rellenos).toEqual({ telefono: "4491234567" });
    expect(r.diferencias).toEqual([]);
  });

  it("rellena los tres si la reserva no traía ninguno", () => {
    const r = importarDelHuesped(reserva(), {
      nombreCompleto: "Ana Ruiz", telefono: "444", email: "ana@ejemplo.mx",
    });
    expect(r.rellenos).toEqual({ cliente: "Ana Ruiz", telefono: "444", email: "ana@ejemplo.mx" });
  });

  it("un campo con solo espacios cuenta como vacío", () => {
    const r = importarDelHuesped(reserva({ telefono: "   " }), { telefono: "444" });
    expect(r.rellenos).toEqual({ telefono: "444" });
  });
});

describe("valores distintos: se avisa, NO se pisa", () => {
  it("🔴 el nombre más largo del huésped no borra el de la reserva", () => {
    const r = importarDelHuesped(reserva({ cliente: "Manuel Gonzales" }), {
      nombreCompleto: "Manuel Gonzales Ruiz",
    });
    expect(r.rellenos).toEqual({}); // nada se pisó
    expect(r.diferencias).toEqual([
      { campo: "cliente", actual: "Manuel Gonzales", delHuesped: "Manuel Gonzales Ruiz" },
    ]);
  });

  it("avisa de varios campos a la vez", () => {
    const r = importarDelHuesped(
      reserva({ cliente: "Ana", telefono: "111", email: "a@a.mx" }),
      { nombreCompleto: "Ana Ruiz", telefono: "222", email: "ana@ejemplo.mx" },
    );
    expect(r.diferencias.map(d => d.campo).sort()).toEqual(["cliente", "email", "telefono"]);
    expect(r.rellenos).toEqual({});
  });
});

describe("lo igual no genera ruido", () => {
  it("mismo valor exacto: ni rellena ni avisa", () => {
    const r = importarDelHuesped(reserva({ cliente: "Ana Ruiz" }), { nombreCompleto: "Ana Ruiz" });
    expect(r).toEqual({ rellenos: {}, diferencias: [] });
  });

  it("los espacios de más y las mayúsculas NO son una diferencia", () => {
    // Un aviso que no aporta nada enseña a ignorar los avisos que sí aportan.
    const r = importarDelHuesped(reserva({ cliente: "  ana   RUIZ " }), { nombreCompleto: "Ana Ruiz" });
    expect(r.diferencias).toEqual([]);
    expect(r.rellenos).toEqual({});
  });
});

describe("bordes", () => {
  it("sin registro, no pasa nada", () => {
    expect(importarDelHuesped(reserva({ cliente: "Ana" }), null))
      .toEqual({ rellenos: {}, diferencias: [] });
  });

  it("lo que el huésped dejó en blanco no borra lo que la reserva sí tiene", () => {
    const r = importarDelHuesped(reserva({ telefono: "4491234567" }), { telefono: "" });
    expect(r).toEqual({ rellenos: {}, diferencias: [] });
  });
});
