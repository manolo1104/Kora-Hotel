// Por qué un hotel no tiene Camila, y que el panel diga LO MISMO que el fleet.
//
// El 31 ago 2026 un hotel real (San Luis) se dio de alta y no le aparecía el
// código QR. No estaba roto nada: el hotel no era elegible todavía. Lo malo era
// que la pantalla le decía «Estamos preparando tu conexión», o sea, "espera",
// cuando lo que faltaba dependía de él y nadie se lo estaba pidiendo.
import { describe, it, expect } from "vitest";
import { motivosSinBot, QUE_HACER, type MotivoSinBot } from "@/lib/bot/elegibilidad";

const HOTEL_OK = { publicado: true, whatsapp: "5214811234567", config: {}, extras: {} };

describe("motivosSinBot", () => {
  it("un hotel listo no tiene motivos: su Camila debe arrancar sola", () =>
    expect(motivosSinBot(HOTEL_OK, true)).toEqual([]));

  // EL CASO DE SAN LUIS: recién dado de alta, todavía sin publicar.
  it("sin publicar lo dice, en vez de dejarlo esperando", () => {
    const m = motivosSinBot({ ...HOTEL_OK, publicado: false }, true);
    expect(m).toContain("sin-publicar");
  });

  it("la prueba vencida o el plan caído se distinguen de un fallo técnico", () =>
    expect(motivosSinBot(HOTEL_OK, false)).toContain("sin-acceso"));

  it("el bot apagado por el propio dueño se nombra aparte", () =>
    expect(motivosSinBot({ ...HOTEL_OK, config: { bot_enabled: false } }, true)).toContain(
      "bot-apagado",
    ));

  it("sin número de WhatsApp no hay nada a que vincular el QR", () =>
    expect(motivosSinBot({ ...HOTEL_OK, whatsapp: "   " }, true)).toContain("sin-whatsapp"));

  it("un hotel demo no conecta WhatsApp, y es a propósito", () =>
    expect(motivosSinBot({ ...HOTEL_OK, extras: { demo: true } }, true)).toContain("demo"));

  it("acumula todo lo que falta, no sólo lo primero", () => {
    const m = motivosSinBot({ publicado: false, whatsapp: null, config: {}, extras: {} }, false);
    expect(m).toEqual(expect.arrayContaining(["sin-publicar", "sin-acceso", "sin-whatsapp"]));
  });

  // `bot_enabled` ausente = encendido. Un hotel nuevo no trae la clave, y
  // tratarlo como apagado le pediría "enciende a Camila" el primer día.
  it("bot_enabled ausente NO cuenta como apagado", () =>
    expect(motivosSinBot({ ...HOTEL_OK, config: {} }, true)).not.toContain("bot-apagado"));
});

describe("lo que se le enseña al hotelero", () => {
  it("cada motivo tiene su qué-hacer, sin huecos", () => {
    const todos: MotivoSinBot[] = [
      "sin-publicar",
      "bot-apagado",
      "sin-acceso",
      "sin-whatsapp",
      "demo",
    ];
    for (const m of todos) {
      expect(QUE_HACER[m]?.titulo?.length).toBeGreaterThan(3);
      expect(QUE_HACER[m]?.detalle?.length).toBeGreaterThan(10);
    }
  });
});

// ─── Camila sólo con plan pagado (23 sep 2026) ───────────────────────────────
import { puedeUsarCamila, CORTE_CAMILA_CON_PLAN } from "@/lib/suscripcion";

describe("Camila se abre al pagar", () => {
  const antes = new Date(CORTE_CAMILA_CON_PLAN - 86_400_000).toISOString();
  const despues = new Date(CORTE_CAMILA_CON_PLAN + 60_000).toISOString();
  const prueba = { activo: true, planActivo: false };

  it("hotel nuevo en prueba gratis: sin Camila", () => {
    expect(puedeUsarCamila(prueba, { created_at: despues })).toBe(false);
  });

  it("hotel nuevo que ya pagó: con Camila", () => {
    expect(puedeUsarCamila({ activo: true, planActivo: true }, { created_at: despues })).toBe(true);
  });

  it("hotel registrado antes del corte conserva a Camila en su prueba", () => {
    expect(puedeUsarCamila(prueba, { created_at: antes })).toBe(true);
  });

  it("prueba vencida o cuenta bloqueada: nunca", () => {
    expect(puedeUsarCamila({ activo: false, planActivo: false }, { created_at: antes })).toBe(false);
  });

  it("si la suscripción no se pudo leer, falla abierto", () => {
    expect(
      puedeUsarCamila({ activo: true, planActivo: false, lecturaFallida: true }, { created_at: despues }),
    ).toBe(true);
  });

  it("sin fecha de alta no se regala: cuenta como nuevo", () => {
    expect(puedeUsarCamila(prueba, { created_at: null })).toBe(false);
  });

  it("el motivo «sin-pago» sale sólo si hay acceso y falta el pago", () => {
    const h = { publicado: true, whatsapp: "5215512345678" };
    expect(motivosSinBot(h, true, false)).toEqual(["sin-pago"]);
    expect(motivosSinBot(h, false, false)).toEqual(["sin-acceso"]);
    expect(motivosSinBot(h, true, true)).toEqual([]);
    expect(motivosSinBot(h, true)).toEqual([]);
  });
});
