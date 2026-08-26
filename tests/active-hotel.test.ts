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
const cabeceras: Record<string, string | undefined> = {};
const membresias: Record<string, unknown> = {};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "kora_active_slug" && cookieActual.valor
        ? { name: nombre, value: cookieActual.valor }
        : undefined,
  }),
  headers: async () => ({
    get: (nombre: string) => cabeceras[nombre.toLowerCase()] ?? null,
  }),
}));

vi.mock("@/lib/tenant", () => ({
  getHotelMember: async (slug: string) => membresias[slug] ?? null,
}));

const { getActiveHotel, slugActivo } = await import("@/lib/panel/active-hotel");

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
  for (const k of Object.keys(cabeceras)) delete cabeceras[k];
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

// ── De dónde sale el slug ────────────────────────────────────────────────────
// El bug que esto arregla: la cookie es del NAVEGADOR ENTERO, no de la pestaña.
// Con Alma Nativa abierta en una pestaña y Estancia Pachita en otra, la última
// que se tocó ganaba — y "Cancelar reserva" en la primera cancelaba en la
// segunda. `Referer` y `x-kora-hotel` sí son por pestaña.
describe("slugActivo — precedencia de fuentes", () => {
  it("sin nada, no hay slug", async () => {
    await expect(slugActivo()).resolves.toEqual({ slug: null, fuente: "ninguna" });
  });

  it("la cabecera explícita gana sobre todo", async () => {
    cabeceras["x-kora-hotel"] = "hotel-a";
    cabeceras["referer"] = "https://kora-hotel.com/panel/hotel-b/reservas";
    cookieActual.valor = "hotel-c";
    await expect(slugActivo()).resolves.toEqual({ slug: "hotel-a", fuente: "header" });
  });

  it("sin cabecera, manda la PESTAÑA que hizo la petición (Referer)", async () => {
    cabeceras["referer"] = "https://kora-hotel.com/panel/hotel-b/reservas";
    cookieActual.valor = "hotel-c"; // la cookie dice OTRO hotel: ya no gana
    await expect(slugActivo()).resolves.toEqual({ slug: "hotel-b", fuente: "referer" });
  });

  it("la cookie sólo entra cuando no hay ninguna de las dos", async () => {
    cookieActual.valor = "hotel-c";
    await expect(slugActivo()).resolves.toEqual({ slug: "hotel-c", fuente: "cookie" });
  });

  it("un Referer que no es del panel no aporta slug", async () => {
    cabeceras["referer"] = "https://kora-hotel.com/precios";
    await expect(slugActivo()).resolves.toEqual({ slug: null, fuente: "ninguna" });
  });

  it("un Referer basura no revienta: se ignora", async () => {
    cabeceras["referer"] = "no-es-una-url";
    cookieActual.valor = "hotel-c";
    await expect(slugActivo()).resolves.toEqual({ slug: "hotel-c", fuente: "cookie" });
  });

  // K-352: entrar a /panel/onboarding guardaba "onboarding" como si fuera el
  // slug de un hotel. `herramientas` es el otro segmento reservado.
  it("los segmentos reservados NO son slugs de hotel", async () => {
    cabeceras["referer"] = "https://kora-hotel.com/panel/onboarding";
    await expect(slugActivo()).resolves.toEqual({ slug: null, fuente: "ninguna" });
    cabeceras["referer"] = "https://kora-hotel.com/panel/herramientas";
    await expect(slugActivo()).resolves.toEqual({ slug: null, fuente: "ninguna" });
    cabeceras["x-kora-hotel"] = "onboarding";
    await expect(slugActivo()).resolves.toEqual({ slug: null, fuente: "ninguna" });
  });

  it("un slug con acentos codificados se decodifica", async () => {
    cabeceras["referer"] = "https://kora-hotel.com/panel/hotel-espa%C3%B1a/reservas";
    await expect(slugActivo()).resolves.toEqual({ slug: "hotel-españa", fuente: "referer" });
  });
});

describe("getActiveHotel con las fuentes nuevas", () => {
  it("dos pestañas ya NO se pisan: manda el Referer, no la cookie", async () => {
    membresias["hotel-a"] = ctx("hotel-a");
    membresias["hotel-b"] = ctx("hotel-b");
    cookieActual.valor = "hotel-b"; // la última pestaña que se tocó
    cabeceras["referer"] = "https://kora-hotel.com/panel/hotel-a/reservas";
    // Antes esto devolvía hotel-b y la reserva se creaba en el hotel equivocado.
    await expect(getActiveHotel()).resolves.toMatchObject({ hotelId: "id-hotel-a" });
  });

  it("la cabecera del panel manda aunque el Referer diga otra cosa", async () => {
    membresias["hotel-a"] = ctx("hotel-a");
    cabeceras["x-kora-hotel"] = "hotel-a";
    cabeceras["referer"] = "https://kora-hotel.com/panel/hotel-b/reservas";
    await expect(getActiveHotel()).resolves.toMatchObject({ hotelId: "id-hotel-a" });
  });

  // Falsificar la cabecera no sirve: la membresía se sigue verificando contra
  // hotel_members con la sesión real.
  it("una cabecera apuntando a un hotel ajeno sigue dando null", async () => {
    membresias["hotel-a"] = ctx("hotel-a");
    cabeceras["x-kora-hotel"] = "hotel-de-otro";
    await expect(getActiveHotel()).resolves.toBeNull();
  });
});
