// K-16: el precio lo decidía el navegador.
//
// `/api/h/<slug>/checkout` cobraba con el `guestCount` que mandaba el cliente y
// validaba la capacidad con `maxGuests`. Como `maxGuests` siempre es >= a lo que
// se manda, la validación pasaba SIEMPRE: bastaba con pedir un cuarto de 4 con
// `guestCount: 1` y `adults: 4` para pagar la tarifa de una persona y llegar
// cuatro. En un hotel con tarifas por persona, eso es la diferencia entre lo que
// se cobra y lo que se debía cobrar, en cada reserva.
import { describe, it, expect } from "vitest";
import { validarCapacidadCarrito, type BookingRoom } from "@/lib/booking/engine";

function cuarto(p: Partial<BookingRoom> = {}): BookingRoom {
  return {
    id: "1", name: "Cabaña", price: 1000, priceTiers: { 2: 1000, 3: 1500, 4: 2000 },
    maxGuests: 4, cantidad: 3, unidades: ["Cabaña", "Cabaña 2", "Cabaña 3"], ...p,
  };
}
const ROOMS = [cuarto()];

describe("lo que se paga tiene que alcanzar para quien llega", () => {
  it("4 adultos declarando 4 → pasa", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 4, quantity: 1 }], 4).ok).toBe(true));

  // EL ATAQUE. Antes pasaba y cobraba la tarifa de 1 persona.
  it("4 adultos pagando por 1 → RECHAZADO", () => {
    const r = validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 1, quantity: 1 }], 4);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("ocupacion-declarada-insuficiente");
    expect(r.capacidadFisica).toBe(4); // por esto la validación vieja pasaba
    expect(r.ocupacionPagada).toBe(1); // y por esto cobraba de menos
  });

  it("2 unidades de 2 personas cada una cubren a 4 adultos", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 2, quantity: 2 }], 4).ok).toBe(true));

  it("2 unidades pagando 1 persona cada una NO cubren a 4", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 1, quantity: 2 }], 4).ok).toBe(false));

  it("pagar de más se permite (2 adultos en un cuarto de 4)", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 4, quantity: 1 }], 2).ok).toBe(true));
});

// K-99: los menores ocupan cama aunque no paguen tarifa.
describe("los niños cuentan para la capacidad física", () => {
  it("2 adultos + 3 niños NO caben en un cuarto de 4", () => {
    const r = validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 2, quantity: 1 }], 2, 3);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("capacidad-insuficiente");
  });

  it("2 adultos + 2 niños sí caben en un cuarto de 4", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 2, quantity: 1 }], 2, 2).ok).toBe(true));

  // A PROPÓSITO: los menores NO suben la ocupación que se COBRA. Hacerlo
  // cambiaría el precio de toda reserva con niños, que es una subida de precio
  // encubierta y no lo que este hallazgo pide arreglar.
  it("un niño no obliga a pagar una persona más", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 2, quantity: 1 }], 2, 1).ok).toBe(true));
});

describe("bordes", () => {
  it("carrito vacío no cubre a nadie", () =>
    expect(validarCapacidadCarrito(ROOMS, [], 1).ok).toBe(false));
  it("un cuarto que no existe no aporta capacidad", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "999", guestCount: 4, quantity: 1 }], 4).ok).toBe(false));
  it("sin quantity se asume 1", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 4 }], 4).ok).toBe(true));
  it("cantidades absurdas no inflan la capacidad", () =>
    expect(validarCapacidadCarrito(ROOMS, [{ roomId: "1", guestCount: 99, quantity: 1 }], 99).ok).toBe(false));
});
