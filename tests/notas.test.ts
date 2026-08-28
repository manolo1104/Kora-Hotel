// Paso 7.3 — un solo parser del campo `notas`.
//
// Había CINCO copias y TRES estaban rotas, cada una olvidando cortar por una
// marca distinta. La peor: en el correo de confirmación de una reserva, los
// tours se cortaban por ||PAQUETES|| pero no por ||HABS||, así que una reserva
// con tours y habitaciones y SIN paquetes —el caso normal— reventaba el
// JSON.parse y el `catch` devolvía []. Los tours que el huésped PAGÓ
// desaparecían de su correo.
import { describe, it, expect } from "vitest";
import {
  parseNotas,
  construirNotas,
  notasDelCliente,
  totalTours,
  totalPaquetes,
  type TourItem,
  type PaqueteItem,
  type HabItem,
} from "@/lib/notas";

const TOURS: TourItem[] = [{ nombre: "Tamul", personas: 2, precio: 900 }];
const PAQUETES: PaqueteItem[] = [
  { nombre: "Luna de miel", habitacion: "Suite", noches: 2, personas: 2, precio: 4000 },
];
const HABS: HabItem[] = [{ suite: "Cabaña", huespedes: 2 }];

describe("leer el campo notas", () => {
  it("sin ninguna marca, todo es texto del cliente", () => {
    const n = parseNotas("Llegamos tarde, como a las 11.");
    expect(n.cliente).toBe("Llegamos tarde, como a las 11.");
    expect(n.tours).toEqual([]);
    expect(n.interno).toBe("");
  });

  it("vacío o nulo no revienta", () => {
    for (const v of [null, undefined, ""]) {
      const n = parseNotas(v);
      expect(n.cliente).toBe("");
      expect(n.habitaciones).toEqual([]);
    }
  });

  // ── EL DEFECTO, exactamente: tours + habitaciones, SIN paquetes.
  it("tours seguidos de ||HABS|| (sin paquetes) NO se pierden", () => {
    const crudo = construirNotas({ cliente: "hola", tours: TOURS, habitaciones: HABS });
    expect(crudo).toContain("||TOURS||");
    expect(crudo).not.toContain("||PAQUETES||");
    const n = parseNotas(crudo);
    expect(n.tours).toEqual(TOURS); // antes: []
    expect(n.habitaciones).toEqual(HABS);
  });

  it("paquetes seguidos de ||HABS|| tampoco", () => {
    const n = parseNotas(construirNotas({ cliente: "x", paquetes: PAQUETES, habitaciones: HABS }));
    expect(n.paquetes).toEqual(PAQUETES);
  });

  it("los cinco bloques a la vez, cada uno en su sitio", () => {
    const n = parseNotas(
      construirNotas({
        cliente: "Para el cliente",
        interno: "Ojo: cliente repetido",
        tours: TOURS,
        paquetes: PAQUETES,
        habitaciones: HABS,
      }),
    );
    expect(n.cliente).toBe("Para el cliente");
    expect(n.interno).toBe("Ojo: cliente repetido");
    expect(n.tours).toEqual(TOURS);
    expect(n.paquetes).toEqual(PAQUETES);
    expect(n.habitaciones).toEqual(HABS);
  });

  it("el texto del cliente NUNCA arrastra la nota interna", () => {
    // Es lo que impide que una nota del equipo acabe en el correo del huésped.
    const crudo = construirNotas({ cliente: "Bienvenido", interno: "no darle upgrade" });
    expect(notasDelCliente(crudo)).toBe("Bienvenido");
    expect(notasDelCliente(crudo)).not.toContain("upgrade");
  });

  it("un JSON corrupto devuelve vacío, no tumba el correo", () => {
    const n = parseNotas("hola||TOURS||{esto no es json||HABS||[]");
    expect(n.tours).toEqual([]);
    expect(n.cliente).toBe("hola");
  });

  it("un JSON que no es arreglo tampoco pasa", () => {
    expect(parseNotas('x||TOURS||{"nombre":"Tamul"}').tours).toEqual([]);
  });
});

describe("escribir el campo notas", () => {
  it("los bloques vacíos no se escriben", () => {
    expect(construirNotas({ cliente: "solo esto" })).toBe("solo esto");
    expect(construirNotas({ cliente: "x", tours: [], paquetes: [], habitaciones: [] })).toBe("x");
  });

  it("ida y vuelta: lo que se escribe es lo que se lee", () => {
    const original = {
      cliente: "Para el cliente",
      interno: "interno",
      tours: TOURS,
      paquetes: PAQUETES,
      habitaciones: HABS,
    };
    expect(parseNotas(construirNotas(original))).toEqual(original);
  });

  it("respeta el orden de las marcas, que es el contrato del formato", () => {
    const s = construirNotas({ cliente: "a", interno: "b", tours: TOURS, paquetes: PAQUETES, habitaciones: HABS });
    const orden = ["||INTERNO||", "||TOURS||", "||PAQUETES||", "||HABS||"].map((m) => s.indexOf(m));
    expect(orden).toEqual([...orden].sort((x, y) => x - y));
  });
});

describe("totales", () => {
  it("los tours se cobran por persona", () => {
    expect(totalTours(TOURS)).toBe(1800);
  });

  it("los paquetes van a precio cerrado", () => {
    expect(totalPaquetes(PAQUETES)).toBe(4000);
  });

  it("un precio corrupto cuenta como cero, no como NaN", () => {
    expect(totalTours([{ nombre: "x", personas: 2, precio: "abc" as unknown as number }])).toBe(0);
  });
});
