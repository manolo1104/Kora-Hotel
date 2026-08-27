// K-12 y K-43: la reserva metida A MANO desde el panel no pasaba por el candado.
//
// Eran un `insert` suelto en `bookings` y otro en `blocks`. Dos personas metiendo
// reservas a la vez —o una a mano mientras entra otra por el motor— podían
// vender el mismo cuarto dos veces sin que nada lo impidiera.
//
// La decisión de negocio (26 ago 2026) fue conservar la salida de emergencia:
// por defecto se bloquea, pero con una casilla explícita se puede meter encima
// de otra, y queda escrito en las notas quién y cuándo.
import { describe, it, expect, vi, beforeEach } from "vitest";

type ResultadoAtomico = { ok: boolean; confirmacion?: string; unavailable?: boolean; error?: string };
let atomicResult: ResultadoAtomico = { ok: true };
/** Cola de respuestas para probar el reintento de folio. Vacía = manda `atomicResult`. */
let atomicCola: ResultadoAtomico[] = [];
const atomicLlamadas: Array<Record<string, unknown>> = [];
const inserts: Array<{ tabla: string; filas: unknown }> = [];

vi.mock("@/lib/db/bookings", async (original) => {
  // `generarConfirmacion` se deja REAL: el folio es parte de lo que se prueba
  // (el reintento cuando choca con el índice único).
  const real = await original<typeof import("@/lib/db/bookings")>();
  return {
    ...real,
    createBookingAtomic: async (hotelId: string, input: Record<string, unknown>) => {
      atomicLlamadas.push({ hotelId, ...input });
      return atomicCola.length ? atomicCola.shift()! : atomicResult;
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tabla(nombre: string): any {
  const ctx: Record<string, unknown> = { tabla: nombre };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    insert(filas: unknown) { ctx.op = "insert"; ctx.filas = filas; return b; },
    select() { return b; },
    eq() { return b; },
    async single() {
      inserts.push({ tabla: nombre, filas: ctx.filas });
      return { data: { id: "book-1" }, error: null };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: (v: unknown) => any) {
      if (ctx.op === "insert") inserts.push({ tabla: nombre, filas: ctx.filas });
      return res({ data: null, error: null });
    },
  };
  return b;
}
vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({ from: (n: string) => tabla(n) }),
}));

const { createManualBooking } = await import("@/lib/db/admin");

const HOTEL = "aaaaaaaa-0000-0000-0000-00000000000a";
const DATOS = {
  cliente: "Ana", telefono: "444", email: "a@b.com",
  habitacion: "Cabaña, Cabaña 2", checkin: "2026-12-10", checkout: "2026-12-12",
  noches: 2, huespedes: 4, total: 4000, notas: "Llega tarde", anticipo: 2000,
};

beforeEach(() => {
  atomicResult = { ok: true, confirmacion: "KO-1234" };
  atomicCola = [];
  atomicLlamadas.length = 0;
  inserts.length = 0;
});

describe("por defecto pasa por el candado atómico", () => {
  it("usa createBookingAtomic, no el insert suelto", async () => {
    const r = await createManualBooking(HOTEL, DATOS, "KO");
    expect(r).toMatchObject({ ok: true, confirmacion: "KO-1234" });
    expect(atomicLlamadas).toHaveLength(1);
    expect(inserts).toHaveLength(0); // el camino viejo no se toca
  });

  it("la manda como MANUAL, de origen manual y sin pago", async () => {
    await createManualBooking(HOTEL, DATOS, "KO");
    expect(atomicLlamadas[0]).toMatchObject({
      estado: "MANUAL", origen: "manual", paymentIntentId: null,
      habitaciones: ["Cabaña", "Cabaña 2"],
    });
  });

  // LO QUE ANTES NO PASABA: el cuarto ocupado ya no se puede vender dos veces.
  it("si el cuarto está ocupado, NO la crea", async () => {
    atomicResult = { ok: false, unavailable: true, error: "CUARTO_NO_DISPONIBLE: Cabaña" };
    const r = await createManualBooking(HOTEL, DATOS, "KO");
    expect(r).toMatchObject({ ok: false, unavailable: true });
    expect(inserts).toHaveLength(0);
  });

  // El folio son 4 caracteres al azar y choca con el índice único más a menudo
  // de lo que sugiere la intuición: el reintento tiene que sobrevivir al cambio.
  it("un folio repetido se reintenta con otro", async () => {
    atomicCola = [
      { ok: false, error: 'duplicate key value violates "confirmacion"' },
      { ok: true, confirmacion: "KO-9999" },
    ];
    const r = await createManualBooking(HOTEL, DATOS, "KO");
    expect(r).toMatchObject({ ok: true, confirmacion: "KO-9999" });
    expect(atomicLlamadas).toHaveLength(2);
    // Y el segundo intento va con un folio DISTINTO, no con el mismo.
    expect(atomicLlamadas[0].confirmacion).not.toBe(atomicLlamadas[1].confirmacion);
  });
});

describe("la salida de emergencia: forzar", () => {
  it("se salta el candado y usa el camino directo", async () => {
    const r = await createManualBooking(HOTEL, DATOS, "KO", { forzar: true, forzadoPor: "user-7" });
    expect(r.ok).toBe(true);
    expect(atomicLlamadas).toHaveLength(0);
    expect(inserts.map((i) => i.tabla)).toEqual(["bookings", "blocks"]);
  });

  // NUNCA en silencio: es lo que permite reconstruir después por qué había dos
  // personas en la misma cabaña.
  it("deja el rastro en las notas, con quién lo hizo", async () => {
    await createManualBooking(HOTEL, DATOS, "KO", { forzar: true, forzadoPor: "user-7" });
    const fila = inserts.find((i) => i.tabla === "bookings")!.filas as { notas: string };
    expect(fila.notas).toContain("Llega tarde"); // no pisa lo que ya había
    expect(fila.notas).toContain("FORZADA");
    expect(fila.notas).toContain("user-7");
  });

  it("bloquea las unidades igual que una reserva normal", async () => {
    await createManualBooking(HOTEL, DATOS, "KO", { forzar: true });
    const filas = inserts.find((i) => i.tabla === "blocks")!.filas as Array<{ habitacion: string; status: string }>;
    expect(filas.map((f) => f.habitacion)).toEqual(["Cabaña", "Cabaña 2"]);
    expect(filas.every((f) => f.status === "RESERVADO")).toBe(true);
  });
});
