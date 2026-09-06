// Los avisos que le faltaban al panel: cosas que el hotelero está publicando y
// que nadie le decía. Los tres salieron de revisar hoteles REALES en producción,
// no de imaginar casos.
import { describe, it, expect } from "vitest";
import { diagnosticarHotel } from "@/lib/panel/diagnostico";
import type { HotelRow } from "@/lib/tenant";

function hotelCon(habitaciones: unknown[], extras: Record<string, unknown> = {}): HotelRow {
  return {
    id: "h1", owner_id: "u1", slug: "hotel-prueba", nombre: "Hotel de prueba",
    publicado: true, created_at: "2026-01-01T00:00:00Z",
    habitaciones, extras, config: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const CUARTO_SANO = { nombre: "Suite Jungla", precio: 1900, capacidad: 4 };

describe("una habitación de prueba publicada", () => {
  // El Paraíso —el hotel del demo de la portada— ofrecía una «Habitación de
  // prueba» a $10 la noche en su página pública, y en el desplegable del motor.
  it("se detecta por el nombre", () => {
    const d = diagnosticarHotel(hotelCon([CUARTO_SANO, { nombre: "Habitación de prueba", precio: 10, capacidad: 2 }]));
    expect(d.cuartosDePrueba.ok).toBe(false);
    expect(d.cuartosDePrueba.aviso).toContain("Habitación de prueba");
  });

  it("un hotel sin cuartos de prueba pasa limpio", () => {
    expect(diagnosticarHotel(hotelCon([CUARTO_SANO])).cuartosDePrueba.ok).toBe(true);
  });

  // "Suite Repruebo" no es un cuarto de prueba: el aviso mira palabras enteras.
  it("no salta por una palabra que sólo CONTIENE 'prueba'", () => {
    expect(diagnosticarHotel(hotelCon([{ nombre: "Suite Compruebo", precio: 1500, capacidad: 2 }])).cuartosDePrueba.ok).toBe(true);
  });
});

describe("precios por número de personas incoherentes", () => {
  // El caso real: una suite que duerme 4 con una fila de 5 personas a $1,500.
  // La página anuncia el mínimo de la tabla y el motor cobra el escalón que toca,
  // así que el huésped ve "desde $1,500" y le cobran $1,900 — y los $1,500 no los
  // podía conseguir nadie, porque no caben cinco.
  it("un escalón por encima de la capacidad del cuarto", () => {
    const d = diagnosticarHotel(hotelCon([
      { nombre: "Suite Jungla", precio: 1900, capacidad: 4, tarifas: [{ personas: 2, precio: 1900 }, { personas: 5, precio: 1500 }] },
    ]));
    expect(d.tarifasCoherentes.ok).toBe(false);
    expect(d.tarifasCoherentes.aviso).toContain("Suite Jungla");
  });

  // Un precio que BAJA al subir huéspedes es siempre un error de captura.
  it("un precio que abarata al subir personas", () => {
    const d = diagnosticarHotel(hotelCon([
      { nombre: "Cabaña", precio: 2000, capacidad: 6, tarifas: [{ personas: 2, precio: 2400 }, { personas: 4, precio: 1800 }] },
    ]));
    expect(d.tarifasCoherentes.ok).toBe(false);
  });

  it("una tabla que sube con las personas está bien", () => {
    const d = diagnosticarHotel(hotelCon([
      { nombre: "Cabaña", precio: 2000, capacidad: 4, tarifas: [{ personas: 2, precio: 2000 }, { personas: 4, precio: 2800 }] },
    ]));
    expect(d.tarifasCoherentes.ok).toBe(true);
  });

  it("sin tabla de tarifas no hay nada que avisar", () => {
    expect(diagnosticarHotel(hotelCon([CUARTO_SANO])).tarifasCoherentes.ok).toBe(true);
  });
});

describe("la nota de cancelación que contradice la política", () => {
  // El huésped lee las dos y la que se aplica es la del sistema: si reclama,
  // tiene el texto del hotel por escrito a su favor.
  it("una nota con días y porcentajes salta", () => {
    const d = diagnosticarHotel(
      hotelCon([CUARTO_SANO], { politicas: { cancelacion: "Cancelaciones con 3 días de anticipación (50%)." } }),
    );
    expect(d.politicaCoherente.ok).toBe(false);
  });

  // Una nota que sólo explica CÓMO cancelar no contradice nada.
  it("una nota sin números no salta", () => {
    const d = diagnosticarHotel(
      hotelCon([CUARTO_SANO], { politicas: { cancelacion: "Avísanos por WhatsApp y te ayudamos con el cambio." } }),
    );
    expect(d.politicaCoherente.ok).toBe(true);
  });

  it("sin nota, todo en orden", () => {
    expect(diagnosticarHotel(hotelCon([CUARTO_SANO])).politicaCoherente.ok).toBe(true);
  });
});
