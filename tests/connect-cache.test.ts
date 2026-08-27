// La regla que decide EN QUÉ CUENTA DE STRIPE entra el dinero de un huésped.
//
// El cache de `hotel_stripe_accounts` lo mantiene fresco el webhook
// `account.updated`, pero ese webhook se puede perder. Sin caducidad, una fila
// que dice `charges_enabled: false` de hace meses manda el cobro a la cuenta de
// Kora aunque el hotelero ya haya terminado su alta — y el hotelero no ve ese
// dinero ni en su panel ni en su Stripe (K-332, y es la puerta de K-21).
import { describe, it, expect } from "vitest";
import { cacheVigente, CACHE_MAX_HORAS } from "@/lib/stripe/connect";

const AHORA = Date.parse("2026-08-27T12:00:00.000Z");
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();

describe("cacheVigente", () => {
  it("sirve el cache recién escrito", () => {
    expect(cacheVigente(haceHoras(0), AHORA)).toBe(true);
    expect(cacheVigente(haceHoras(1), AHORA)).toBe(true);
  });

  it("sirve justo antes de las 24 h y deja de servir justo después", () => {
    expect(cacheVigente(haceHoras(CACHE_MAX_HORAS - 0.01), AHORA)).toBe(true);
    expect(cacheVigente(haceHoras(CACHE_MAX_HORAS + 0.01), AHORA)).toBe(false);
  });

  // El caso real medido el 26 ago 2026: filas del cache de hace semanas
  // diciendo `charges_enabled: false`.
  it("no sirve un cache de hace semanas", () => {
    expect(cacheVigente(haceHoras(24 * 30), AHORA)).toBe(false);
  });

  // Ante la duda, preguntar. Una llamada de más a Stripe cuesta milisegundos;
  // cobrar en la cuenta equivocada cuesta el dinero de una reserva.
  it("sin fecha, o con fecha ilegible, obliga a consultar en vivo", () => {
    expect(cacheVigente(null, AHORA)).toBe(false);
    expect(cacheVigente(undefined, AHORA)).toBe(false);
    expect(cacheVigente("", AHORA)).toBe(false);
    expect(cacheVigente("no es una fecha", AHORA)).toBe(false);
  });

  // Reloj corrido hacia adelante: se acaba de escribir, es válido.
  it("acepta una marca en el futuro", () => {
    expect(cacheVigente(new Date(AHORA + 60_000).toISOString(), AHORA)).toBe(true);
  });
});
