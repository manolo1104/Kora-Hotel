// La función que decide si el motor de un hotel cobra o se apaga. Es la palanca
// comercial de Kora entera: `accesoDelHotel` es el punto ÚNICO por el que pasan
// panel, motor, checkout, bot y agente.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  tienePlanActivo,
  bloqueoDelHotel,
  pruebaDelHotel,
  trialEndParaStripe,
  type Suscripcion,
  type PruebaHotel,
} from "@/lib/suscripcion";

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

// ─────────────────────────────────────────────────────────────────────────────
// El caso que impedía COBRAR. Stripe rechaza cualquier `trial_end` a menos de
// 48 h, y la guarda vieja del checkout miraba `prueba.diasRestantes >= 2`. Como
// `diasRestantes` se redondea hacia arriba, a 25 h del final ya valía 2: se le
// pedía a Stripe un trial_end a 25 h, Stripe lo rechazaba, y el hotelero veía
// "No pudimos iniciar el pago" durante las últimas 24-48 h de su prueba — que es
// justo cuando le llega el correo de "mañana termina".
// ─────────────────────────────────────────────────────────────────────────────

/** Una prueba a la que le faltan `horas` horas (negativo = ya vencida). */
function pruebaEn(horas: number): PruebaHotel {
  const ms = horas * 3_600_000;
  return {
    fin: new Date(HOY.getTime() + ms),
    diasRestantes: Math.max(0, Math.ceil(ms / 86_400_000)),
    vencida: ms <= 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LA PRUEBA INFINITA (K-108, K-258, K-315). La prueba salía del `created_at` del
// hotel, y el panel deja borrar el hotel y volver a crearlo: otros 30 días
// gratis, indefinidamente. El ancla vive ahora en el DUEÑO (tabla `pruebas`).
// ─────────────────────────────────────────────────────────────────────────────
describe("pruebaDelHotel con el ancla del dueño", () => {
  const hace = (d: number) => new Date(HOY.getTime() - d * 86_400_000).toISOString();

  it("sin ancla se comporta como siempre (el created_at del hotel)", () =>
    expect(pruebaDelHotel({ created_at: hace(10), extras: null })?.diasRestantes).toBe(20));

  // EL CASO QUE CERRAMOS: borró su hotel y lo recreó hoy. El hotel tiene 0 días,
  // pero su prueba empezó hace 40: está vencida y no arranca de nuevo.
  it("hotel recreado HOY con el ancla de hace 40 días → vencida", () => {
    const p = pruebaDelHotel({ created_at: HOY.toISOString(), extras: null }, hace(40));
    expect(p?.vencida).toBe(true);
    expect(p?.diasRestantes).toBe(0);
  });

  it("hotel recreado hoy con el ancla de hace 10 días → le quedan 20, no 30", () =>
    expect(pruebaDelHotel({ created_at: HOY.toISOString(), extras: null }, hace(10))?.diasRestantes).toBe(20));

  // Sembrar el ancla tarde no puede quitarle días a nadie: manda la MÁS ANTIGUA.
  it("un ancla más nueva que el hotel no le recorta la prueba", () =>
    expect(pruebaDelHotel({ created_at: hace(10), extras: null }, hace(2))?.diasRestantes).toBe(20));

  it("el hotel demo sigue sin caducar aunque tenga ancla", () =>
    expect(pruebaDelHotel({ created_at: hace(400), extras: { demo: true } }, hace(400))).toBeNull());

  // Un ancla ilegible no puede tumbar el cálculo: se cae al created_at.
  it("un ancla ilegible se ignora en vez de romper", () =>
    expect(pruebaDelHotel({ created_at: hace(10), extras: null }, "basura")?.diasRestantes).toBe(20));
});

describe("trialEndParaStripe (el mínimo de 48 h de Stripe)", () => {
  it("sin prueba → el cobro corre desde hoy", () =>
    expect(trialEndParaStripe(null)).toBeNull());
  it("prueba vencida → el cobro corre desde hoy", () =>
    expect(trialEndParaStripe(pruebaEn(-1))).toBeNull());

  // ESTE es el test que importa: deja por escrito la trampa de Math.ceil.
  it("a 25 h del final, diasRestantes vale 2 y aun así NO se manda trial_end", () => {
    const p = pruebaEn(25);
    expect(p.diasRestantes).toBe(2); // la guarda vieja pasaba por aquí
    expect(trialEndParaStripe(p)).toBeNull(); // y Stripe la rechazaba
  });

  it("a 47 h tampoco: Stripe exige 48", () =>
    expect(trialEndParaStripe(pruebaEn(47))).toBeNull());
  it("justo por debajo del umbral, no", () =>
    expect(trialEndParaStripe(pruebaEn(48.9))).toBeNull());
  it("justo por encima del umbral, sí", () =>
    expect(trialEndParaStripe(pruebaEn(49.1))).not.toBeNull());

  it("con prueba de sobra respeta la fecha exacta del fin, en segundos", () => {
    const p = pruebaEn(10 * 24);
    expect(trialEndParaStripe(p)).toBe(Math.floor(p.fin.getTime() / 1000));
  });

  // Ni 30 días encima de su prueba, ni cobrarle antes de tiempo.
  it("no le regala 30 días nuevos a quien lleva 20 de prueba", () => {
    const p = pruebaEn(10 * 24);
    const treintaDias = Math.floor((HOY.getTime() + 30 * 86_400_000) / 1000);
    expect(trialEndParaStripe(p)).toBeLessThan(treintaDias);
  });
});
