// Las conversiones que se le mandan a GA4 deciden en qué palabras clave gasta
// Google Ads los $130 al día. Si `generate_lead` no sale, Ads optimiza como si
// esa fuente no convirtiera — y eso es exactamente lo que llevaba pasando con
// las 18 herramientas gratis (K-40): su formulario nunca llamaba a `trackLead`.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { trackLead } from "@/lib/analytics";

type Llamada = unknown[];
let llamadas: Llamada[];

beforeEach(() => {
  llamadas = [];
  (globalThis as unknown as { window: unknown }).window = globalThis;
  (globalThis as unknown as { gtag: unknown }).gtag = (...a: unknown[]) => llamadas.push(a);
});
afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).gtag;
  vi.unstubAllEnvs();
});

const eventosGenerateLead = () =>
  llamadas.filter((c) => c[0] === "event" && c[1] === "generate_lead");

describe("trackLead", () => {
  it("emite generate_lead con el canal que lo originó", () => {
    trackLead("herramienta");
    const ev = eventosGenerateLead();
    expect(ev).toHaveLength(1);
    expect((ev[0][2] as { method: string }).method).toBe("herramienta");
  });

  // Los tres canales tienen que ser distinguibles en GA4: si las herramientas
  // reportaran "form", el dato por el que se cablearon quedaría escondido dentro
  // del formulario de la landing.
  it("distingue los tres canales", () => {
    trackLead("form");
    trackLead("whatsapp");
    trackLead("herramienta");
    expect(eventosGenerateLead().map((c) => (c[2] as { method: string }).method)).toEqual([
      "form",
      "whatsapp",
      "herramienta",
    ]);
  });

  // Sin gtag cargado (bloqueador de anuncios, o GA sin configurar) la función se
  // llama igual desde el `onSubmit`: no puede lanzar y tumbar el envío del lead.
  it("no lanza cuando gtag no existe", () => {
    delete (globalThis as unknown as Record<string, unknown>).gtag;
    expect(() => trackLead("herramienta")).not.toThrow();
    expect(llamadas).toHaveLength(0);
  });
});
