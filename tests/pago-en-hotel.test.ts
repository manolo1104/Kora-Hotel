// "Pagar al llegar al hotel" está RETIRADO (decisión del 26 ago 2026).
//
// La opción guardaba la tarjeta del huésped con un `mode:"setup"` en la cuenta
// del hotel, pero no se persistía ninguna referencia utilizable: el rastro moría
// en un `seti_…` dentro de `bookings.payment_intent_id`. Ante un no-show el
// hotelero abría su panel y no había ningún botón para cobrar (K-101). Prometer
// una garantía que no se puede ejecutar es peor que no ofrecerla.
import { describe, it, expect } from "vitest";
import { bookingRules, PAGO_EN_HOTEL_DISPONIBLE } from "@/lib/booking";

const hotelCon = (pagoEnHotel: boolean) => ({ extras: { reglas: { pagoEnHotel } }, config: {} });

describe("el interruptor único", () => {
  it("hoy está apagado", () => expect(PAGO_EN_HOTEL_DISPONIBLE).toBe(false));

  it("aunque el hotel lo tenga activado, no se ofrece", () =>
    expect(bookingRules(hotelCon(true)).pagoEnHotel).toBe(false));

  // Lo que el hotelero tenía guardado NO se borra: cuando la opción vuelva,
  // vuelve tal cual estaba y nadie tiene que reconfigurar nada.
  it("el valor guardado del hotel sigue intacto en extras", () => {
    const h = hotelCon(true);
    bookingRules(h);
    expect(h.extras.reglas.pagoEnHotel).toBe(true);
  });

  // Las demás reglas no se tocan: esto retira UNA opción, no cambia el motor.
  it("el resto de las reglas del hotel siguen igual", () => {
    const r = bookingRules({ extras: { reglas: { anticipoPct: 30, minNoches: 2 } }, config: {} });
    expect(r.anticipoPct).toBe(30);
    expect(r.minNoches).toBe(2);
  });
});
