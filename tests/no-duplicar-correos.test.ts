// Las dos formas en que Kora le mandaba a un huésped un correo que no le tocaba.
// Paso 7.7 de la auditoría. Son regresiones caras porque el daño no se ve en un
// log: se ve cuando el huésped contesta desconcertado.
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 1. Doble clic en «Cancelar» ─────────────────────────────────────────────
// El UPDATE no miraba el estado, así que la segunda petición volvía a cancelar
// una reserva ya cancelada y disparaba OTRO par de correos (huésped + hotel).

/** Estado de la reserva en la BD, compartido por las dos peticiones. */
let estadoReserva = "CONFIRMADA";
const updates: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tablaBookings(): any {
  const ctx: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    update(patch: Record<string, unknown>) { ctx.patch = patch; return b; },
    delete() { ctx.op = "delete"; return b; },
    eq(col: string, val: unknown) { ctx[col] = val; return b; },
    neq(col: string, val: unknown) { ctx[`neq_${col}`] = val; return b; },
    select() { ctx.select = true; return b; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: (v: unknown) => any) {
      if (ctx.op === "delete") return res({ data: null, error: null });
      // El `.neq("estado","CANCELADA")` decide si la fila se toca.
      const casa = ctx.neq_estado === undefined || estadoReserva !== ctx.neq_estado;
      if (casa) {
        updates.push(String((ctx.patch as Record<string, unknown>).estado));
        estadoReserva = String((ctx.patch as Record<string, unknown>).estado);
      }
      return res({ data: casa ? [{ id: "b1" }] : [], error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({ from: () => tablaBookings() }),
}));
vi.mock("@/lib/db/experiencias", () => ({ liberarExperienciaVentas: async () => {} }));

const { cancelGuestBooking } = await import("@/lib/db/portal");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reserva = (): any => ({
  row: { hotel_id: "h1", id: "b1", confirmacion: "KORA-1", estado: estadoReserva },
});

describe("doble clic en Cancelar", () => {
  beforeEach(() => {
    estadoReserva = "CONFIRMADA";
    updates.length = 0;
  });

  it("la primera cancelación gana", async () => {
    const r = await cancelGuestBooking(reserva());
    expect(r.ok).toBe(true);
    expect(r.yaCancelada).toBeUndefined();
  });

  // LA REGRESIÓN: sin esto salían DOS correos al huésped y DOS al hotel.
  it("la segunda NO cancela otra vez, y lo dice", async () => {
    await cancelGuestBooking(reserva());
    const segunda = await cancelGuestBooking(reserva());
    expect(segunda.ok).toBe(false);
    expect(segunda.yaCancelada).toBe(true);
    expect(updates).toHaveLength(1); // una sola escritura, no dos
  });

  it("dos peticiones a la vez: sólo una cancela", async () => {
    const [a, b] = await Promise.all([cancelGuestBooking(reserva()), cancelGuestBooking(reserva())]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(updates).toHaveLength(1);
  });
});
