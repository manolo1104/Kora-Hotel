// El estado operativo de una reserva y los contadores de la vista "Hoy".
//
// POR QUÉ EXISTE ESTE ARCHIVO: el hotelero que paga reportó dos cosas que
// resultaron ser el mismo hueco —"marcar manualmente que el huésped ya llegó" y
// "esta información aparece principalmente cuando la estancia es de varios
// días"—. La causa era que "En casa" se DEDUCÍA de `checkin < hoy` estricto.
// Estas pruebas fijan el comportamiento para que no se pueda volver atrás.

import { describe, it, expect } from "vitest";
import {
  estadoOperativo,
  contadoresDeHoy,
  ocupaElCuarto,
  estadoDelCuarto,
  type ReservaSituable,
} from "@/lib/booking/estado-operativo";

const HOY = "2026-09-02";

function reserva(p: Partial<ReservaSituable> = {}): ReservaSituable {
  return {
    estado: "CONFIRMADA",
    checkin: HOY,
    checkout: "2026-09-05",
    checkinReal: "",
    checkoutReal: "",
    ...p,
  };
}

describe("la estancia de UNA noche — el caso que reportó el hotelero", () => {
  const unaNoche = { checkin: HOY, checkout: "2026-09-03" };

  it("sin registrar llegada sale 'por llegar hoy', como siempre", () => {
    expect(estadoOperativo(reserva(unaNoche), HOY)).toBe("CHECK_IN_HOY");
  });

  it("🔴 EL DEFECTO: por fechas NUNCA llegaba a 'En casa'", () => {
    // Día de entrada → CHECK_IN_HOY. Día siguiente → CHECK_OUT_HOY. Nunca EN_CASA.
    expect(estadoOperativo(reserva(unaNoche), HOY)).not.toBe("EN_CASA");
    expect(estadoOperativo(reserva(unaNoche), "2026-09-03")).not.toBe("EN_CASA");
  });

  it("🟢 EL ARREGLO: al registrar la llegada, está en casa", () => {
    const llegado = reserva({ ...unaNoche, checkinReal: "2026-09-02T15:04:00Z" });
    expect(estadoOperativo(llegado, HOY)).toBe("EN_CASA");
  });
});

describe("lo afirmado manda sobre lo deducido", () => {
  it("el check-out registrado gana al check-in registrado", () => {
    const b = reserva({ checkinReal: "2026-09-02T15:00:00Z", checkoutReal: "2026-09-02T19:00:00Z" });
    expect(estadoOperativo(b, HOY)).toBe("SALIO");
  });

  it("el que se queda de más sigue 'en casa' aunque su salida ya pasó", () => {
    // Es justo cuando más importa saberlo: el calendario dice que se fue ayer y
    // el cuarto está ocupado de verdad.
    const b = reserva({ checkin: "2026-08-28", checkout: "2026-08-30", checkinReal: "2026-08-28T15:00:00Z" });
    expect(estadoOperativo(b, HOY)).toBe("EN_CASA");
  });

  it("el walk-in registrado hoy está en casa aunque sus fechas no cubran hoy", () => {
    const b = reserva({ checkin: "2026-09-10", checkout: "2026-09-11", checkinReal: "2026-09-02T21:00:00Z" });
    expect(estadoOperativo(b, HOY)).toBe("EN_CASA");
  });

  it("una cancelada no está en casa aunque tenga llegada registrada", () => {
    const b = reserva({ estado: "CANCELADA", checkinReal: "2026-09-02T15:00:00Z" });
    expect(estadoOperativo(b, HOY)).toBe("CANCELADA");
  });

  it("una reembolsada tampoco (K-42)", () => {
    const b = reserva({ estado: "REEMBOLSADA", checkinReal: "2026-09-02T15:00:00Z" });
    expect(estadoOperativo(b, HOY)).toBe("REEMBOLSADA");
  });
});

describe("el hotel que NUNCA pulsa los botones ve lo de siempre", () => {
  it("estancia larga en curso → En casa por fechas", () => {
    expect(estadoOperativo(reserva({ checkin: "2026-08-30", checkout: "2026-09-05" }), HOY)).toBe("EN_CASA");
  });
  it("sale hoy → Check-out hoy", () => {
    expect(estadoOperativo(reserva({ checkin: "2026-08-30", checkout: HOY }), HOY)).toBe("CHECK_OUT_HOY");
  });
  it("futura → Próxima", () => {
    expect(estadoOperativo(reserva({ checkin: "2026-09-20", checkout: "2026-09-22" }), HOY)).toBe("PROXIMA");
  });
  it("pasada → Completada, NUNCA 'No Show'", () => {
    // Derivar No-Show de "fechas pasadas sin llegada registrada" repintaría el
    // historial entero de cualquier hotel que no use el botón.
    expect(estadoOperativo(reserva({ checkin: "2026-08-01", checkout: "2026-08-03" }), HOY)).toBe("COMPLETADA");
  });
});

describe("los contadores de la vista Hoy", () => {
  it("🔴 EL DEFECTO: la estancia de un día se contaba DOS veces en el badge", () => {
    // El badge suma los tres contadores. Antes `checkIn` filtraba
    // `checkin === hoy` y `checkOut` filtraba `checkout === hoy` por separado,
    // así que una reserva que entra y sale hoy sumaba en los dos.
    const mismoDia = [reserva({ checkin: HOY, checkout: HOY })];
    expect(contadoresDeHoy(mismoDia, HOY).total).toBe(1);
  });

  it("🔴 EL DEFECTO: una con check-out hecho sumaba en 'Check-out hoy' mientras su fila decía 'Salió'", () => {
    const salida = [reserva({ checkin: "2026-08-30", checkout: HOY, checkoutReal: "2026-09-02T11:00:00Z" })];
    const c = contadoresDeHoy(salida, HOY);
    expect(c.checkOut).toBe(0);
    expect(c.total).toBe(0);
  });

  it("cada reserva cae en UN solo cubo: el total es la suma sin repetir", () => {
    const lista = [
      reserva({ checkin: HOY, checkout: "2026-09-04" }),                                  // por llegar
      reserva({ checkin: HOY, checkout: "2026-09-03", checkinReal: "2026-09-02T15:00:00Z" }), // en casa
      reserva({ checkin: "2026-08-30", checkout: HOY }),                                  // sale hoy
      reserva({ checkin: "2026-09-20", checkout: "2026-09-22" }),                         // próxima: fuera
      reserva({ estado: "CANCELADA", checkin: HOY, checkout: "2026-09-04" }),             // cancelada: fuera
    ];
    const c = contadoresDeHoy(lista, HOY);
    expect(c).toEqual({ checkIn: 1, enCasa: 1, checkOut: 1, total: 3 });
  });
});

describe("ocupaElCuarto — la MISMA función para el mapa, la lista y los Insights", () => {
  it("las fechas de siempre: dentro de la estancia, ocupado", () => {
    expect(ocupaElCuarto(reserva({ checkin: "2026-09-01", checkout: "2026-09-05" }), HOY)).toBe(true);
  });

  it("el día de salida el cuarto YA está libre para esa noche", () => {
    expect(ocupaElCuarto(reserva({ checkin: "2026-09-01", checkout: HOY }), HOY)).toBe(false);
  });

  it("el check-out registrado libera el cuarto sin esperar a la fecha", () => {
    const b = reserva({ checkin: "2026-09-01", checkout: "2026-09-10", checkoutReal: "2026-09-02T11:00:00Z" });
    expect(ocupaElCuarto(b, HOY)).toBe(false);
  });

  it("🟢 EL WALK-IN: llegada registrada ocupa aunque las fechas no cubran hoy", () => {
    const b = reserva({ checkin: "2026-09-20", checkout: "2026-09-21", checkinReal: "2026-09-02T21:00:00Z" });
    expect(ocupaElCuarto(b, HOY)).toBe(true);
  });

  it("🟢 EL QUE SE QUEDA DE MÁS: sigue ocupando tras su fecha de salida", () => {
    const b = reserva({ checkin: "2026-08-28", checkout: "2026-08-30", checkinReal: "2026-08-28T15:00:00Z" });
    expect(ocupaElCuarto(b, HOY)).toBe(true);
  });

  it("una cancelada no ocupa nada", () => {
    expect(ocupaElCuarto(reserva({ estado: "CANCELADA", checkin: "2026-09-01", checkout: "2026-09-05" }), HOY)).toBe(false);
  });

  it("una reembolsada tampoco (K-42)", () => {
    expect(ocupaElCuarto(reserva({ estado: "REEMBOLSADA", checkin: "2026-09-01", checkout: "2026-09-05" }), HOY)).toBe(false);
  });

  it("sin fechas y sin llegada registrada, no ocupa (no inventa ocupación)", () => {
    expect(ocupaElCuarto(reserva({ checkin: "", checkout: "" }), HOY)).toBe(false);
  });

  it("es coherente con estadoOperativo: quien está EN_CASA ocupa su cuarto", () => {
    // Si estas dos se separan, el mapa y la lista vuelven a contradecirse. Es
    // exactamente el bug que reportó el hotelero.
    const casos = [
      reserva({ checkin: "2026-09-01", checkout: "2026-09-05" }),
      reserva({ checkin: HOY, checkout: "2026-09-03", checkinReal: "2026-09-02T15:00:00Z" }),
      reserva({ checkin: "2026-08-28", checkout: "2026-08-30", checkinReal: "2026-08-28T15:00:00Z" }),
    ];
    for (const b of casos) {
      expect(estadoOperativo(b, HOY)).toBe("EN_CASA");
      expect(ocupaElCuarto(b, HOY)).toBe(true);
    }
  });

  it("y quien ya SALIÓ no ocupa nada", () => {
    const b = reserva({ checkin: "2026-09-01", checkout: "2026-09-10", checkoutReal: "2026-09-02T11:00:00Z" });
    expect(estadoOperativo(b, HOY)).toBe("SALIO");
    expect(ocupaElCuarto(b, HOY)).toBe(false);
  });
});

describe("estadoDelCuarto — qué gana, lo guardado o la ocupación", () => {
  it("sin nadie dentro, manda el estado guardado", () => {
    expect(estadoDelCuarto("LIMPIEZA", null)).toBe("LIMPIEZA");
    expect(estadoDelCuarto("MANTENIMIENTO", null)).toBe("MANTENIMIENTO");
    expect(estadoDelCuarto("DISPONIBLE", null)).toBe("DISPONIBLE");
  });

  it("la ocupación DERIVADA no pisa el aviso de la camarista", () => {
    // El calendario no sabe si el huésped llegó: a las 00:01 del día de entrada
    // no puede borrar un "limpieza pendiente" que sigue siendo cierto.
    expect(estadoDelCuarto("LIMPIEZA", { llegoYa: false })).toBe("LIMPIEZA");
    expect(estadoDelCuarto("MANTENIMIENTO", { llegoYa: false })).toBe("MANTENIMIENTO");
  });

  it("pero sí ocupa un cuarto que estaba disponible", () => {
    expect(estadoDelCuarto("DISPONIBLE", { llegoYa: false })).toBe("OCUPADA");
  });

  it("🟢 la llegada AFIRMADA pisa hasta limpieza y mantenimiento", () => {
    // Alguien delante del cuarto dice que hay un huésped dentro. Enseñar
    // "Limpieza pendiente" ahí sería esconder a una persona.
    expect(estadoDelCuarto("LIMPIEZA", { llegoYa: true })).toBe("OCUPADA");
    expect(estadoDelCuarto("MANTENIMIENTO", { llegoYa: true })).toBe("OCUPADA");
  });

  it("🔴 y NO se escribe: deshacer la llegada devuelve el cuarto a su estado exacto", () => {
    // La primera versión escribía OCUPADA en room_statuses al hacer check-in.
    // Eso pisaba el estado anterior y lo perdía para siempre, y al deshacer la
    // llegada el cuarto se quedaba OCUPADA sin nadie dentro. Derivándolo, el
    // ciclo entero es reversible: se comprobó en vivo sobre un cuarto que estaba
    // en LIMPIEZA y volvió a LIMPIEZA con su nota intacta.
    const guardado = "LIMPIEZA" as const;
    expect(estadoDelCuarto(guardado, { llegoYa: true })).toBe("OCUPADA");
    expect(estadoDelCuarto(guardado, null)).toBe("LIMPIEZA");
  });
});
