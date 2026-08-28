// Paso 3.15 — el cupo de las experiencias.
//
// EL DEFECTO (K-100): el bucle de la caja comparaba CADA línea contra lo ya
// vendido sin acumular lo que la propia reserva iba consumiendo. Dos líneas de
// la misma experiencia el mismo día se comparaban las dos contra el mismo
// número y pasaban las dos: un tour de 8 lugares se vendía dos veces a 5
// personas en una sola compra, y el hotelero se enteraba el día del tour con 10
// personas en la puerta de una lancha de 8.
import { describe, it, expect } from "vitest";
import { validarCupoExperiencias } from "@/lib/booking/engine";

const CUPOS = { "Tour Tamul": 8, "Cena romántica": 2 };

describe("el cupo cuenta lo que esta misma reserva consume", () => {
  it("una línea que cabe pasa", () => {
    const r = validarCupoExperiencias(
      [{ experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 5 }],
      CUPOS,
      {},
    );
    expect(r.ok).toBe(true);
  });

  // EL DEFECTO, exactamente.
  it("dos líneas de la MISMA experiencia y día NO pasan si juntas se salen", () => {
    const r = validarCupoExperiencias(
      [
        { experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 5 },
        { experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 5 },
      ],
      CUPOS,
      {},
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.experiencia).toBe("Tour Tamul");
    // Quedaban 3 tras la primera línea: eso es lo que se le dice al huésped.
    expect(!r.ok && r.restante).toBe(3);
  });

  it("dos líneas que SÍ caben juntas pasan", () => {
    const r = validarCupoExperiencias(
      [
        { experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 4 },
        { experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 4 },
      ],
      CUPOS,
      {},
    );
    expect(r.ok).toBe(true);
  });

  it("la misma experiencia en DÍAS distintos no se estorba", () => {
    const r = validarCupoExperiencias(
      [
        { experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 8 },
        { experiencia: "Tour Tamul", fecha: "2027-07-02", qty: 8 },
      ],
      CUPOS,
      {},
    );
    expect(r.ok).toBe(true);
  });

  it("lo ya vendido (y lo APARTADO por otros) cuenta", () => {
    const r = validarCupoExperiencias(
      [{ experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 3 }],
      CUPOS,
      { "Tour Tamul": { "2027-07-01": 6 } },
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.restante).toBe(2);
  });

  it("una experiencia SIN cupo configurado no se limita", () => {
    const r = validarCupoExperiencias(
      [{ experiencia: "Paseo libre", fecha: "2027-07-01", qty: 999 }],
      CUPOS,
      {},
    );
    expect(r.ok).toBe(true);
  });

  it("señala la PRIMERA experiencia que se pasa, no una cualquiera", () => {
    const r = validarCupoExperiencias(
      [
        { experiencia: "Cena romántica", fecha: "2027-07-01", qty: 3 },
        { experiencia: "Tour Tamul", fecha: "2027-07-01", qty: 99 },
      ],
      CUPOS,
      {},
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.experiencia).toBe("Cena romántica");
  });
});
