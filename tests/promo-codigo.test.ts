// El código de descuento del hotel: qué se acepta, qué se descarta y cuánto
// dinero descuenta. Función pura, cero base de datos.
//
// Existe porque hasta el 31 ago 2026 `validatePromo` y `calcPromoDiscount`
// llevaban meses escritos en el engine SIN QUE NADIE LOS LLAMARA, mientras el
// correo de +30 días repartía códigos que el motor no reconocía. Ahora que sí
// se llaman, tocan el precio que se le cobra al huésped: si esto se rompe, se
// cobra de más o se regala inventario.
import { describe, it, expect } from "vitest";
import { validatePromo, calcPromoDiscount, type BookingRoom } from "@/lib/booking/engine";
import { promosDe } from "@/lib/booking/rooms";

const CUARTO: BookingRoom = {
  id: 1,
  name: "Suite",
  price: 2000,
  priceTiers: { 2: 2000 },
  maxGuests: 2,
  cantidad: 1,
  unidades: ["Suite"],
};
const ROOMS = [CUARTO];
const CART = [{ roomId: 1, guestCount: 2, quantity: 1 }];
// Lun 7 sep 2026 → jue 10 sep 2026 = 3 noches, sin fin de semana de por medio.
const IN = "2026-09-07";
const OUT = "2026-09-10";
const NOCHES = 3;

const hotelCon = (promos: unknown) => ({ extras: { reglas: { promos } } });

describe("promosDe — qué llega al motor", () => {
  it("sin promos configuradas, el motor no acepta ningún código", () => {
    expect(promosDe(hotelCon(undefined))).toEqual([]);
    expect(promosDe(hotelCon([]))).toEqual([]);
  });

  it("descarta la promo apagada por el hotelero", () =>
    expect(promosDe(hotelCon([{ activa: false, code: "X", tipo: "porcentaje", valor: 10 }]))).toEqual(
      [],
    ));

  it("una promo vieja sin el campo `activa` sigue viva", () => {
    // Las guardadas antes de que existiera el interruptor no lo traen. Apagarlas
    // en silencio dejaría al huésped con un código que dejó de funcionar.
    expect(promosDe(hotelCon([{ code: "VIEJA", tipo: "porcentaje", valor: 10 }]))).toHaveLength(1);
  });

  it("descarta lo que el huésped no podría usar: sin código o sin valor", () => {
    expect(promosDe(hotelCon([{ activa: true, code: "", tipo: "porcentaje", valor: 10 }]))).toEqual([]);
    expect(promosDe(hotelCon([{ activa: true, code: "X", tipo: "porcentaje", valor: 0 }]))).toEqual([]);
  });

  it("descarta un porcentaje imposible en vez de dejar el cuarto en negativo", () =>
    expect(promosDe(hotelCon([{ activa: true, code: "X", tipo: "porcentaje", valor: 150 }]))).toEqual(
      [],
    ));

  it("normaliza el código a mayúsculas", () =>
    expect(promosDe(hotelCon([{ activa: true, code: " vuelve10 ", tipo: "porcentaje", valor: 10 }]))[0].code).toBe(
      "VUELVE10",
    ));
});

describe("validatePromo — quién puede usarlo", () => {
  const PROMOS = promosDe(
    hotelCon([{ activa: true, code: "VUELVE10", tipo: "porcentaje", valor: 10, minNoches: 2 }]),
  );

  it("acepta el código sin importar mayúsculas", () =>
    expect(validatePromo(PROMOS, "vuelve10", NOCHES, 1).valid).toBe(true));

  it("rechaza un código que no existe", () =>
    expect(validatePromo(PROMOS, "NOEXISTE", NOCHES, 1).valid).toBe(false));

  it("rechaza si no hay habitación en el carrito", () =>
    expect(validatePromo(PROMOS, "VUELVE10", NOCHES, 0).valid).toBe(false));

  it("respeta el mínimo de noches del hotelero", () =>
    expect(validatePromo(PROMOS, "VUELVE10", 1, 1).valid).toBe(false));
});

describe("calcPromoDiscount — el dinero", () => {
  const reglaPct = promosDe(hotelCon([{ activa: true, code: "P", tipo: "porcentaje", valor: 10 }]))[0];
  const reglaMonto = promosDe(hotelCon([{ activa: true, code: "M", tipo: "monto", valor: 500 }]))[0];

  it("el porcentaje se aplica sobre el subtotal de habitaciones", () => {
    // 3 noches × $2,000 = $6,000 → 10% = $600.
    expect(calcPromoDiscount(ROOMS, reglaPct, CART, IN, OUT, NOCHES)).toBe(600);
  });

  it("el monto fijo descuenta esa cantidad", () =>
    expect(calcPromoDiscount(ROOMS, reglaMonto, CART, IN, OUT, NOCHES)).toBe(500));

  it("un monto mayor que la estancia NO deja el total en negativo", () => {
    const enorme = promosDe(hotelCon([{ activa: true, code: "M", tipo: "monto", valor: 99999 }]))[0];
    const d = calcPromoDiscount(ROOMS, enorme, CART, IN, OUT, NOCHES);
    expect(d).toBe(6000); // topado al subtotal, ni un peso más
  });

  it("con el carrito vacío no descuenta nada", () =>
    expect(calcPromoDiscount(ROOMS, reglaPct, [], IN, OUT, NOCHES)).toBe(0));
});
