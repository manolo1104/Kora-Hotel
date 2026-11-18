// Lo que se enseña desde «Corregir» no puede borrarse con el siguiente
// autoguardado de la pantalla de Camila (que tenía una copia vieja de la lista).
import { describe, it, expect } from "vitest";
import { mergeFaqs } from "@/lib/bot/faqs";

const F = (q: string, a: string) => ({ q, a });

describe("guardar las preguntas frecuentes sin pisar lo de otros", () => {
  it("una corrección hecha desde la bandeja SOBREVIVE al autoguardado de la pantalla", () => {
    const base = [F("¿Hay estacionamiento?", "Sí, gratis")];
    // Mientras la pantalla estaba abierta, «Corregir» agregó una en el servidor.
    const actual = [...base, F("¿Aceptan perros?", "Sí, hasta 10 kg")];
    // La pantalla cambia sólo el estacionamiento.
    const nuevo = [F("¿Hay estacionamiento?", "Sí, gratis y techado")];
    expect(mergeFaqs(actual, base, nuevo)).toEqual([
      F("¿Hay estacionamiento?", "Sí, gratis y techado"),
      F("¿Aceptan perros?", "Sí, hasta 10 kg"),
    ]);
  });

  it("lo que el hotelero borró en la pantalla, se borra", () => {
    const base = [F("¿Hay estacionamiento?", "Sí"), F("¿Tienen alberca?", "Sí")];
    const nuevo = [F("¿Tienen alberca?", "Sí")];
    expect(mergeFaqs(base, base, nuevo)).toEqual([F("¿Tienen alberca?", "Sí")]);
  });

  it("lo que agregó, se agrega", () => {
    const nuevo = [F("¿Facturan?", "Sí")];
    expect(mergeFaqs([], [], nuevo)).toEqual(nuevo);
  });

  it("la misma pregunta escrita distinto (acentos, signos) es la misma", () => {
    const actual = [F("¿Aceptan mascotas?", "No")];
    const base = [F("Aceptan mascotas", "No")];
    const nuevo = [F("Aceptan mascotas", "Sí, perros pequeños")];
    expect(mergeFaqs(actual, base, nuevo)).toEqual([F("Aceptan mascotas", "Sí, perros pequeños")]);
  });

  it("si nadie tocó nada, no cambia nada", () => {
    const l = [F("a", "1"), F("b", "2")];
    expect(mergeFaqs(l, l, l)).toEqual(l);
  });
});
