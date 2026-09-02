// El check-in de una reserva contra la base: `checkinBooking` y `deshacerCheckin`.
//
// POR QUÉ EXISTE: Kora tenía check-out pero no check-in, y el check-out se
// desplegó SIN una sola prueba. Como este es su espejo exacto y toca la misma
// columna de la misma tabla, se paga aquí la deuda de los dos.

import { describe, it, expect, vi, beforeEach } from "vitest";

/** La fila que "está" en Postgres. Cada prueba la reescribe. */
let fila: Record<string, unknown> | null = null;
/** Lo que se intentó escribir, y con qué filtros: es lo que de verdad importa. */
let ultimoUpdate: { patch: Record<string, unknown>; filtros: Record<string, unknown> } | null = null;
/** Para simular que Postgres falla al escribir. */
let errorAlEscribir: { message: string } | null = null;
/** Para simular que Postgres falla al LEER — que es donde falla sin el SQL. */
let errorAlLeer: { message: string; code?: string } | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tablaBookings(): any {
  const ctx: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select() { ctx.op = "select"; return b; },
    update(patch: Record<string, unknown>) { ctx.op = "update"; ctx.patch = patch; return b; },
    eq(col: string, val: unknown) { ctx[col] = val; return b; },
    maybeSingle() {
      if (errorAlLeer) return Promise.resolve({ data: null, error: errorAlLeer });
      // El aislamiento por hotel se hace en el código, no con RLS: si la
      // consulta no filtra por hotel_id, esto devuelve null a propósito.
      const mio = fila && fila.hotel_id === ctx.hotel_id && fila.confirmacion === ctx.confirmacion;
      return Promise.resolve({ data: mio ? fila : null, error: null });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: (v: unknown) => any) {
      if (ctx.op === "update") {
        const { patch, op, ...filtros } = ctx;
        void op;
        ultimoUpdate = { patch: patch as Record<string, unknown>, filtros };
        if (!errorAlEscribir && fila) Object.assign(fila, patch);
        return res({ data: null, error: errorAlEscribir });
      }
      return res({ data: null, error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({ from: () => tablaBookings() }),
}));

const { checkinBooking, deshacerCheckin } = await import("@/lib/db/admin");

const HOTEL = "hotel-1";
const OTRO_HOTEL = "hotel-2";
const FOLIO = "KO-2026-ACJ3"; // prefijo con letra O, no cero

function sembrar(p: Record<string, unknown> = {}) {
  fila = {
    id: "b1",
    hotel_id: HOTEL,
    confirmacion: FOLIO,
    estado: "CONFIRMADA",
    habitaciones: "Suite Jungla, Lirios 2",
    checkin_real: null,
    checkout_real: null,
    ...p,
  };
}

beforeEach(() => { sembrar(); ultimoUpdate = null; errorAlEscribir = null; errorAlLeer = null; });

describe("checkinBooking", () => {
  it("registra la llegada y devuelve los cuartos del CSV, ya separados", async () => {
    const r = await checkinBooking(HOTEL, FOLIO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.habitaciones).toEqual(["Suite Jungla", "Lirios 2"]);
    expect(new Date(r.cuando).toString()).not.toBe("Invalid Date");
    expect(ultimoUpdate?.patch).toEqual({ checkin_real: r.cuando });
  });

  it("es IDEMPOTENTE: dos clics no reescriben la hora de llegada", async () => {
    const primera = await checkinBooking(HOTEL, FOLIO);
    ultimoUpdate = null;
    const segunda = await checkinBooking(HOTEL, FOLIO);
    expect(segunda.ok).toBe(true);
    if (!primera.ok || !segunda.ok) return;
    expect(segunda.cuando).toBe(primera.cuando);
    expect(ultimoUpdate).toBeNull(); // ni siquiera intentó escribir
  });

  it("escribe con hotel_id además del id: nunca toca la fila de otro hotel", async () => {
    await checkinBooking(HOTEL, FOLIO);
    expect(ultimoUpdate?.filtros).toMatchObject({ id: "b1", hotel_id: HOTEL });
  });

  it("no encuentra la reserva de OTRO hotel aunque acierte el folio", async () => {
    const r = await checkinBooking(OTRO_HOTEL, FOLIO);
    expect(r).toEqual({ ok: false, error: "no-encontrada" });
    expect(ultimoUpdate).toBeNull();
  });

  it("rechaza una CANCELADA: no hay a quién recibir", async () => {
    sembrar({ estado: "CANCELADA" });
    expect(await checkinBooking(HOTEL, FOLIO)).toEqual({ ok: false, error: "reserva-sin-valor" });
  });

  it("rechaza una REEMBOLSADA (K-42: no basta con mirar CANCELADA)", async () => {
    sembrar({ estado: "REEMBOLSADA" });
    expect(await checkinBooking(HOTEL, FOLIO)).toEqual({ ok: false, error: "reserva-sin-valor" });
  });

  it("rechaza a quien ya se le hizo check-out: primero hay que deshacer la salida", async () => {
    // Sin esto la reserva quedaría llegada Y salida a la vez, y el cuarto
    // ocupado por alguien que ya se fue.
    sembrar({ checkout_real: "2026-09-02T18:00:00.000Z" });
    expect(await checkinBooking(HOTEL, FOLIO)).toEqual({ ok: false, error: "ya-salio" });
    expect(ultimoUpdate).toBeNull();
  });

  it("una reserva MANUAL (la del walk-in) sí se puede registrar", async () => {
    sembrar({ estado: "MANUAL" });
    expect((await checkinBooking(HOTEL, FOLIO)).ok).toBe(true);
  });

  it("si Postgres falla, lo dice — no devuelve ok con la llegada sin guardar", async () => {
    errorAlEscribir = { message: "boom" };
    expect(await checkinBooking(HOTEL, FOLIO)).toEqual({ ok: false, error: "no-se-pudo-guardar" });
  });

  it("si aún no se corrió el SQL lo distingue — y falla en la LECTURA, no en la escritura", async () => {
    // MEDIDO en localhost contra la base real antes de correr el SQL. Este es el
    // mensaje literal que devolvió PostgREST. Importa que sea la lectura: la
    // lista de reservas usa `select("*")` y sobrevive sin la columna, pero esta
    // consulta la NOMBRA, así que revienta antes de intentar escribir nada.
    errorAlLeer = { message: "column bookings.checkin_real does not exist" };
    expect(await checkinBooking(HOTEL, FOLIO)).toEqual({ ok: false, error: "falta-columna" });
    expect(ultimoUpdate).toBeNull();
  });

  it("también lo distingue por el código 42703, si PostgREST no manda el mensaje", async () => {
    errorAlLeer = { message: "error de base de datos", code: "42703" };
    expect(await checkinBooking(HOTEL, FOLIO)).toEqual({ ok: false, error: "falta-columna" });
  });

  it("un error de lectura CUALQUIERA no se confunde con el SQL pendiente", async () => {
    errorAlLeer = { message: "connection reset by peer" };
    expect(await checkinBooking(HOTEL, FOLIO)).toEqual({ ok: false, error: "no-se-pudo-leer" });
  });
});

describe("deshacerCheckin", () => {
  it("borra la hora de llegada", async () => {
    await checkinBooking(HOTEL, FOLIO);
    expect(await deshacerCheckin(HOTEL, FOLIO)).toBe(true);
    expect(ultimoUpdate?.patch).toEqual({ checkin_real: null });
  });

  it("filtra por hotel_id: no puede borrar la llegada de otro hotel", async () => {
    await deshacerCheckin(HOTEL, FOLIO);
    expect(ultimoUpdate?.filtros).toMatchObject({ hotel_id: HOTEL, confirmacion: FOLIO });
  });

  it("devuelve false si Postgres falla", async () => {
    errorAlEscribir = { message: "boom" };
    expect(await deshacerCheckin(HOTEL, FOLIO)).toBe(false);
  });
});
