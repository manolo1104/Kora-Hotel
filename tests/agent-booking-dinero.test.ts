// El camino que COBRA por WhatsApp. Hasta hoy no tenía ni una prueba: 230
// líneas que apartan inventario real y generan links de pago de Stripe, y lo
// único que las tocaba era un mock. El comentario de lib/agent-booking.ts:16
// («Separado del route para poder testear sin auth/HTTP») llevaba meses sin
// cumplirse.
//
// Se prueban los tres defectos de dinero que encontró la auditoría de Camila:
//   · el tope de unidades RECORTABA la petición en silencio y devolvía ok:true;
//   · un fallo de base de datos se disfrazaba de «ya no hay ese cuarto», en el
//     momento exacto en que el huésped ya había dado sus datos;
//   · cotizar y cobrar partían de defaults de ocupación distintos (2 vs 1).
import { describe, it, expect, vi, beforeEach } from "vitest";

const freeUnitsByTypeResult = vi.fn();
const apartarUnidades = vi.fn();
const getConnectState = vi.fn();
const releaseHold = vi.fn(async () => true);

vi.mock("@/lib/db/availability", () => ({
  freeUnitsByTypeResult: (...a: unknown[]) => freeUnitsByTypeResult(...(a as [])),
  apartarUnidades: (...a: unknown[]) => apartarUnidades(...(a as [])),
  releaseHold: (...a: unknown[]) => releaseHold(...(a as [])),
}));
vi.mock("@/lib/stripe/connect", () => ({ getConnectState: (...a: unknown[]) => getConnectState(...(a as [])) }));
vi.mock("@/lib/stripe/server", () => ({
  stripeEnvReady: true,
  getStripe: () => ({
    checkout: { sessions: { create: async () => ({ id: "cs_1", url: "https://pago.test/cs_1" }) } },
  }),
}));
vi.mock("@/lib/alertas", () => ({ alertar: async () => {} }));
// Sólo lo usa `contarHoldsDelBot`; devolver 0 apartados vivos deja pasar.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ like: () => ({ gt: async () => ({ count: 0, error: null }) }) }) }) }) }),
  }),
}));

const { crearLinkReservaAgente } = await import("@/lib/agent-booking");

// Hotel con TARIFAS POR PERSONA: es donde estos defectos muerden. Con tarifa
// plana los números coinciden y el problema queda invisible, que es justo por lo
// que llevaba meses sin verse.
const HOTEL = {
  id: "h1", owner_id: "u1", slug: "hotel-prueba", nombre: "Hotel de prueba",
  publicado: true, created_at: "2026-01-01T00:00:00Z", stripe_account_id: "acct_1",
  config: {}, extras: {},
  habitaciones: [
    { nombre: "Cabaña", precio: 2000, capacidad: 4, cantidad: 8,
      tarifas: [{ personas: 2, precio: 2000 }, { personas: 4, precio: 3000 }] },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const MANANA = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
const PASADO = new Date(Date.now() + 3 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

const DATOS = { nombre: "Ana López", email: "ana@ejemplo.com", telefono: "4811234567" };
const RESERVA = { cuarto: "Cabaña", checkin: MANANA, checkout: PASADO, ...DATOS };

beforeEach(() => {
  vi.clearAllMocks();
  freeUnitsByTypeResult.mockResolvedValue({
    ok: true,
    types: [{
      id: 1, name: "Cabaña", cantidad: 8, freeCount: 8,
      freeUnitNames: ["Cabaña", "Cabaña 2", "Cabaña 3", "Cabaña 4", "Cabaña 5", "Cabaña 6", "Cabaña 7", "Cabaña 8"],
    }],
  });
  apartarUnidades.mockResolvedValue({ ok: true, unidades: ["Cabaña"] });
  getConnectState.mockResolvedValue({ chargesEnabled: true, accountId: "acct_1" });
});

describe("el tope de unidades RECHAZA, no recorta", () => {
  // Antes: Math.min(7, 5) → apartaba 5, cobraba 5, devolvía ok:true. Camila
  // mandaba el link creyendo que pedía 7 y el día del viaje llegaban 20
  // personas a cinco cabañas.
  it("pedir 7 cabañas no se convierte en 5 a escondidas", async () => {
    const r = await crearLinkReservaAgente(HOTEL, { ...RESERVA, unidades: 7, huespedes: 20 }, "https://kora.test");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("demasiadas-unidades");
    expect(r.maxUnidades).toBe(5);
  });

  it("y no se aparta inventario de un grupo que no se va a poder cerrar", async () => {
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, unidades: 7, huespedes: 20 }, "https://kora.test");
    expect(apartarUnidades).not.toHaveBeenCalled();
  });

  it("hasta el tope sí cierra", async () => {
    const r = await crearLinkReservaAgente(HOTEL, { ...RESERVA, unidades: 2, huespedes: 4 }, "https://kora.test");
    expect(r.ok).toBe(true);
  });
});

describe("un fallo de base de datos no es un hotel lleno", () => {
  // El peor momento posible: el huésped ya dio nombre, correo y teléfono y dijo
  // "sí, la reservo". Decirle "ya no hay ese cuarto" ahí pierde la venta y le
  // deja al hotel la sensación de que estaba lleno.
  it("si no se puede leer la disponibilidad → servicio-no-disponible, NUNCA no-disponible", async () => {
    freeUnitsByTypeResult.mockResolvedValue({ ok: false, types: [] });
    const r = await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2 }, "https://kora.test");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("servicio-no-disponible");
    expect(r.error).not.toBe("no-disponible");
  });

  it("no se aparta nada cuando la consulta falló", async () => {
    freeUnitsByTypeResult.mockResolvedValue({ ok: false, types: [] });
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2 }, "https://kora.test");
    expect(apartarUnidades).not.toHaveBeenCalled();
  });

  // Un hotel de verdad lleno sí tiene que decirlo: el arreglo no puede tapar el
  // caso legítimo.
  it("un hotel de verdad lleno sigue diciendo no-disponible", async () => {
    freeUnitsByTypeResult.mockResolvedValue({ ok: true, types: [{ id: 1, name: "Cabaña", cantidad: 8, freeCount: 0, freeUnitNames: [] }] });
    const r = await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2 }, "https://kora.test");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("no-disponible");
  });
});

describe("cotizar y cobrar parten del mismo supuesto de ocupación", () => {
  // `botAvailability` asume 2 personas cuando no le dicen; esto asumía 1. En un
  // hotel con tarifas por persona eso ya era, por sí solo, un número en WhatsApp
  // y otro en el link de pago.
  it("sin decir cuántos son, cobra lo mismo que cotizaría (2 personas)", async () => {
    const sinDato = await crearLinkReservaAgente(HOTEL, RESERVA, "https://kora.test");
    const conDos = await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2 }, "https://kora.test");
    expect(sinDato.ok && conDos.ok).toBe(true);
    if (!sinDato.ok || !conDos.ok) return;
    expect(sinDato.total).toBe(conDos.total);
  });

  it("y con más personas el total sube de verdad (tarifa por persona)", async () => {
    const dos = await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2 }, "https://kora.test");
    const cuatro = await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 4 }, "https://kora.test");
    expect(dos.ok && cuatro.ok).toBe(true);
    if (!dos.ok || !cuatro.ok) return;
    expect(cuatro.total).toBeGreaterThan(dos.total);
  });
});

describe("un apartado por conversación, no uno por cambio de opinión", () => {
  // Antes cada llamada creaba un `bot_<uuid>` nuevo y nada soltaba el anterior:
  // «mejor una noche más» + «mejor la otra cabaña» dejaba tres cuartos
  // bloqueados 45 minutos en un hotel que quizá sólo tiene tres.
  it("el mismo teléfono reusa su apartado, y suelta el anterior antes de pedir otro", async () => {
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2, conv: "5214811234567" }, "https://kora.test");
    expect(releaseHold).toHaveBeenCalledWith("h1", "bot_c_5214811234567");
    const sesion = apartarUnidades.mock.calls[0][4];
    expect(sesion).toBe("bot_c_5214811234567");
  });

  it("dos peticiones seguidas del mismo huésped usan el MISMO apartado", async () => {
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2, conv: "5214811234567" }, "https://kora.test");
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 4, conv: "5214811234567" }, "https://kora.test");
    expect(apartarUnidades.mock.calls[0][4]).toBe(apartarUnidades.mock.calls[1][4]);
  });

  it("huéspedes distintos NO comparten apartado", async () => {
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2, conv: "5214811111111" }, "https://kora.test");
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2, conv: "5214812222222" }, "https://kora.test");
    expect(apartarUnidades.mock.calls[0][4]).not.toBe(apartarUnidades.mock.calls[1][4]);
  });

  // Sin `conv` (el motor viejo, o una llamada sin teléfono) todo sigue como antes.
  it("sin conversación se comporta como siempre: id único y sin liberar nada", async () => {
    await crearLinkReservaAgente(HOTEL, { ...RESERVA, huespedes: 2 }, "https://kora.test");
    expect(releaseHold).not.toHaveBeenCalled();
    expect(String(apartarUnidades.mock.calls[0][4])).toMatch(/^bot_[0-9a-f-]{36}$/);
  });
});
