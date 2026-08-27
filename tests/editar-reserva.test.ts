// K-45 y K-46: editar una reserva le evaporaba la ocupación.
//
// El panel hacía DELETE de los `blocks` de la reserva y DESPUÉS decidía con qué
// reconstruirlos. Dos escrituras sueltas, sin transacción: si el borrado pasaba
// y el alta no —o si la lectura intermedia fallaba—, quedaba una reserva
// CONFIRMADA viva con su cuarto LIBRE en el calendario. Para siempre, y sin que
// nadie se entere hasta que dos huéspedes llegan a la misma cabaña.
import { describe, it, expect, vi, beforeEach } from "vitest";

let rpcError: { message: string; code?: string } | null = null;
let filaPrevia: Record<string, unknown> | null = { checkin: "2026-12-10", checkout: "2026-12-12" };
const rpcLlamadas: Array<Record<string, unknown>> = [];
const updates: Array<Record<string, unknown>> = [];
const borrados: string[] = [];
const inserts: Array<unknown[]> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tabla(nombre: string): any {
  const ctx: Record<string, unknown> = { tabla: nombre };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select(cols: string) { ctx.op = "select"; ctx.cols = cols; return b; },
    update(patch: Record<string, unknown>) { ctx.op = "update"; ctx.patch = patch; return b; },
    delete() { ctx.op = "delete"; return b; },
    insert(filas: unknown[]) { ctx.op = "insert"; ctx.filas = filas; return b; },
    eq() { return b; },
    async maybeSingle() { return { data: filaPrevia, error: null }; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: (v: unknown) => any) {
      if (ctx.op === "update") updates.push(ctx.patch as Record<string, unknown>);
      if (ctx.op === "delete") borrados.push(String(ctx.tabla));
      if (ctx.op === "insert") inserts.push(ctx.filas as unknown[]);
      return res({ data: null, error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: (n: string) => tabla(n),
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      rpcLlamadas.push({ nombre, ...args });
      return { data: null, error: rpcError };
    },
  }),
}));

const { updateBooking } = await import("@/lib/db/admin");

const HOTEL = "aaaaaaaa-0000-0000-0000-00000000000a";
const RESERVA = "11111111-0000-0000-0000-000000000001";

beforeEach(() => {
  rpcError = null;
  filaPrevia = { checkin: "2026-12-10", checkout: "2026-12-12" };
  rpcLlamadas.length = 0; updates.length = 0; borrados.length = 0; inserts.length = 0;
});

describe("cuando el RPC atómico existe", () => {
  it("mover fechas usa el RPC, no el borra-y-repón suelto", async () => {
    const r = await updateBooking(HOTEL, RESERVA, { checkin: "2026-12-18", checkout: "2026-12-19" });
    expect(r.ok).toBe(true);
    expect(rpcLlamadas[0]).toMatchObject({ nombre: "resync_blocks_reserva", p_booking_id: RESERVA });
    expect(borrados).not.toContain("blocks"); // el camino viejo no se toca
  });

  // LO QUE IMPORTA: al chocar, la reserva vuelve a como estaba. Si no, quedaría
  // con las fechas nuevas y los bloqueos con las viejas.
  it("si el cuarto nuevo está ocupado, DESHACE la edición de la reserva", async () => {
    rpcError = { message: "CUARTO_NO_DISPONIBLE: Cabaña", code: "23514" };
    const r = await updateBooking(HOTEL, RESERVA, { checkin: "2026-12-20", checkout: "2026-12-22" });
    expect(r).toMatchObject({ ok: false, unavailable: true });
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ checkin: "2026-12-20" }); // se aplicó…
    expect(updates[1]).toMatchObject({ checkin: "2026-12-10" }); // …y se deshizo
  });

  it("un error de base que no es el choque LANZA, no se traga", async () => {
    rpcError = { message: "boom", code: "XX000" };
    await expect(
      updateBooking(HOTEL, RESERVA, { checkin: "2026-12-18", checkout: "2026-12-19" }),
    ).rejects.toThrow();
  });

  // Editar sólo el nombre no toca la ocupación: ni RPC ni relectura.
  it("cambiar datos que no son fechas ni cuarto no llama al RPC", async () => {
    const r = await updateBooking(HOTEL, RESERVA, { cliente: "Ana" });
    expect(r.ok).toBe(true);
    expect(rpcLlamadas).toHaveLength(0);
  });

  it("sin campos editables no escribe nada", async () => {
    const r = await updateBooking(HOTEL, RESERVA, {});
    expect(r.ok).toBe(true);
    expect(updates).toHaveLength(0);
  });
});

// Respaldo mientras `sql/kora-inventario-fase4.sql` no esté corrido: se conserva
// el camino viejo para no romper la edición entera, y se avisa en el log.
describe("cuando el RPC todavía no existe en la base", () => {
  it("cae al camino viejo y avisa", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    rpcError = { message: "function does not exist", code: "42883" };
    const r = await updateBooking(HOTEL, RESERVA, { checkin: "2026-12-18", checkout: "2026-12-19" });
    expect(r.ok).toBe(true);
    expect(borrados).toContain("blocks");
    expect(warn.mock.calls.flat().join(" ")).toMatch(/resync_blocks_reserva/);
    warn.mockRestore();
  });
});
