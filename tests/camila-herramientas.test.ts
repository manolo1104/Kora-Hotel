// Las herramientas de Camila con datos de un hotel de verdad (tarifas por
// persona, temporada con mínimo de noches, un cuarto de una sola unidad).
//
// Cada caso es un defecto que el bot tenía en vivo:
//   · cotizaba SIEMPRE para 2 personas (el runtime no mandaba cuántos eran);
//   · ofrecía cuartos donde el grupo no cabía, con precio de menos gente;
//   · daba precio por una noche en temporada de mínimo 2 (y el link fallaba);
//   · su propio apartado contaba como ocupado al pedir otro link;
//   · decía «ya le avisé al equipo» sin avisar a nadie.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hotelFicticio, F } from "../tests-eval/camila/hotel";

const freeUnitsByTypeResult = vi.fn();
vi.mock("@/lib/db/availability", async () => {
  const { hotelRooms } = await import("@/lib/booking");
  return {
    freeUnitsByTypeResult: (...a: unknown[]) => freeUnitsByTypeResult(...a),
    __todoLibre: (hotel: Parameters<typeof hotelRooms>[0]) => ({
      ok: true,
      types: hotelRooms(hotel).map((r) => ({ id: r.id, name: r.name, cantidad: r.cantidad, freeCount: r.cantidad, freeUnitNames: r.unidades })),
    }),
  };
});

const { botAvailability, fechaLegible } = await import("@/lib/bot/tools");
const { __todoLibre } = (await import("@/lib/db/availability")) as unknown as {
  __todoLibre: (h: unknown) => unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const H = (o: { menoresPagan?: boolean } = {}) => hotelFicticio(o) as any;

beforeEach(() => {
  vi.clearAllMocks();
  freeUnitsByTypeResult.mockImplementation(async (_id: string, hotel: unknown) => __todoLibre(hotel));
});

const cuarto = (r: Awaited<ReturnType<typeof botAvailability>>, nombre: string) => r.disponibles.find((d) => d.nombre === nombre);

describe("cotiza con las personas reales", () => {
  it("4 adultos: la Cabaña se cotiza para 4 ($3,000 × 2 noches)", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 4 });
    const c = cuarto(r, "Cabaña Río");
    expect(c?.personasTarifa).toBe(4);
    expect(c?.total).toBe(6000);
  });

  it("los cuartos donde el grupo NO cabe no se ofrecen como si cupieran", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 4 });
    expect(r.disponibles.map((d) => d.nombre)).toEqual(["Cabaña Río"]);
    expect(r.noCaben?.map((d) => d.nombre)).toEqual(["Suite Jardín", "Habitación Doble"]);
  });

  it("2 adultos + 2 niños: los niños ocupan lugar pero no pagan (default)", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 2, ninos: 2 });
    expect(cuarto(r, "Cabaña Río")?.total).toBe(4400);
    expect(cuarto(r, "Suite Jardín")).toBeUndefined(); // máximo 2 personas
  });

  it("…y en un hotel donde los niños pagan, se cobra la tarifa de 4", async () => {
    const r = await botAvailability(H({ menoresPagan: true }), F.normalIn, F.normalOut, { adultos: 2, ninos: 2 });
    expect(cuarto(r, "Cabaña Río")?.total).toBe(6000);
  });

  it("un número suelto (cliente viejo) se toma como adultos", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, 3);
    expect(cuarto(r, "Cabaña Río")?.personasTarifa).toBe(3);
  });
});

describe("le da al modelo todo calculado", () => {
  it("noches, día de la semana, anticipo y lo que paga al llegar", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 2 });
    expect(r.noches).toBe(2);
    expect(r.llegada).toBe(fechaLegible(F.normalIn));
    expect(r.llegada).toMatch(/^martes /);
    const c = cuarto(r, "Suite Jardín")!;
    expect(c.total).toBe(5600);
    expect(c.anticipo).toBe(2800); // 50%
    expect(c.pagaAlLlegarTexto).toBe("$2,800 MXN");
  });

  it("el link de cada cuarto ya trae cuarto, fechas, personas y la marca de Camila", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 2, ninos: 1 });
    const u = new URL(cuarto(r, "Cabaña Río")!.linkReserva);
    expect(u.pathname).toBe("/h/casa-ceiba/reservar");
    expect(u.searchParams.get("habitacion")).toBe("cabaña río");
    expect(u.searchParams.get("checkin")).toBe(F.normalIn);
    expect(u.searchParams.get("adults")).toBe("2");
    expect(u.searchParams.get("children")).toBe("1");
    expect(u.searchParams.get("origen")).toBe("camila");
  });
});

describe("avisa antes de cobrar lo que no se puede", () => {
  it("una noche en temporada de mínimo 2 → min-noches, sin precio", async () => {
    const noche = F.temporadaDesde;
    const r = await botAvailability(H(), noche, new Date(new Date(`${noche}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10), { adultos: 2 });
    expect(r.error).toBe("min-noches");
    expect(r.minNoches).toBe(2);
    expect(r.disponibles).toHaveLength(0);
  });

  it("una fecha pasada no se cotiza", async () => {
    const r = await botAvailability(H(), "2020-01-01", "2020-01-03", { adultos: 2 });
    expect(r.error).toBe("fechas-invalidas");
  });
});

describe("el código de descuento", () => {
  it("válido: total con descuento y el código en el link", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 2, codigo: "vuelve10" });
    expect(r.codigo).toMatchObject({ code: "VUELVE10", valido: true });
    const c = cuarto(r, "Suite Jardín")!;
    expect(c.totalConDescuentoTexto).toBe("$5,040 MXN");
    expect(new URL(c.linkReserva).searchParams.get("promo")).toBe("VUELVE10");
  });

  it("inventado: se dice que no vale y no descuenta", async () => {
    const r = await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 2, codigo: "GRATIS" });
    expect(r.codigo).toMatchObject({ valido: false });
    expect(cuarto(r, "Suite Jardín")!.totalConDescuentoTexto).toBeUndefined();
  });
});

describe("el apartado propio no cuenta como ocupado", () => {
  it("la consulta excluye el apartado de ESTE chat", async () => {
    await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 2, conv: "5214811234567" });
    expect(freeUnitsByTypeResult.mock.calls[0][4]).toBe("bot_c_5214811234567");
  });

  it("sin chat, no excluye nada", async () => {
    await botAvailability(H(), F.normalIn, F.normalOut, { adultos: 2 });
    expect(freeUnitsByTypeResult.mock.calls[0][4]).toBeNull();
  });
});

// ── El historial del runtime ────────────────────────────────────────────────
process.env.ANTHROPIC_API_KEY ||= "sk-prueba";
const { __pruebas } = await import("@/agentes/camila/brain.js");

describe("el historial de Camila", () => {
  it("se guarda sin bloques de razonamiento (si no, los modelos nuevos dan 400 al cambiar la fecha)", () => {
    const h = __pruebas.sinPensamientos([
      { role: "user", content: "hola" },
      { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "text", text: "¡Hola!" }] },
      { role: "assistant", content: [{ type: "redacted_thinking", data: "x" }] },
    ]);
    expect(h).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: [{ type: "text", text: "¡Hola!" }] },
    ]);
  });

  it("se recorta por TURNOS del huésped y siempre arranca en un mensaje suyo", () => {
    const muchos = [];
    for (let i = 0; i < 20; i++) {
      muchos.push({ role: "user", content: `m${i}` });
      muchos.push({ role: "assistant", content: [{ type: "tool_use", id: `t${i}`, name: "x", input: {} }] });
      muchos.push({ role: "user", content: [{ type: "tool_result", tool_use_id: `t${i}`, content: "{}" }] });
      muchos.push({ role: "assistant", content: [{ type: "text", text: "ok" }] });
    }
    const r = __pruebas.recortarHistorial(muchos);
    expect(r[0]).toEqual({ role: "user", content: "m8" }); // 12 turnos: m8…m19
    expect(r.filter((m: { content: unknown }) => typeof m.content === "string")).toHaveLength(12);
  });

  it("reconoce a un huésped que escribe en inglés (para los mensajes fijos)", () => {
    expect(__pruebas.pareceIngles("Hi! Do you have a room for 2?")).toBe(true);
    expect(__pruebas.pareceIngles("Hola, ¿tienen cuarto para 2?")).toBe(false);
  });
});

