// El contrato de tres puntas: quien cobra por el motor web, quien cobra por
// Camila, y quien crea la reserva al recibir el pago. Stripe acepta cualquier
// objeto de strings, así que una clave mal escrita NO falla al cobrar: falla
// después, con el huésped ya pagado y sin reserva.
//
// `lib/agent-booking.ts` dice desde el día uno "Separado del route para poder
// testear sin auth/HTTP". Este es ese test.
import { describe, it, expect } from "vitest";
import {
  construirMetadataBase,
  clavesQueFaltan,
  CLAVES_QUE_LEE_EL_WEBHOOK,
  CLAVES_OPCIONALES,
  type MetadataBase,
} from "@/lib/booking/metadata";

const BASE: MetadataBase = {
  hotelId: "11111111-1111-1111-1111-111111111111",
  slug: "hotel-magico",
  rooms: "Cabaña:2|Cabaña 2:3",
  checkin: "2026-09-10",
  checkout: "2026-09-12",
  nights: 2,
  stayTotal: 6650,
  deposit: 3325,
  pending: 3325,
  anticipoPct: 50,
  ratePlan: "flex",
  payMode: "online",
  adults: 3,
  children: 2,
  customerName: "Ana Pérez",
  customerEmail: "ana@example.com",
  customerPhone: "+52 489 100 7679",
  holdSession: "web_abc",
  lang: "es",
};

describe("construirMetadataBase", () => {
  it("trae TODAS las claves que el webhook lee", () => {
    expect(clavesQueFaltan(construirMetadataBase(BASE))).toEqual([]);
  });

  it("el objeto del MOTOR WEB (base + extras) cumple el contrato", () => {
    const web = {
      ...construirMetadataBase(BASE),
      addons: "Desayuno|Masaje",
      experiencias: "Cascadas",
      experiencias_data: "[]",
      bundleDiscount: "100",
      nrfDiscount: "900",
    };
    expect(clavesQueFaltan(web)).toEqual([]);
  });

  it("el objeto de CAMILA (base + origen) cumple el mismo contrato", () => {
    const bot = { ...construirMetadataBase({ ...BASE, holdSession: "bot_abc" }), origen: "bot" };
    expect(clavesQueFaltan(bot)).toEqual([]);
    expect(bot.origen).toBe("bot");
  });

  it("todo valor es string: Stripe rechaza metadata que no lo sea", () => {
    for (const v of Object.values(construirMetadataBase(BASE))) {
      expect(typeof v).toBe("string");
    }
  });

  it("Stripe limita metadata a 50 claves", () => {
    expect(Object.keys(construirMetadataBase(BASE)).length).toBeLessThanOrEqual(50);
  });

  it("ningún valor pasa de 500 caracteres (tope duro de Stripe)", () => {
    const enorme = construirMetadataBase({
      ...BASE,
      rooms: Array.from({ length: 80 }, (_, i) => `Cabaña ${i}:2`).join("|"),
      customerName: "x".repeat(400),
      customerEmail: "y".repeat(400),
      customerPhone: "9".repeat(90),
    });
    for (const [k, v] of Object.entries(enorme)) {
      expect(v.length, `la clave ${k} se pasa del tope`).toBeLessThanOrEqual(500);
    }
  });

  // `isDeposit` decide si el correo dice "pagaste el anticipo" o "pagaste todo".
  it("isDeposit distingue anticipo de pago completo", () => {
    expect(construirMetadataBase(BASE).isDeposit).toBe("true");
    expect(construirMetadataBase({ ...BASE, deposit: 6650, pending: 0 }).isDeposit).toBe("false");
    // "Pagar en el hotel": no se cobró nada, así que tampoco es un anticipo.
    expect(construirMetadataBase({ ...BASE, deposit: 0, payMode: "hotel" }).isDeposit).toBe("false");
  });

  it("las claves obligatorias y las opcionales no se solapan", () => {
    const obligatorias = new Set<string>(CLAVES_QUE_LEE_EL_WEBHOOK);
    for (const k of CLAVES_OPCIONALES) expect(obligatorias.has(k)).toBe(false);
  });

  it("clavesQueFaltan nombra exactamente lo que falta", () => {
    const md = construirMetadataBase(BASE);
    delete (md as Record<string, string>).holdSession;
    delete (md as Record<string, string>).lang;
    expect(clavesQueFaltan(md).sort()).toEqual(["holdSession", "lang"]);
  });
});
