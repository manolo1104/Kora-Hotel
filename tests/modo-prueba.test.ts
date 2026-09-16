// El motor en MODO PRUEBA: cuándo simula el pago y cuándo cobra de verdad.
//
// Decisión de Manolo (15 sep 2026): la web invita a registrarse y «hacer una
// reserva de prueba». Sin esto, esa reserva de prueba de un hotel sin Stripe
// Connect COBRABA de verdad en la cuenta de Kora, y Manolo la devolvía a mano.
//
// Las dos formas de hacer daño que se vigilan:
//   1. Simular a quien PAGA: un cliente de pago (o cortesía) con el alta de
//      Stripe a medias dejaría de recibir reservas reales. Nunca.
//   2. Cobrar de verdad a quien está PROBANDO sin cobros listos.
import { describe, it, expect } from "vitest";
import { decidirModoPrueba } from "@/lib/motor/modo-prueba";
import type { AccesoHotel, PruebaHotel } from "@/lib/suscripcion";

const PRUEBA_VIGENTE: PruebaHotel = { fin: new Date("2026-09-30T00:00:00Z"), diasRestantes: 10, vencida: false };

function acceso(p: Partial<AccesoHotel> = {}): AccesoHotel {
  return {
    activo: true,
    planActivo: false,
    prueba: PRUEBA_VIGENTE,
    bloqueado: false,
    mensajeBloqueo: null,
    publicado: true,
    puedeCobrar: true,
    ...p,
  };
}

describe("en prueba y sin cobros listos → simula", () => {
  it("el caso para el que existe", () => {
    expect(decidirModoPrueba({ acceso: acceso(), cobrosListos: false, demo: false })).toBe(true);
  });

  // Despublicado no cobra de todas formas (puedeCobrar), pero si el hotelero lo
  // prueba desde su panel tiene que ver lo mismo: simulado, no «pausado».
  it("aunque esté sin publicar", () => {
    expect(
      decidirModoPrueba({ acceso: acceso({ publicado: false, puedeCobrar: false }), cobrosListos: false, demo: false }),
    ).toBe(true);
  });
});

describe("quien paga o tiene cortesía cobra igual que siempre", () => {
  it("con plan activo y SIN Connect: cobra de verdad (no se le apaga el motor)", () => {
    expect(
      decidirModoPrueba({ acceso: acceso({ planActivo: true, prueba: null }), cobrosListos: false, demo: false }),
    ).toBe(false);
  });

  it("con plan activo y con Connect: cobra de verdad", () => {
    expect(
      decidirModoPrueba({ acceso: acceso({ planActivo: true, prueba: null }), cobrosListos: true, demo: false }),
    ).toBe(false);
  });

  // `accesoDelHotel` falla ABIERTO cuando no puede leer la suscripción: activo,
  // sin plan verificado y prueba null. Sin saber si paga, no se simula.
  it("si no se pudo leer la suscripción (prueba null): no simula", () => {
    expect(decidirModoPrueba({ acceso: acceso({ prueba: null }), cobrosListos: false, demo: false })).toBe(false);
  });
});

describe("en prueba CON cobros listos → cobra de verdad, directo al hotel", () => {
  it("su dinero ya entra a su cuenta: no hay nada que proteger", () => {
    expect(decidirModoPrueba({ acceso: acceso(), cobrosListos: true, demo: false })).toBe(false);
  });
});

describe("los que no llegan a cobrar nada no están en modo prueba", () => {
  it("prueba vencida (acceso inactivo)", () => {
    expect(
      decidirModoPrueba({
        acceso: acceso({ activo: false, puedeCobrar: false, prueba: { ...PRUEBA_VIGENTE, diasRestantes: 0, vencida: true } }),
        cobrosListos: false,
        demo: false,
      }),
    ).toBe(false);
  });

  it("cuenta bloqueada por Kora", () => {
    expect(
      decidirModoPrueba({
        acceso: acceso({ activo: false, bloqueado: true, mensajeBloqueo: "x", prueba: null, puedeCobrar: false }),
        cobrosListos: false,
        demo: false,
      }),
    ).toBe(false);
  });

  // Aun con un acceso incoherente (bloqueado pero «activo»), el bloqueo gana.
  it("bloqueado gana aunque el resto diga activo", () => {
    expect(decidirModoPrueba({ acceso: acceso({ bloqueado: true }), cobrosListos: false, demo: false })).toBe(false);
  });

  it("el hotel demo tiene su propia simulación: esto no aplica", () => {
    expect(decidirModoPrueba({ acceso: acceso(), cobrosListos: false, demo: true })).toBe(false);
  });
});
