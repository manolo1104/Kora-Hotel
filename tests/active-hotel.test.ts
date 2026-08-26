// El aislamiento entre hoteles. `getActiveHotel` es la puerta de TODAS las rutas
// /api/admin/*: si aceptara una cookie apuntando a un hotel del que el usuario
// no es miembro, cualquier hotelero podría leer y editar las reservas de otro.
//
// Con mocks y no con una Postgres local sembrada: la decisión que hay que probar
// vive ENTERA en active-hotel.ts (cookie → membresía → bloqueo), y montar una
// base de dos usuarios es medio día de infraestructura en un Mac que va justo de
// memoria. El test de integración queda anotado como trabajo de otra etapa.
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieActual = { valor: undefined as string | undefined };
const membresias: Record<string, unknown> = {};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "kora_active_slug" && cookieActual.valor
        ? { name: nombre, value: cookieActual.valor }
        : undefined,
  }),
}));

vi.mock("@/lib/tenant", () => ({
  getHotelMember: async (slug: string) => membresias[slug] ?? null,
}));

const { getActiveHotel } = await import("@/lib/panel/active-hotel");

function ctx(slug: string, extras: Record<string, unknown> | null = null) {
  return {
    hotelId: `id-${slug}`,
    hotel: { id: `id-${slug}`, slug, nombre: slug, extras },
    rol: "dueno",
    userId: "u1",
  };
}

beforeEach(() => {
  cookieActual.valor = undefined;
  for (const k of Object.keys(membresias)) delete membresias[k];
});

describe("getActiveHotel", () => {
  it("sin cookie no hay hotel activo", async () => {
    await expect(getActiveHotel()).resolves.toBeNull();
  });

  it("cookie de un hotel del que SÍ es miembro → devuelve su contexto", async () => {
    membresias["hotel-a"] = ctx("hotel-a");
    cookieActual.valor = "hotel-a";
    await expect(getActiveHotel()).resolves.toMatchObject({ hotelId: "id-hotel-a" });
  });

  // EL CASO DE AISLAMIENTO: la cookie se puede editar desde el navegador. Lo que
  // impide leer el hotel de otro no es la cookie, es la membresía.
  it("cookie manipulada a un hotel ajeno → null (la ruta responde 401)", async () => {
    membresias["hotel-a"] = ctx("hotel-a");
    cookieActual.valor = "hotel-b"; // no está en `membresias`
    await expect(getActiveHotel()).resolves.toBeNull();
  });

  // La puerta de atrás que cierra active-hotel.ts: sin esto, el dueño de una
  // cuenta bloqueada seguiría editando reservas llamando a la API directo,
  // aunque el panel no se le abriera.
  it("hotel bloqueado por Kora → null aunque sea su dueño", async () => {
    membresias["hotel-a"] = ctx("hotel-a", { bloqueo: { activo: true, mensaje: "Falta de pago" } });
    cookieActual.valor = "hotel-a";
    await expect(getActiveHotel()).resolves.toBeNull();
  });

  it("bloqueo desactivado NO cierra el paso", async () => {
    membresias["hotel-a"] = ctx("hotel-a", { bloqueo: { activo: false } });
    cookieActual.valor = "hotel-a";
    await expect(getActiveHotel()).resolves.toMatchObject({ hotelId: "id-hotel-a" });
  });
});
