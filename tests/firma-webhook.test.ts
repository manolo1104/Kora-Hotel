// La puerta por la que entran TODAS las reservas pagadas de todos los hoteles.
// Si esta función acepta un evento que no viene de Stripe, cualquiera crea
// reservas confirmadas sin pagar; si rechaza uno legítimo, el huésped paga y no
// recibe nada. No tenía ni una prueba.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";
import { verificarFirma, secretosDeReservas } from "@/lib/stripe/firma";

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
