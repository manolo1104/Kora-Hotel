// La red que protege a la red. `lib/db/result.ts` es el punto único del que
// dependen las ~90 lecturas y escrituras migradas en la Etapa 4: si `leer`
// confundiera "hubo un error" con "no hay filas", el bug volvería entero y en
// todas partes a la vez, sin que nada avisara.
import { describe, it, expect, vi } from "vitest";
import { leer, escribir, escribirMejorEsfuerzo, DbError } from "@/lib/db/result";

/** Imita lo que devuelve supabase-js: un thenable con `{ data, error }`. */
function respuesta<T>(data: T | null, error: { message: string; code?: string } | null) {
  return Promise.resolve({ data, error });
}

describe("leer", () => {
  it("lanza DbError cuando la consulta falla", async () => {
    await expect(leer("x", respuesta(null, { message: "boom", code: "42P01" }))).rejects.toBeInstanceOf(
      DbError,
    );
  });

  it("el error conserva etiqueta y código para poder rastrearlo en los logs", async () => {
    await expect(leer("hotel.porSlug", respuesta(null, { message: "boom", code: "42P01" }))).rejects.toMatchObject(
      { etiqueta: "hotel.porSlug", code: "42P01" },
    );
  });

  // EL CORAZÓN DE LOS 45 CASOS: cero filas NO es un error. Confundirlos es lo
  // que convertía un parpadeo de Supabase en "este hotel no existe" (404
  // indexable), "no eres miembro" (hotelero expulsado de su panel) o "cuarto
  // disponible" (sobreventa).
  it("devuelve null sin lanzar cuando no hay filas", async () => {
    await expect(leer("x", respuesta(null, null))).resolves.toBeNull();
  });

  it("devuelve los datos tal cual cuando los hay", async () => {
    await expect(leer("x", respuesta({ id: "abc" }, null))).resolves.toEqual({ id: "abc" });
  });

  it("una lista vacía es una lista vacía, no null", async () => {
    await expect(leer("x", respuesta([], null))).resolves.toEqual([]);
  });
});

describe("escribir", () => {
  it("lanza si la escritura falla", async () => {
    await expect(escribir("x", respuesta(null, { message: "no se pudo" }))).rejects.toBeInstanceOf(DbError);
  });

  it("no lanza si la escritura fue bien", async () => {
    await expect(escribir("x", respuesta(null, null))).resolves.toBeUndefined();
  });
});

describe("escribirMejorEsfuerzo", () => {
  it("devuelve false y NO lanza cuando falla", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(escribirMejorEsfuerzo("x", respuesta(null, { message: "boom" }))).resolves.toBe(false);
    expect(spy).toHaveBeenCalled(); // deja rastro: "mejor esfuerzo" no es "en silencio"
    spy.mockRestore();
  });

  it("devuelve true cuando funciona", async () => {
    await expect(escribirMejorEsfuerzo("x", respuesta(null, null))).resolves.toBe(true);
  });
});
