// La puerta por la que entran TODAS las reservas pagadas de todos los hoteles.
// Si esta función acepta un evento que no viene de Stripe, cualquiera crea
// reservas confirmadas sin pagar; si rechaza uno legítimo, el huésped paga y no
// recibe nada. No tenía ni una prueba.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";
import {
  verificarFirma,
  secretosDeReservas,
  pareceDeStripe,
  diagnosticoFirma,
} from "@/lib/stripe/firma";

const SECRETO_PROPIO = "whsec_cuentaPropia_00000000000000000000";
const SECRETO_CONNECT = "whsec_connect_11111111111111111111111";
const AJENO = "whsec_deOtro_2222222222222222222222222";

const CUERPO = JSON.stringify({
  id: "evt_test",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test", object: "checkout.session" } },
});

/** Firma como lo hace Stripe de verdad (mismo HMAC que usa constructEvent). */
function firmar(cuerpo: string, secreto: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload: cuerpo, secret: secreto });
}

const envOriginal = { ...process.env };
beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy";
  process.env.STRIPE_WEBHOOK_SECRET_RESERVAS = SECRETO_PROPIO;
  process.env.STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT = SECRETO_CONNECT;
});
afterEach(() => {
  process.env = { ...envOriginal };
});

describe("verificarFirma", () => {
  it("acepta un evento firmado con el secreto de CUENTA PROPIA", () => {
    const ev = verificarFirma(CUERPO, firmar(CUERPO, SECRETO_PROPIO));
    expect(ev?.id).toBe("evt_test");
  });

  // Con direct charges los eventos llegan desde las cuentas conectadas de los
  // hoteles y traen su propio secreto: los DOS tienen que valer.
  it("acepta un evento firmado con el secreto de CUENTAS CONECTADAS", () => {
    const ev = verificarFirma(CUERPO, firmar(CUERPO, SECRETO_CONNECT));
    expect(ev?.id).toBe("evt_test");
  });

  it("rechaza un evento firmado con un secreto ajeno", () => {
    expect(verificarFirma(CUERPO, firmar(CUERPO, AJENO))).toBeNull();
  });

  // El caso que de verdad importa: firma válida, cuerpo alterado. Si esto
  // pasara, se podría cambiar el hotel_id o el total de una reserva real.
  it("rechaza un cuerpo alterado aunque la firma fuera válida para el original", () => {
    const firma = firmar(CUERPO, SECRETO_PROPIO);
    const alterado = CUERPO.replace("cs_test", "cs_OTRO");
    expect(verificarFirma(alterado, firma)).toBeNull();
  });

  it("rechaza una firma vacía", () => {
    expect(verificarFirma(CUERPO, "")).toBeNull();
  });

  // Sin secretos configurados no hay nada contra qué validar. Devolver el evento
  // aquí sería peor que rechazarlo: aceptaría cualquier cosa de internet.
  it("sin secretos configurados devuelve null (y el POST responde 500, no 200)", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET_RESERVAS;
    delete process.env.STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT;
    expect(secretosDeReservas()).toEqual([]);
    expect(verificarFirma(CUERPO, firmar(CUERPO, SECRETO_PROPIO))).toBeNull();
  });
});

// Un POST sin cabecera de firma no es un secreto mal puesto: es un robot. Antes
// los dos mandaban el MISMO correo, y por eso el correo dejaba de creerse.
describe("pareceDeStripe", () => {
  it("reconoce una cabecera de Stripe de verdad", () => {
    expect(pareceDeStripe(firmar(CUERPO, SECRETO_PROPIO))).toBe(true);
  });

  it("descarta lo que no trae cabecera, o trae basura", () => {
    expect(pareceDeStripe(null)).toBe(false);
    expect(pareceDeStripe("")).toBe(false);
    expect(pareceDeStripe("hola")).toBe(false);
    expect(pareceDeStripe("t=123")).toBe(false); // sin v1=
    expect(pareceDeStripe("v1=abc")).toBe(false); // sin t= y v1 corto
  });
});

describe("diagnosticoFirma", () => {
  it("señala el secreto de CUENTAS CONECTADAS cuando el evento trae account", () => {
    const cuerpo = JSON.stringify({ id: "evt_1", type: "charge.refunded", account: "acct_X", livemode: true });
    const texto = diagnosticoFirma(cuerpo, firmar(cuerpo, AJENO));
    expect(texto).toContain("STRIPE_WEBHOOK_SECRET_RESERVAS_CONNECT");
    expect(texto).toContain("acct_X");
  });

  it("avisa de que un evento de modo prueba nunca va a validar", () => {
    const cuerpo = JSON.stringify({ id: "evt_2", type: "checkout.session.completed", livemode: false });
    const texto = diagnosticoFirma(cuerpo, firmar(cuerpo, AJENO));
    expect(texto).toContain("MODO PRUEBA");
    expect(texto).toContain("No se perdió ninguna reserva real");
  });

  it("dice que no es JSON cuando el cuerpo no viene de Stripe", () => {
    const texto = diagnosticoFirma("<html>hola</html>", "t=1,v1=" + "a".repeat(64));
    expect(texto).toContain("no es JSON");
  });

  // El correo va a la bandeja de Manolo: no puede llevar el secreto dentro.
  it("nunca imprime un secreto, sólo su huella", () => {
    const texto = diagnosticoFirma(CUERPO, firmar(CUERPO, AJENO));
    expect(texto).not.toContain(SECRETO_PROPIO);
    expect(texto).not.toContain(SECRETO_CONNECT);
    expect(texto).toContain("huella");
  });
});
