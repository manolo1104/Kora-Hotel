// La función que decide si el motor de un hotel cobra o se apaga. Es la palanca
// comercial de Kora entera: `accesoDelHotel` es el punto ÚNICO por el que pasan
// panel, motor, checkout, bot y agente.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { tienePlanActivo, bloqueoDelHotel, pruebaDelHotel, type Suscripcion } from "@/lib/suscripcion";

const HOY = new Date("2026-08-25T12:00:00Z");
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(HOY); });
afterAll(() => { vi.useRealTimers(); });

function sub(p: Partial<Suscripcion>): Suscripcion {
  return {
    id: "s1", user_id: "u1", stripe_customer_id: null, stripe_subscription_id: null,
    plan: "kora", estado: "activa", periodo_fin: null, cancela_al_final: false,
    avisos_dunning: 0, ...p,
  } as Suscripcion;
}

/** Fecha ISO de hace N días, para construir vencimientos exactos. */
function haceDias(n: number): string {
  return new Date(HOY.getTime() - n * 86_400_000).toISOString();
}

describe("tienePlanActivo", () => {
  it("sin suscripción no hay plan", () => expect(tienePlanActivo(null)).toBe(false));
  it("activa → true", () => expect(tienePlanActivo(sub({ estado: "activa" }))).toBe(true));
  it("cortesia → true (cuentas dadas de alta a mano)", () =>
    expect(tienePlanActivo(sub({ estado: "cortesia" }))).toBe(true));
  it("cancelada → false", () => expect(tienePlanActivo(sub({ estado: "cancelada" }))).toBe(false));
  it("incompleta → false", () => expect(tienePlanActivo(sub({ estado: "incompleta" }))).toBe(false));

  // La gracia de 21 días cubre los reintentos de cobro de Stripe. Los dos casos
  // de al lado del borde son los que importan: uno paga, el otro no.
  it("pago vencido hace 20 días → SIGUE activo (dentro de la gracia)", () =>
    expect(tienePlanActivo(sub({ estado: "pago_vencido", periodo_fin: haceDias(20) }))).toBe(true));
  it("pago vencido hace 22 días → ya no", () =>
    expect(tienePlanActivo(sub({ estado: "pago_vencido", periodo_fin: haceDias(22) }))).toBe(false));

  // Estos dos son PERMISIVOS A PROPÓSITO. El test existe para que nadie los
  // "arregle" sin querer: castigar a un cliente que paga por un dato faltante
  // cuesta mucho más que regalarle unos días.
  it("pago vencido sin periodo_fin → permisivo A PROPÓSITO", () =>
    expect(tienePlanActivo(sub({ estado: "pago_vencido", periodo_fin: null }))).toBe(true));
  it("pago vencido con periodo_fin ilegible → permisivo A PROPÓSITO", () =>
    expect(tienePlanActivo(sub({ estado: "pago_vencido", periodo_fin: "basura" }))).toBe(true));
});

describe("bloqueoDelHotel", () => {
  it("sin extras no hay bloqueo", () => expect(bloqueoDelHotel(null)).toBeNull());
  it("bloqueo.activo=false no bloquea", () =>
    expect(bloqueoDelHotel({ bloqueo: { activo: false } })).toBeNull());
  it("bloqueo.activo=true bloquea y conserva el mensaje", () =>
    expect(bloqueoDelHotel({ bloqueo: { activo: true, mensaje: "Falta de pago" } })).toMatchObject({
      activo: true, mensaje: "Falta de pago",
    }));
});

describe("pruebaDelHotel", () => {
  it("el hotel demo nunca caduca", () =>
    expect(pruebaDelHotel({ created_at: "2020-01-01T00:00:00Z", extras: { demo: true } })).toBeNull());

  it("un hotel creado hoy tiene 30 días", () =>
    expect(pruebaDelHotel({ created_at: HOY.toISOString(), extras: null })?.diasRestantes).toBe(30));

  // Nadie amanece pausado por un cambio de reglas retroactivo: para hoteles
  // anteriores al lanzamiento, la prueba corre desde el lanzamiento.
  it("un hotel viejo cuenta desde el lanzamiento, no desde su creación", () => {
    const p = pruebaDelHotel({ created_at: "2020-01-01T00:00:00Z", extras: null });
    expect(p?.vencida).toBe(true);
    expect(p?.diasRestantes).toBe(0);
  });
});
