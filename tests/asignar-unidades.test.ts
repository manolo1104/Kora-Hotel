// K-17 (la mitad de la duplicación). El checkout asignaba unidades recorriendo
// el carrito línea por línea y haciendo `freeUnitNames.slice(0, qty)` en cada
// una. Dos líneas del MISMO tipo cogían por tanto LOS MISMOS nombres: el
// huésped pagaba 6 cabañas (`calcCartSubtotal` cobra por línea) y se le
// apartaban 3, con los nombres repetidos.
import { describe, it, expect } from "vitest";
import { asignarUnidades, type DisponibilidadTipo } from "@/lib/booking/engine";

const TIPOS: DisponibilidadTipo[] = [
  { id: 1, name: "Cabaña", freeCount: 3, freeUnitNames: ["Cabaña", "Cabaña 2", "Cabaña 3"] },
  { id: 2, name: "Suite", freeCount: 1, freeUnitNames: ["Suite"] },
];

describe("cada unidad se asigna UNA vez", () => {
  it("una línea normal asigna sus unidades", () => {
    const r = asignarUnidades([{ roomId: 1, guestCount: 2, quantity: 2 }], TIPOS);
    expect(r.ok).toBe(true);
    expect(r.ok && r.unidades.map((u) => u.name)).toEqual(["Cabaña", "Cabaña 2"]);
  });

  // EL DEFECTO: dos líneas del mismo tipo cogían los mismos nombres.
  it("dos líneas del mismo tipo NO repiten unidad", () => {
    const r = asignarUnidades(
      [{ roomId: 1, guestCount: 2, quantity: 1 }, { roomId: 1, guestCount: 4, quantity: 2 }],
      TIPOS,
    );
    expect(r.ok).toBe(true);
    const nombres = r.ok ? r.unidades.map((u) => u.name) : [];
    expect(nombres).toEqual(["Cabaña", "Cabaña 2", "Cabaña 3"]);
    expect(new Set(nombres).size).toBe(3); // ninguna repetida
  });

  // El ataque del informe: 3 + 3 sobre un tipo que sólo tiene 3 unidades.
  it("pedir 3 + 3 de un tipo con 3 unidades → no disponible, no 6 cobradas", () => {
    const r = asignarUnidades(
      [{ roomId: 1, guestCount: 2, quantity: 3 }, { roomId: 1, guestCount: 2, quantity: 3 }],
      TIPOS,
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.tipoAgotado).toBe("Cabaña");
  });

  it("cada línea conserva SU ocupación (de ahí sale el precio)", () => {
    const r = asignarUnidades(
      [{ roomId: 1, guestCount: 2, quantity: 1 }, { roomId: 1, guestCount: 4, quantity: 1 }],
      TIPOS,
    );
    expect(r.ok && r.unidades).toEqual([
      { name: "Cabaña", guestCount: 2 },
      { name: "Cabaña 2", guestCount: 4 },
    ]);
  });
});

describe("lo que ya funcionaba sigue funcionando", () => {
  it("dos tipos distintos se asignan cada uno por su lado", () => {
    const r = asignarUnidades(
      [{ roomId: 1, guestCount: 2, quantity: 1 }, { roomId: 2, guestCount: 2, quantity: 1 }],
      TIPOS,
    );
    expect(r.ok && r.unidades.map((u) => u.name)).toEqual(["Cabaña", "Suite"]);
  });

  it("un tipo sin unidades libres corta con su nombre", () => {
    const r = asignarUnidades([{ roomId: 2, guestCount: 2, quantity: 2 }], TIPOS);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.tipoAgotado).toBe("Suite");
  });

  it("un tipo que no existe corta sin nombre que enseñar", () => {
    const r = asignarUnidades([{ roomId: 99, guestCount: 2, quantity: 1 }], TIPOS);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.tipoAgotado).toBe(null);
  });

  it("sin quantity se asume 1", () => {
    const r = asignarUnidades([{ roomId: 1, guestCount: 2 }], TIPOS);
    expect(r.ok && r.unidades).toHaveLength(1);
  });

  // `freeCount` y `freeUnitNames` deberían ir siempre a la par; si no, manda la
  // lista de nombres, que es lo que de verdad se puede apartar.
  it("si freeCount miente sobre freeUnitNames, manda la lista de nombres", () => {
    const raros: DisponibilidadTipo[] = [{ id: 1, name: "Cabaña", freeCount: 5, freeUnitNames: ["Cabaña"] }];
    expect(asignarUnidades([{ roomId: 1, guestCount: 2, quantity: 3 }], raros).ok).toBe(false);
  });
});
