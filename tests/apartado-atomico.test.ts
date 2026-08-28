// Paso 3.10 — el apartado deja de ser una promesa.
//
// EL DEFECTO (K-17, K-148): el motor LEÍA las unidades libres, elegía cuáles
// apartar, y sólo después —tras crear la sesión de pago en Stripe, que es una
// llamada de red a otra empresa— las apartaba de verdad. Entre la lectura y la
// escritura no había nada: dos huéspedes que pulsan "Pagar" a la vez sobre la
// última cabaña ven los dos que está libre, los dos pagan, y al segundo el
// webhook le devuelve el dinero con un correo de disculpa por un cuarto que sí
// estaba libre cuando lo compró.
//
// El arreglo mueve la ELECCIÓN dentro del candado de Postgres. Lo que se prueba
// aquí es la parte pura: que el servidor sabe mandar las candidatas y volver a
// repartir lo que el candado eligió, sin perder ni duplicar ninguna unidad.
// (El candado mismo se probó contra un Postgres 17 real: con él queda 1
// apartado sobre 1 unidad; con el camino viejo quedan 2.)
import { describe, it, expect } from "vitest";
import {
  candidatasPorTipo,
  tiposDesdeApartado,
  topeUnidadesPorSesion,
  asignarUnidades,
  type DisponibilidadTipo,
  type CartItem,
} from "@/lib/booking/engine";

const TIPOS: DisponibilidadTipo[] = [
  { id: 1, name: "Cabaña", freeCount: 3, freeUnitNames: ["Cabaña", "Cabaña 2", "Cabaña 3"] },
  { id: 2, name: "Suite", freeCount: 2, freeUnitNames: ["Suite", "Suite 2"] },
];

describe("candidatasPorTipo — lo que se le manda al candado", () => {
  it("manda las CANDIDATAS, no las elegidas: elegir es trabajo del candado", () => {
    const r = candidatasPorTipo([{ roomId: 1, guestCount: 2, quantity: 1 }], TIPOS);
    expect(r).toEqual([{ tipo: "Cabaña", cantidad: 1, unidades: ["Cabaña", "Cabaña 2", "Cabaña 3"] }]);
  });

  it("dos líneas del mismo tipo se piden SUMADAS, no por separado", () => {
    // Éste es el K-17: pedir 3 y 3 por separado sobre 3 unidades pasaba dos
    // veces la comprobación. Sumadas son 6, y el candado las rechaza.
    const r = candidatasPorTipo(
      [{ roomId: 1, guestCount: 2, quantity: 3 }, { roomId: 1, guestCount: 4, quantity: 3 }],
      TIPOS,
    );
    expect(r).toHaveLength(1);
    expect(r[0].cantidad).toBe(6);
  });

  it("conserva el orden de primera aparición de cada tipo", () => {
    const r = candidatasPorTipo(
      [
        { roomId: 2, guestCount: 2, quantity: 1 },
        { roomId: 1, guestCount: 2, quantity: 1 },
        { roomId: 2, guestCount: 2, quantity: 1 },
      ],
      TIPOS,
    );
    expect(r.map((c) => c.tipo)).toEqual(["Suite", "Cabaña"]);
    expect(r[0].cantidad).toBe(2);
  });

  it("un tipo que ya no existe se pide con 0 candidatas (el candado dirá que no)", () => {
    const r = candidatasPorTipo([{ roomId: 99, guestCount: 2, quantity: 1 }], TIPOS);
    expect(r[0].unidades).toEqual([]);
  });
});

describe("tiposDesdeApartado — el camino de vuelta", () => {
  it("parte el array plano del candado por tipo, en el mismo orden", () => {
    const cart: CartItem[] = [
      { roomId: 2, guestCount: 2, quantity: 1 },
      { roomId: 1, guestCount: 3, quantity: 2 },
    ];
    const cand = candidatasPorTipo(cart, TIPOS);
    // Lo que devolvería el candado: puede NO ser lo que este proceso habría
    // elegido — otro huésped se llevó "Cabaña" un milisegundo antes.
    const apartadas = ["Suite 2", "Cabaña 2", "Cabaña 3"];
    const tipos = tiposDesdeApartado(cart, cand, apartadas);
    expect(tipos.map((t) => t.freeUnitNames)).toEqual([["Suite 2"], ["Cabaña 2", "Cabaña 3"]]);
  });

  it("de vuelta en asignarUnidades, cada unidad conserva el guestCount de SU línea", () => {
    // Es la razón de no fusionar las líneas: "2 cabañas para 2" y "1 cabaña
    // para 4" tienen precios distintos, y el precio sale del guestCount.
    const cart: CartItem[] = [
      { roomId: 1, guestCount: 2, quantity: 2 },
      { roomId: 1, guestCount: 4, quantity: 1 },
    ];
    const cand = candidatasPorTipo(cart, TIPOS);
    expect(cand[0].cantidad).toBe(3);
    const tipos = tiposDesdeApartado(cart, cand, ["Cabaña", "Cabaña 2", "Cabaña 3"]);
    const r = asignarUnidades(cart, tipos);
    expect(r.ok).toBe(true);
    expect(r.ok && r.unidades).toEqual([
      { name: "Cabaña", guestCount: 2 },
      { name: "Cabaña 2", guestCount: 2 },
      { name: "Cabaña 3", guestCount: 4 },
    ]);
  });

  it("ninguna unidad se repite al volver, aunque el candado devuelva otras", () => {
    const cart: CartItem[] = [
      { roomId: 1, guestCount: 2, quantity: 3 },
      { roomId: 2, guestCount: 2, quantity: 2 },
    ];
    const cand = candidatasPorTipo(cart, TIPOS);
    const apartadas = ["Cabaña", "Cabaña 2", "Cabaña 3", "Suite", "Suite 2"];
    const r = asignarUnidades(cart, tiposDesdeApartado(cart, cand, apartadas));
    expect(r.ok).toBe(true);
    const nombres = r.ok ? r.unidades.map((u) => u.name) : [];
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(nombres).toHaveLength(5);
  });
});

describe("topeUnidadesPorSesion — K-87", () => {
  // EL DEFECTO: no había tope. Una sola petición con el carrito lleno apartaba
  // TODAS las unidades libres del hotel 35 minutos, con nombre y correo
  // inventados y sin pagar un peso.
  it("deja pasar un grupo grande pero nunca el hotel entero", () => {
    const once = Array.from({ length: 11 }, () => ({ cantidad: 1 }));
    const tope = topeUnidadesPorSesion(once);
    expect(tope).toBe(7);
    expect(tope).toBeLessThan(11); // lo que importa: no alcanza para cerrarlo
  });

  it("en un hotel chico el mínimo es 4, no una fracción inútil", () => {
    expect(topeUnidadesPorSesion([{ cantidad: 2 }])).toBe(4);
    expect(topeUnidadesPorSesion([])).toBe(4);
  });

  it("crece con el inventario: un hotel de 30 no se gestiona con el tope de uno de 4", () => {
    expect(topeUnidadesPorSesion([{ cantidad: 30 }])).toBe(18);
  });

  it("suma las unidades de todos los tipos, no cuenta los tipos", () => {
    expect(topeUnidadesPorSesion([{ cantidad: 5 }, { cantidad: 5 }])).toBe(6);
  });
});
