// Las reglas de los botones de la ficha de hotel del CRM (15 sep 2026).
//
// Cada botón toca acceso o dinero de alguien: regalar cortesía a quien ya paga
// con Stripe (Stripe le sigue cobrando y el CRM dice «cortesía»), alargar una
// prueba y borrarle los días que ya tenía, marcar como demo a un cliente real
// (su motor deja de cobrar). Lo que se vigila aquí son esas formas de romperlo,
// en las funciones PURAS que comparten la API y la ficha.
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  DIA_MS,
  DIAS_EXTENSION,
  DIAS_EXTRA_TOPE,
  REF_REGALO,
  calcularExtension,
  diasExtraSanos,
  diasRestantes,
  extrasCon,
  extrasSinAvisosPrueba,
  mensajeBloqueoValido,
  mensajesRegaloValidos,
  motivoValido,
  pagaConStripe,
  puedeDarCortesia,
  puedeDesbloquear,
  puedeExtenderPrueba,
  puedeMarcarDemo,
  puedeQuitarCortesia,
  puedeQuitarDemo,
  refRegaloValido,
  situacionHotel,
  type SuscripcionMinima,
} from "@/lib/crm/acciones";
import { finDePrueba, inicioDePrueba, pruebaDelHotel } from "@/lib/suscripcion";
import { DIAS_EXTRA_MAX } from "@/lib/db/prueba-dueno";

const HOY = new Date("2026-10-20T12:00:00Z");
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(HOY);
});
afterAll(() => {
  vi.useRealTimers();
});

const hace = (d: number) => new Date(HOY.getTime() - d * DIA_MS).toISOString();
const sub = (estado: SuscripcionMinima["estado"], stripe: string | null = null): SuscripcionMinima => ({
  estado,
  stripe_subscription_id: stripe,
});

describe("el tope de días extra es el mismo en los tres sitios", () => {
  it("acciones.ts (navegador) y prueba-dueno.ts (servidor) dicen lo mismo", () => {
    expect(DIAS_EXTRA_TOPE).toBe(DIAS_EXTRA_MAX);
  });

  it("los botones de días son 7, 14 y 30", () => {
    expect([...DIAS_EXTENSION]).toEqual([7, 14, 30]);
  });
});

describe("cortesía", () => {
  it("a quien no tiene fila se le puede dar", () => {
    expect(puedeDarCortesia(null).ok).toBe(true);
  });

  it("a quien canceló o quedó incompleto, también", () => {
    expect(puedeDarCortesia(sub("cancelada", "sub_viejo")).ok).toBe(true);
    expect(puedeDarCortesia(sub("incompleta", "sub_x")).ok).toBe(true);
  });

  // El caso por el que existe la regla: pisarle la fila a quien paga deja a
  // Stripe cobrándole cada mes y al CRM diciendo «cortesía».
  it("a quien paga con Stripe NO", () => {
    const v = puedeDarCortesia(sub("activa", "sub_123"));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.motivo).toMatch(/Stripe/);
    expect(puedeDarCortesia(sub("pago_vencido", "sub_123")).ok).toBe(false);
  });

  it("una fila «activa» sin suscripción de Stripe no cuenta como pago real", () => {
    expect(pagaConStripe(sub("activa", null))).toBe(false);
    expect(puedeDarCortesia(sub("activa", null)).ok).toBe(true);
  });

  it("dos veces no: ya la tiene", () => {
    expect(puedeDarCortesia(sub("cortesia")).ok).toBe(false);
  });

  it("sólo se quita lo que es cortesía (nunca un plan pagado)", () => {
    expect(puedeQuitarCortesia(sub("cortesia")).ok).toBe(true);
    expect(puedeQuitarCortesia(sub("activa", "sub_123")).ok).toBe(false);
    expect(puedeQuitarCortesia(null).ok).toBe(false);
  });
});

describe("¿se puede alargar la prueba?", () => {
  it("sí, a quien no tiene plan", () => {
    expect(puedeExtenderPrueba({ planActivo: false, estado: null, demo: false }).ok).toBe(true);
    expect(puedeExtenderPrueba({ planActivo: false, estado: "cancelada", demo: false }).ok).toBe(true);
  });

  it("no, a quien tiene plan o cortesía", () => {
    const pago = puedeExtenderPrueba({ planActivo: true, estado: "activa", demo: false });
    const cortesia = puedeExtenderPrueba({ planActivo: true, estado: "cortesia", demo: false });
    expect(pago.ok).toBe(false);
    expect(cortesia.ok).toBe(false);
    if (!cortesia.ok) expect(cortesia.motivo).toMatch(/cortesía/);
  });

  it("no, a un demo (no caduca)", () => {
    expect(puedeExtenderPrueba({ planActivo: false, estado: null, demo: true }).ok).toBe(false);
  });
});

describe("cuántos días extra se guardan", () => {
  it("prueba vigente: se suman a su fin, exactos", () => {
    const finBaseMs = HOY.getTime() + 5 * DIA_MS;
    const r = calcularExtension({ finBaseMs, diasExtraActuales: 0, dias: 7, ahora: HOY.getTime() });
    expect(r).toEqual({ ok: true, diasExtra: 7, nuevoFinMs: finBaseMs + 7 * DIA_MS });
  });

  // `sumarDiasExtraPrueba` FIJA el total: pasarle sólo los nuevos le quitaría al
  // hotel los que ya tenía.
  it("devuelve el TOTAL: con 14 ya regalados, +7 guarda 21", () => {
    const finBaseMs = HOY.getTime() - 3 * DIA_MS; // sin extras ya venció…
    const r = calcularExtension({ finBaseMs, diasExtraActuales: 14, dias: 7, ahora: HOY.getTime() }); // …con 14 le quedan 11
    expect(r.ok && r.diasExtra).toBe(21);
  });

  it("prueba vencida: cuentan desde HOY, no desde el fin viejo", () => {
    const finBaseMs = HOY.getTime() - 20 * DIA_MS;
    const r = calcularExtension({ finBaseMs, diasExtraActuales: 0, dias: 7, ahora: HOY.getTime() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoFinMs).toBeGreaterThanOrEqual(HOY.getTime() + 7 * DIA_MS);
    // Redondea hacia arriba: puede sobrar un pedazo de día, nunca faltar uno entero.
    expect(r.nuevoFinMs).toBeLessThan(HOY.getTime() + 8 * DIA_MS);
    expect(r.diasExtra).toBe(27);
  });

  it("vencida a media tarde: nunca le da menos de lo prometido", () => {
    const finBaseMs = HOY.getTime() - 2.5 * DIA_MS;
    const r = calcularExtension({ finBaseMs, diasExtraActuales: 0, dias: 14, ahora: HOY.getTime() });
    expect(r.ok && r.nuevoFinMs - HOY.getTime()).toBeGreaterThanOrEqual(14 * DIA_MS);
  });

  it("pasar del tope se rechaza en vez de recortarse en silencio", () => {
    const finBaseMs = HOY.getTime();
    const r = calcularExtension({ finBaseMs, diasExtraActuales: 350, dias: 30, ahora: HOY.getTime() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/tope/);
  });

  it("en el tope justo, sí", () => {
    const r = calcularExtension({ finBaseMs: HOY.getTime(), diasExtraActuales: 335, dias: 30, ahora: HOY.getTime() });
    expect(r.ok && r.diasExtra).toBe(365);
  });

  it("datos raros no regalan nada", () => {
    expect(calcularExtension({ finBaseMs: NaN, diasExtraActuales: 0, dias: 7, ahora: HOY.getTime() }).ok).toBe(false);
    expect(calcularExtension({ finBaseMs: HOY.getTime(), diasExtraActuales: 0, dias: 0, ahora: HOY.getTime() }).ok).toBe(false);
    expect(calcularExtension({ finBaseMs: HOY.getTime(), diasExtraActuales: 0, dias: 2.5, ahora: HOY.getTime() }).ok).toBe(false);
    expect(diasExtraSanos(-4)).toBe(0);
    expect(diasExtraSanos("x")).toBe(0);
    expect(diasExtraSanos(9999)).toBe(365);
  });

  // La prueba de fuego: lo que calcula el CRM es lo que luego ve el sistema.
  it("con los días guardados, pruebaDelHotel llega exactamente a la fecha prometida", () => {
    const creado = hace(40); // alta posterior al cambio a 14 días: venció hace 26
    const finBaseMs = finDePrueba(inicioDePrueba(creado, null), 0).getTime();
    const r = calcularExtension({ finBaseMs, diasExtraActuales: 0, dias: 7, ahora: Date.now() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = pruebaDelHotel({ created_at: creado }, null, r.diasExtra)!;
    expect(p.fin.getTime()).toBe(r.nuevoFinMs);
    expect(p.vencida).toBe(false);
    expect(p.diasRestantes).toBe(diasRestantes(r.nuevoFinMs, Date.now()));
    expect(p.diasRestantes).toBeGreaterThanOrEqual(7);
  });

  it("y respeta a quien entró con 30 días (antes del 6 sep)", () => {
    const creado = "2026-08-20T12:00:00-06:00";
    const finBaseMs = finDePrueba(inicioDePrueba(creado, null), 0).getTime();
    expect(finBaseMs).toBe(Date.parse(creado) + 30 * DIA_MS);
    const r = calcularExtension({ finBaseMs, diasExtraActuales: 0, dias: 14, ahora: Date.now() });
    const p = pruebaDelHotel({ created_at: creado }, null, r.ok ? r.diasExtra : 0)!;
    expect(r.ok && p.fin.getTime()).toBe(r.ok ? r.nuevoFinMs : -1);
  });
});

describe("demo", () => {
  it("no se marca como demo a quien paga con Stripe (su motor dejaría de cobrar)", () => {
    expect(puedeMarcarDemo({ demo: false, sub: sub("activa", "sub_1") }).ok).toBe(false);
  });

  it("sí a un hotel sin plan, o con cortesía", () => {
    expect(puedeMarcarDemo({ demo: false, sub: null }).ok).toBe(true);
    expect(puedeMarcarDemo({ demo: false, sub: sub("cortesia") }).ok).toBe(true);
  });

  it("no se marca dos veces ni se quita lo que no está", () => {
    expect(puedeMarcarDemo({ demo: true, sub: null }).ok).toBe(false);
    expect(puedeQuitarDemo(false).ok).toBe(false);
    expect(puedeQuitarDemo(true).ok).toBe(true);
  });
});

describe("bloqueo", () => {
  it("el mensaje es obligatorio y con tope", () => {
    expect(mensajeBloqueoValido("  ")).toBeNull();
    expect(mensajeBloqueoValido("  Cuenta en revisión  ")).toBe("Cuenta en revisión");
    expect(mensajeBloqueoValido("x".repeat(501))).toBeNull();
  });

  it("no se desbloquea lo que no está bloqueado", () => {
    expect(puedeDesbloquear(false).ok).toBe(false);
    expect(puedeDesbloquear(true).ok).toBe(true);
  });
});

describe("validaciones de lo que llega del navegador", () => {
  it("el motivo es obligatorio: ni vacío ni de relleno", () => {
    expect(motivoValido("")).toBeNull();
    expect(motivoValido("  ok ")).toBeNull();
    expect(motivoValido(" Me lo pidió por WhatsApp ")).toBe("Me lo pidió por WhatsApp");
    expect(motivoValido(42)).toBeNull();
    expect(motivoValido("x".repeat(501))).toBeNull();
  });

  it("los mensajes a regalar: enteros de 1 a 5000", () => {
    expect(mensajesRegaloValidos(1)).toBe(true);
    expect(mensajesRegaloValidos(5000)).toBe(true);
    expect(mensajesRegaloValidos(0)).toBe(false);
    expect(mensajesRegaloValidos(5001)).toBe(false);
    expect(mensajesRegaloValidos(10.5)).toBe(false);
    expect(mensajesRegaloValidos(NaN)).toBe(false);
    expect(mensajesRegaloValidos("100")).toBe(false);
  });

  // El `ref` es lo que impide regalar dos veces: tiene que ser único por clic y
  // con una forma que no choque con los de las recargas pagadas ni los scripts.
  it("el ref del regalo es crm:<uuid>", () => {
    expect(refRegaloValido("crm:3f1c2a4e-9b7d-4c1e-8a2b-1234567890ab")).toBe(true);
    expect(refRegaloValido("regalo-lanzamiento")).toBe(false);
    expect(refRegaloValido("crm:")).toBe(false);
    expect(refRegaloValido("crm:3f1c2a4e-9b7d-4c1e-8a2b-1234567890ab-extra")).toBe(false);
    expect(REF_REGALO.test("CRM:3F1C2A4E-9B7D-4C1E-8A2B-1234567890AB")).toBe(true);
  });
});

describe("extras sin mutar", () => {
  it("poner y quitar una llave no toca el resto ni el original", () => {
    const original = { fotos: ["a.jpg"], diseno: { color: "#000" }, demo: true };
    const sin = extrasCon(original, "demo", undefined);
    expect(sin).toEqual({ fotos: ["a.jpg"], diseno: { color: "#000" } });
    expect(original.demo).toBe(true);
    const bloqueado = extrasCon(original, "bloqueo", { activo: true, mensaje: "x", fecha: "2026-10-20" });
    expect(bloqueado.fotos).toBe(original.fotos);
    expect(bloqueado.bloqueo).toEqual({ activo: true, mensaje: "x", fecha: "2026-10-20" });
  });

  it("con extras vacíos o raros, parte de un objeto limpio", () => {
    expect(extrasCon(null, "demo", true)).toEqual({ demo: true });
    expect(extrasCon([] as unknown as Record<string, unknown>, "demo", true)).toEqual({ demo: true });
  });

  it("borrar los avisos de la prueba conserva lo demás de `prueba`", () => {
    const original = { fotos: [], prueba: { avisos: ["7", "3"], otra: 1 } };
    const r = extrasSinAvisosPrueba(original);
    expect(r.cambio).toBe(true);
    expect(r.extras).toEqual({ fotos: [], prueba: { otra: 1 } });
    expect(original.prueba.avisos).toEqual(["7", "3"]);
  });

  it("sin avisos no hay nada que escribir", () => {
    expect(extrasSinAvisosPrueba({ fotos: [] }).cambio).toBe(false);
    expect(extrasSinAvisosPrueba({ prueba: {} }).cambio).toBe(false);
    expect(extrasSinAvisosPrueba(null).cambio).toBe(false);
  });
});

describe("situación del hotel: mismo orden que operaciones.ts", () => {
  const base = { bloqueado: false, demo: false, suscripcionLeida: true, estado: null, pruebaVencida: false } as const;

  it("bloqueado gana a todo, luego demo", () => {
    expect(situacionHotel({ ...base, bloqueado: true, demo: true, estado: "activa" })).toBe("bloqueado");
    expect(situacionHotel({ ...base, demo: true, estado: "activa" })).toBe("demo");
  });

  it("después, el plan: moroso → pago → cortesía → cancelada", () => {
    expect(situacionHotel({ ...base, estado: "pago_vencido" })).toBe("moroso");
    expect(situacionHotel({ ...base, estado: "activa" })).toBe("pago");
    expect(situacionHotel({ ...base, estado: "cortesia" })).toBe("cortesia");
    expect(situacionHotel({ ...base, estado: "cancelada", pruebaVencida: false })).toBe("cancelada");
  });

  it("sin plan (o incompleta), manda la prueba", () => {
    expect(situacionHotel({ ...base, estado: null, pruebaVencida: false })).toBe("prueba");
    expect(situacionHotel({ ...base, estado: "incompleta", pruebaVencida: true })).toBe("prueba_vencida");
  });

  // El cero falso que no se puede pintar: con la suscripción sin leer, un hotel
  // que paga saldría «prueba vencida».
  it("sin leer la suscripción no se inventa: null", () => {
    expect(situacionHotel({ ...base, suscripcionLeida: false, pruebaVencida: true })).toBeNull();
    expect(situacionHotel({ ...base, estado: null, pruebaVencida: null })).toBeNull();
  });

  it("bloqueado y demo sí se saben aunque falle la suscripción", () => {
    expect(situacionHotel({ ...base, suscripcionLeida: false, bloqueado: true })).toBe("bloqueado");
    expect(situacionHotel({ ...base, suscripcionLeida: false, demo: true })).toBe("demo");
  });
});
