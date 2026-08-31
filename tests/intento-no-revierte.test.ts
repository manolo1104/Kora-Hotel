// El correo "termina tu reserva" que le llegaba a quien YA había reservado.
// Paso 7.7 de la auditoría.
//
// `/api/h/[slug]/intento` guarda el correo del huésped a mitad del checkout para
// que el cron de abandono pueda escribirle si no termina. El upsert ponía
// `convertido: false` y `recordatorio_enviado_at: null` EXPLÍCITAMENTE, así que
// un huésped que ya había pagado —el webhook le pone `convertido: true`— y volvía
// a entrar al motor a mirar fechas se marcaba otra vez como carrito abandonado.
// Al día siguiente recibía "termina tu reserva" con su folio ya en la mano.
import { describe, it, expect, vi } from "vitest";

let upsertPayload: Record<string, unknown> = {};

vi.mock("@/lib/tenant", () => ({
  resolveHotel: async () => ({ id: "h1", slug: "hotel-x", extras: {} }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({
    from: () => ({
      upsert(fila: Record<string, unknown>) {
        upsertPayload = fila;
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));
vi.mock("@/lib/db/result", () => ({
  escribirMejorEsfuerzo: async (_n: string, q: unknown) => { await q; },
}));

const { POST } = await import("@/app/api/h/[slug]/intento/route");

async function capturar() {
  upsertPayload = {};
  const req = new Request("http://localhost/api/h/hotel-x/intento", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "Ana@Ejemplo.TEST", nombre: "Ana", payload: { checkin: "2026-09-07" } }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST(req as any, { params: Promise.resolve({ slug: "hotel-x" }) });
}

describe("captura del correo en el checkout", () => {
  it("guarda lo suyo: correo, nombre, idioma y el carrito", async () => {
    await capturar();
    expect(upsertPayload).toMatchObject({
      hotel_id: "h1",
      email: "ana@ejemplo.test", // normalizado a minúsculas
      nombre: "Ana",
    });
  });

  // LA REGRESIÓN: estos dos campos son de quien los escribe (el webhook cuando
  // la reserva se paga, y el propio cron cuando manda el recordatorio). Esta
  // ruta no puede tocarlos, o le devuelve la vida a un carrito ya convertido.
  it("NO toca `convertido` ni `recordatorio_enviado_at`", async () => {
    await capturar();
    expect(upsertPayload).not.toHaveProperty("convertido");
    expect(upsertPayload).not.toHaveProperty("recordatorio_enviado_at");
  });
});
