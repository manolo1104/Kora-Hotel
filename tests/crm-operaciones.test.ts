// Las cuentas de /crm, la vista de todo el negocio (15 sep 2026).
//
// Lo que se vigila aquí son las cifras que el fundador se cree sin mirar dos
// veces, y las formas concretas en que mentían o podían mentir:
//   1. MRR: contaba como pagando a quien sigue en prueba con tarjeta (el webhook
//      guarda `trialing` como `activa`) y el digest sumaba la cortesía a precio
//      de plan. Con Stripe caído tiene que caer a la estimación Y decirlo.
//   2. Embudo: el personal de un hotel no es un registro, un hotel demo no es un
//      cliente y un dato que no se pudo leer no es un cero.
//   3. Registrados sin hotel: el lead que nadie veía, sin colar a la recepción.
//   4. Alertas nuevas: cada una con el botón que lleva a donde se resuelve.
import { describe, it, expect } from "vitest";
import {
  calcularAlertas,
  calcularEmbudo,
  calcularMrr,
  esReservaReal,
  registradosSinHotel,
  tipoCamila,
  DIAS_AVISO_MODO_PRUEBA,
  HORAS_REGISTRO_RECIENTE,
  type FilaSuscMrr,
  type HotelEmbudo,
  type HotelOps,
} from "@/lib/crm/operaciones";
import type { Lectura, SuscripcionStripe, UsuarioKora } from "@/lib/crm/fuentes";
import { PRECIO_DESDE } from "@/lib/oferta";
import { DIAS_SIN_RESERVAS_PAGANDO, rutaFichaHotel } from "@/lib/crm/types";

const DIA = 86_400_000;
const AHORA = Date.parse("2026-09-15T18:00:00Z");
const hace = (d: number) => new Date(AHORA - d * DIA).toISOString();

function sub(status: string, montoMxn: number | null = PRECIO_DESDE): SuscripcionStripe {
  return { subscriptionId: `sub_${status}`, status, montoMxn, trialEnd: null, cancelAtPeriodEnd: false };
}

function stripeOk(entradas: [string, SuscripcionStripe][]): Lectura<Map<string, SuscripcionStripe>> {
  return { ok: true, data: new Map(entradas) };
}

const fila = (user_id: string, estado: FilaSuscMrr["estado"], stripe_customer_id: string | null): FilaSuscMrr => ({
  user_id,
  plan: "kora",
  estado,
  stripe_customer_id,
});

// ─── MRR ─────────────────────────────────────────────────────────────────────

describe("MRR con Stripe legible", () => {
  const filas = [
    fila("u-paga", "activa", "cus_paga"),
    fila("u-prueba", "activa", "cus_prueba"), // el webhook guardó `trialing` como activa
    fila("u-cortesia", "cortesia", null),
    fila("u-moroso", "pago_vencido", "cus_moroso"),
  ];
  const stripe = stripeOk([
    ["cus_paga", sub("active")],
    ["cus_prueba", sub("trialing")],
    ["cus_moroso", sub("past_due")],
  ]);

  it("sólo suma lo que Stripe está cobrando", () => {
    const r = calcularMrr(filas, stripe);
    expect(r.fuente).toBe("stripe");
    expect(r.mrr).toBe(PRECIO_DESDE);
    expect(r.pagando).toBe(1);
    expect(r.pagandoIds).toEqual(["u-paga"]);
  });

  it("la prueba con tarjeta va aparte y NO suma", () => {
    const r = calcularMrr(filas, stripe);
    expect(r.enPruebaConTarjeta).toBe(1);
    expect(r.mrrEnPrueba).toBe(PRECIO_DESDE);
    expect(r.pagandoIds).not.toContain("u-prueba");
  });

  it("la cortesía se cuenta, pero vale $0", () => {
    const r = calcularMrr(filas, stripe);
    expect(r.cortesia).toBe(1);
    expect(r.mrr).toBe(PRECIO_DESDE);
  });

  it("un cobro sin monto legible no se inventa: se cuenta como pagando pero no suma", () => {
    const r = calcularMrr([fila("u1", "activa", "cus_1")], stripeOk([["cus_1", sub("active", null)]]));
    expect(r.pagando).toBe(1);
    expect(r.sinMonto).toBe(1);
    expect(r.mrr).toBe(0);
  });

  it("una activa en Stripe que Kora no tiene registrada se señala y no suma", () => {
    const r = calcularMrr([fila("u1", "activa", "cus_1")], stripeOk([["cus_1", sub("active")], ["cus_otro", sub("active")]]));
    expect(r.enStripeSinFila).toBe(1);
    expect(r.mrr).toBe(PRECIO_DESDE);
  });

  it("dos filas con el mismo cliente no cobran dos veces", () => {
    const r = calcularMrr([fila("u1", "activa", "cus_1"), fila("u2", "activa", "cus_1")], stripeOk([["cus_1", sub("active")]]));
    expect(r.mrr).toBe(PRECIO_DESDE);
    expect(r.pagando).toBe(1);
  });

  it("sin la tabla de planes suma todo lo de Stripe y lo dice", () => {
    const r = calcularMrr(null, stripeOk([["cus_1", sub("active")], ["cus_2", sub("trialing")]]));
    expect(r.fuente).toBe("stripe");
    expect(r.mrr).toBe(PRECIO_DESDE);
    expect(r.enPruebaConTarjeta).toBe(1);
    expect(r.motivo).toBeTruthy();
  });
});

describe("MRR sin Stripe: cae a la estimación y lo dice", () => {
  const filas = [fila("u1", "activa", "cus_1"), fila("u2", "activa", null), fila("u3", "cortesia", null)];

  it("activas × precio del plan, la cortesía fuera", () => {
    const r = calcularMrr(filas, { ok: false, data: new Map(), error: "sin-respuesta" });
    expect(r.fuente).toBe("estimado");
    expect(r.mrr).toBe(2 * PRECIO_DESDE);
    expect(r.cortesia).toBe(1);
    // No se sabe quién está en prueba con tarjeta: null, no 0.
    expect(r.enPruebaConTarjeta).toBeNull();
    expect(r.motivo).toMatch(/Stripe/);
  });

  it("una lista recortada de Stripe no se toma como buena", () => {
    const r = calcularMrr(filas, { ok: false, data: new Map([["cus_1", sub("active")]]), error: "recortado" });
    expect(r.fuente).toBe("estimado");
    expect(r.motivo).toMatch(/incompleta/);
  });

  it("sin Stripe y sin tabla no hay número: null, nunca 0", () => {
    const r = calcularMrr(null, { ok: false, data: new Map(), error: "sin-stripe" });
    expect(r.fuente).toBe("sin-datos");
    expect(r.mrr).toBeNull();
  });
});

// ─── Reservas reales y Camila ────────────────────────────────────────────────

describe("reserva real", () => {
  it("las del motor web y las de Camila cuentan", () => {
    expect(esReservaReal({ origen: "web", estado: "CONFIRMADA" })).toBe(true);
    expect(esReservaReal({ origen: "web-pago-hotel", estado: "CONFIRMADA" })).toBe(true);
    expect(esReservaReal({ origen: "bot", estado: "CONFIRMADA" })).toBe(true);
  });

  it("lo que apunta el hotel desde su panel no cuenta", () => {
    expect(esReservaReal({ origen: "manual", estado: "MANUAL" })).toBe(false);
    expect(esReservaReal({ origen: "panel", estado: "CONFIRMADA" })).toBe(false);
    expect(esReservaReal({ origen: "cotizacion", estado: "CONFIRMADA" })).toBe(false);
  });

  it("cancelada o reembolsada no cuenta aunque venga del motor", () => {
    expect(esReservaReal({ origen: "web", estado: "CANCELADA" })).toBe(false);
    expect(esReservaReal({ origen: "web", estado: "REEMBOLSADA" })).toBe(false);
  });

  it("sin origen (reservas viejas) decide el estado", () => {
    expect(esReservaReal({ origen: null, estado: "CONFIRMADA" })).toBe(true);
    expect(esReservaReal({ origen: null, estado: "MANUAL" })).toBe(false);
  });
});

describe("estado de Camila", () => {
  it("agrupa los estados crudos del servidor", () => {
    expect(tipoCamila("ready")).toBe("conectada");
    expect(tipoCamila("qr")).toBe("por-vincular");
    expect(tipoCamila("sin-vincular")).toBe("por-vincular");
    expect(tipoCamila("disconnected")).toBe("caida");
    expect(tipoCamila("auth_failure")).toBe("caida");
    expect(tipoCamila("error")).toBe("caida");
    expect(tipoCamila("starting")).toBe("arrancando");
    expect(tipoCamila("algo-nuevo")).toBe("otro");
  });
});

// ─── Registrados sin hotel ───────────────────────────────────────────────────

const usuario = (id: string, creadoHaceDias: number, extra: Partial<UsuarioKora> = {}): UsuarioKora => ({
  id,
  email: `${id}@correo.test`,
  created_at: hace(creadoHaceDias),
  last_sign_in_at: null,
  email_confirmed_at: null,
  ...extra,
});

describe("registrados sin hotel", () => {
  const usuarios = [
    usuario("dueno", 20),
    usuario("recepcion", 10), // personal que el dueño dio de alta
    usuario("lead-viejo", 9),
    usuario("lead-nuevo", 1, { email_confirmed_at: hace(1) }),
  ];

  it("resta dueños y personal, y pone primero al más nuevo", () => {
    const r = registradosSinHotel(usuarios, new Set(["dueno"]), new Set(["dueno", "recepcion"]));
    expect(r.map((x) => x.id)).toEqual(["lead-nuevo", "lead-viejo"]);
    expect(r[0].correoConfirmado).toBe(true);
    expect(r[1].correoConfirmado).toBe(false);
  });

  it("dice si ya tiene plan (pagó antes de crear su hotel)", () => {
    const r = registradosSinHotel(usuarios, new Set(["dueno"]), new Set(["recepcion"]), new Map([["lead-viejo", "activa"]]));
    expect(r.find((x) => x.id === "lead-viejo")?.estadoPlan).toBe("activa");
    expect(r.find((x) => x.id === "lead-nuevo")?.estadoPlan).toBeNull();
  });
});

// ─── Embudo ──────────────────────────────────────────────────────────────────

const hotelEmbudo = (ownerId: string, extra: Partial<HotelEmbudo> = {}): HotelEmbudo => ({
  ownerId,
  demo: false,
  habitacionesConPrecio: 1,
  cobrosListos: false,
  camilaConectada: false,
  reservaReal: false,
  ...extra,
});

describe("embudo de alta", () => {
  const usuarios = ["a", "b", "c", "d", "staff", "kora-demo"].map((id) => ({ id }));
  const hoteles = [
    hotelEmbudo("a", { cobrosListos: true, camilaConectada: true, reservaReal: true }),
    // Dos hoteles del mismo dueño: una cuenta, no dos.
    hotelEmbudo("b", { cobrosListos: true }),
    hotelEmbudo("b", { habitacionesConPrecio: 0 }),
    hotelEmbudo("c", { habitacionesConPrecio: 0 }),
    hotelEmbudo("kora-demo", { demo: true, cobrosListos: true, camilaConectada: true, reservaReal: true }),
  ];
  const base = {
    usuarios,
    personal: new Set(["staff", "a"]),
    hoteles,
    lecturas: { cobros: true, camila: true, reservas: true },
    pagando: { ids: ["a", "kora-demo"], estimado: false },
  };
  const n = (pasos: ReturnType<typeof calcularEmbudo>, id: string) => pasos.find((p) => p.id === id)!;

  it("cuenta cuentas: sin personal y sin dueños que sólo tienen demo", () => {
    const pasos = calcularEmbudo(base);
    // a, b, c, d. «a» es dueño y además está en hotel_members: sigue contando.
    expect(n(pasos, "registro").n).toBe(4);
    expect(n(pasos, "hotel").n).toBe(3);
    expect(n(pasos, "habitaciones").n).toBe(2);
    expect(n(pasos, "cobros").n).toBe(2);
    expect(n(pasos, "camila").n).toBe(1);
    expect(n(pasos, "reserva").n).toBe(1);
    expect(n(pasos, "pagando").n).toBe(1);
  });

  it("el porcentaje es respecto al paso anterior", () => {
    const pasos = calcularEmbudo(base);
    expect(pasos[0].pct).toBeNull();
    expect(n(pasos, "hotel").pct).toBe(75);
    expect(n(pasos, "habitaciones").pct).toBe(67);
    expect(n(pasos, "camila").pct).toBe(50);
  });

  it("un dato que no se pudo leer es null con su nota, no 0, y no inventa porcentajes", () => {
    const pasos = calcularEmbudo({ ...base, lecturas: { cobros: false, camila: true, reservas: true } });
    expect(n(pasos, "cobros").n).toBeNull();
    expect(n(pasos, "cobros").nota).toBeTruthy();
    expect(n(pasos, "cobros").pct).toBeNull();
    // El siguiente no tiene contra qué compararse.
    expect(n(pasos, "camila").pct).toBeNull();
  });

  it("sin el equipo no se puede separar al personal: registro null", () => {
    expect(n(calcularEmbudo({ ...base, personal: null }), "registro").n).toBeNull();
  });

  it("con Stripe caído, «pagando» avisa que es estimado", () => {
    const pasos = calcularEmbudo({ ...base, pagando: { ids: ["a"], estimado: true } });
    expect(n(pasos, "pagando").criterio).toMatch(/Estimado/);
  });

  it("si faltan filas de reservas, el paso lo avisa", () => {
    const pasos = calcularEmbudo({ ...base, reservasRecortadas: true });
    expect(n(pasos, "reserva").nota).toBeTruthy();
  });
});

// ─── Alertas ─────────────────────────────────────────────────────────────────

function hotel(extra: Partial<HotelOps> = {}): HotelOps {
  return {
    id: "h1",
    slug: "hotel-uno",
    nombre: "Hotel Uno",
    ownerId: "u1",
    ownerEmail: "uno@correo.test",
    publicado: true,
    createdAt: hace(60),
    demo: false,
    situacion: "pago",
    estadoSuscripcion: "activa",
    periodoFin: null,
    cancelaAlFinal: false,
    avisosDunning: 0,
    diasPrueba: null,
    stripe: null,
    cobros: "listos",
    modoPrueba: false,
    camila: { status: "ready", tipo: "conectada" },
    botApagado: false,
    saldo: null,
    habitacionesConPrecio: 2,
    reservas: { total: 5, recientes: 2, gmvTotal: 5000, gmvReciente: 2000, ultima: hace(1), reales: 5 },
    diasDeVida: 60,
    ...extra,
  };
}

const entrada = (hoteles: HotelOps[], extra: Partial<Parameters<typeof calcularAlertas>[0]> = {}) => ({
  hoteles,
  leads: [],
  chatsEscalados: 0,
  chatsSinAtender: true,
  registradosSinHotel: [],
  lecturas: { camila: true, reservas: true },
  ahora: AHORA,
  ...extra,
});

describe("alertas", () => {
  it("un hotel sano no levanta nada", () => {
    expect(calcularAlertas(entrada([hotel()]))).toEqual([]);
  });

  it("todas las de un hotel llevan a su ficha", () => {
    const a = calcularAlertas(entrada([hotel({ situacion: "moroso", avisosDunning: 2 })]));
    expect(a).toHaveLength(1);
    expect(a[0].href).toBe(rutaFichaHotel("hotel-uno"));
    expect(a[0].accion).toBeTruthy();
  });

  it(`paga, vendía y lleva ${DIAS_SIN_RESERVAS_PAGANDO} días sin reservas`, () => {
    const a = calcularAlertas(
      entrada([hotel({ reservas: { total: 8, recientes: 0, gmvTotal: 9000, gmvReciente: 0, ultima: hace(DIAS_SIN_RESERVAS_PAGANDO), reales: 8 } })]),
    );
    expect(a.map((x) => x.id)).toEqual(["sin-ventas-h1"]);
    expect(a[0].severidad).toBe("alta");
  });

  it("un día antes del umbral, todavía no", () => {
    const a = calcularAlertas(
      entrada([hotel({ reservas: { total: 8, recientes: 0, gmvTotal: 9000, gmvReciente: 0, ultima: hace(DIAS_SIN_RESERVAS_PAGANDO - 1), reales: 8 } })]),
    );
    expect(a).toEqual([]);
  });

  it("en modo prueba y a pocos días de vencer: UNA alerta, la de modo prueba", () => {
    const h = hotel({ situacion: "prueba", estadoSuscripcion: null, diasPrueba: DIAS_AVISO_MODO_PRUEBA, cobros: "a-medias", modoPrueba: true });
    const a = calcularAlertas(entrada([h]));
    expect(a.map((x) => x.id)).toEqual(["modo-prueba-h1"]);
    expect(a[0].detalle).toMatch(/Stripe/);
  });

  it("en prueba con cobros listos a pocos días: la de prueba de siempre", () => {
    const h = hotel({ situacion: "prueba", estadoSuscripcion: null, diasPrueba: 3, modoPrueba: false });
    expect(calcularAlertas(entrada([h])).map((x) => x.id)).toEqual(["prueba-h1"]);
  });

  // La alerta de prueba ya dice «todavía no procesa ninguna reserva»: sacar
  // además la de «sin estrenar» pinta el mismo hotel dos veces con el mismo
  // hecho, que es justo lo que hace que un panel de alarmas deje de leerse.
  it("en prueba, por vencer y sin estrenar: UNA alerta, no dos", () => {
    const vacio = { total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null, reales: 0 };
    const h = hotel({ situacion: "prueba", estadoSuscripcion: null, diasPrueba: 3, modoPrueba: false, reservas: vacio });
    const a = calcularAlertas(entrada([h]));
    expect(a.map((x) => x.id)).toEqual(["prueba-h1"]);
    expect(a[0].detalle).toMatch(/no procesa ninguna reserva/);
  });

  it("en modo prueba y sin estrenar tampoco se duplica", () => {
    const vacio = { total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null, reales: 0 };
    const h = hotel({
      situacion: "prueba",
      estadoSuscripcion: null,
      diasPrueba: DIAS_AVISO_MODO_PRUEBA,
      cobros: "a-medias",
      modoPrueba: true,
      reservas: vacio,
    });
    expect(calcularAlertas(entrada([h])).map((x) => x.id)).toEqual(["modo-prueba-h1"]);
  });

  // Un hotel en prueba con MÁS de 7 días no tiene alerta de prueba, así que la
  // de «sin estrenar» sigue saliendo: la supresión es sólo del solapamiento.
  it("en prueba pero lejos de vencer, «sin estrenar» sí sale", () => {
    const vacio = { total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null, reales: 0 };
    const h = hotel({ situacion: "prueba", estadoSuscripcion: null, diasPrueba: 12, reservas: vacio });
    expect(calcularAlertas(entrada([h])).map((x) => x.id)).toEqual(["sin-estrenar-h1"]);
  });

  it("un solo día de prueba se dice en singular", () => {
    const h = hotel({ situacion: "prueba", estadoSuscripcion: null, diasPrueba: 1, modoPrueba: false });
    expect(calcularAlertas(entrada([h]))[0].titulo).toContain("le queda 1 día de prueba");
    const dos = hotel({ situacion: "prueba", estadoSuscripcion: null, diasPrueba: 2, modoPrueba: false });
    expect(calcularAlertas(entrada([dos]))[0].titulo).toContain("le quedan 2 días de prueba");
  });

  it("Camila caída en un hotel que paga", () => {
    const a = calcularAlertas(entrada([hotel({ camila: { status: "disconnected", tipo: "caida" } })]));
    expect(a.map((x) => x.id)).toEqual(["camila-caida-h1"]);
    expect(a[0].severidad).toBe("alta");
  });

  it("Camila sin vincular en cortesía, y fuera del servidor", () => {
    const a = calcularAlertas(
      entrada([
        hotel({ situacion: "cortesia", camila: { status: "qr", tipo: "por-vincular" } }),
        hotel({ id: "h2", slug: "dos", camila: null }),
      ]),
    );
    expect(a.map((x) => x.id)).toEqual(["camila-sin-vincular-h1", "camila-fuera-h2"]);
  });

  it("si el hotelero apagó a Camila o no se pudo leer su estado, no hay alerta de Camila", () => {
    expect(calcularAlertas(entrada([hotel({ camila: null, botApagado: true })]))).toEqual([]);
    expect(calcularAlertas(entrada([hotel({ camila: null })], { lecturas: { camila: false, reservas: true } }))).toEqual([]);
  });

  it("en prueba, Camila caída no es alerta de Camila (no la está pagando)", () => {
    const h = hotel({ situacion: "prueba", diasPrueba: 12, camila: { status: "error", tipo: "caida" } });
    expect(calcularAlertas(entrada([h]))).toEqual([]);
  });

  it(`registrados sin hotel de las últimas ${HORAS_REGISTRO_RECIENTE} h: una sola alerta que lleva a la lista`, () => {
    const lista = registradosSinHotel(
      [usuario("nuevo1", 0.5), usuario("nuevo2", 1.5), usuario("viejo", 5)],
      new Set(),
      new Set(),
    );
    const a = calcularAlertas(entrada([], { registradosSinHotel: lista }));
    expect(a).toHaveLength(1);
    expect(a[0].titulo).toMatch(/^2 cuentas nuevas/);
    expect(a[0].href).toBe("#registrados-sin-hotel");
  });

  it("sin reservas leídas no hay «0 reservas» falso: ni sin estrenar ni sin ventas", () => {
    const vacio = { total: 0, recientes: 0, gmvTotal: 0, gmvReciente: 0, ultima: null, reales: 0 };
    const a = calcularAlertas(
      entrada([hotel({ reservas: vacio }), hotel({ id: "h2", slug: "dos", situacion: "cortesia", reservas: vacio })], {
        lecturas: { camila: true, reservas: false },
      }),
    );
    expect(a).toEqual([]);
  });

  // CON `?pestana=chats`: la bandeja sólo abre sola en los chats si no hay
  // NINGUNA alerta pendiente, así que con una alerta viva el clic aterrizaba en
  // «Alertas» y los chats que se fue a ver no se veían.
  it("chats escalados llevan a la pestaña de chats de la bandeja; leads fríos, a leads", () => {
    const a = calcularAlertas(
      entrada([], { chatsEscalados: 2, leads: [{ etapa: "nuevo", created_at: hace(4) }] }),
    );
    expect(a.find((x) => x.id === "chats")?.href).toBe("/crm/bandeja?pestana=chats");
    expect(a.find((x) => x.id === "leads-frios")?.href).toBe("/crm/leads");
  });

  it("las altas van primero", () => {
    const a = calcularAlertas(
      entrada([hotel({ id: "h2", slug: "dos", camila: null }), hotel({ situacion: "moroso" })]),
    );
    expect(a[0].severidad).toBe("alta");
    expect(a[a.length - 1].severidad).toBe("media");
  });
});
