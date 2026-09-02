// El catálogo de tours y paquetes sale SÓLO de lo que el hotelero configuró.
//
// LO QUE PROTEGE: hubo un fallback por slug que le regalaba a un hotel el
// catálogo hardcodeado de Paraíso —cinco paquetes con los nombres de habitación
// ("Suite Flor de Liz 1", "Jungla") y los precios de OTRO hotel—. Un hotelero
// abría el alta de una reserva y veía paquetes que nunca creó. Era un puente
// hasta que existiera el editor del panel; el editor existe, el puente se fue.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogoTours, catalogoPaquetes } from "@/lib/admin/cotizaciones-catalogo";

describe("sin configurar, el catálogo está VACÍO", () => {
  it("sin extras.cotizaciones no hay tours ni paquetes", () => {
    expect(catalogoTours(undefined)).toEqual([]);
    expect(catalogoPaquetes(undefined)).toEqual([]);
  });

  it("con extras.cotizaciones vacío, tampoco", () => {
    expect(catalogoTours({})).toEqual([]);
    expect(catalogoPaquetes({ paquetes: [] })).toEqual([]);
  });

  it("con basura dentro, no revienta y devuelve vacío", () => {
    expect(catalogoTours({ tours: "no soy una lista" })).toEqual([]);
    expect(catalogoPaquetes({ paquetes: null })).toEqual([]);
  });
});

describe("configurado, devuelve lo del hotel", () => {
  it("los tours que dio de alta", () => {
    const r = catalogoTours({ tours: [{ nombre: "Cascada", precio: 450 }] });
    expect(r).toHaveLength(1);
    expect(r[0].nombre).toBe("Cascada");
  });

  it("los paquetes que dio de alta", () => {
    const r = catalogoPaquetes({
      paquetes: [{ nombre: "Fin de semana", habitacionDefault: "Suite 1", noches: 2, personas: 2, precio: 3000, descripcion: "" }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].nombre).toBe("Fin de semana");
  });
});

describe("EL GUARDIÁN: ni un catálogo de regalo en el código", () => {
  const src = readFileSync(join(process.cwd(), "lib/admin/cotizaciones-catalogo.ts"), "utf8");

  it("🔴 no queda ningún catálogo hardcodeado de un hotel concreto", () => {
    const codigo = src.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    // Los nombres reales de Paraíso: si reaparecen, alguien devolvió el fallback.
    for (const rastro of ["Flor de Liz", "Expedición Tamul", "Las Pozas", "paraiso-encantado"]) {
      expect(codigo, `«${rastro}» no puede vivir en un módulo compartido`).not.toContain(rastro);
    }
  });

  it("los resolvedores NO reciben el slug: no pueden decidir por hotel", () => {
    // Mientras la firma no tenga slug, no hay dónde colgar un fallback por hotel.
    expect(src).toMatch(/export function catalogoTours\(cot\?: unknown\)/);
    expect(src).toMatch(/export function catalogoPaquetes\(cot\?: unknown\)/);
  });
});
