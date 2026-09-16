// La guarda de ORIGEN de las rutas del CRM que escriben.
//
// La cookie del CRM va con `path: "/"`, el dominio es el mismo que el de las
// páginas públicas de los hoteles y el repositorio es público: con botones que
// regalan saldo y callan a Camila, que la petición salga del propio CRM ya no es
// opcional. Aquí se prueba la parte pura (sólo cabeceras), sin cookies.
import { describe, it, expect, vi } from "vitest";

// `requireCrmAuth` lee cookies de Next; la parte que se prueba no la usa.
vi.mock("@/lib/crm/auth", () => ({ requireCrmAuth: async () => null }));

const { origenDeConfianza, requireCrmMutacion } = await import("@/lib/crm/guardas");

function peticion(method: string, cabeceras: Record<string, string>, url = "https://kora-hotel.com/api/crm/saldo") {
  return new Request(url, { method, headers: cabeceras });
}

describe("lecturas", () => {
  it("GET y HEAD pasan sin mirar el origen (no cambian nada)", () => {
    expect(origenDeConfianza(peticion("GET", {}))).toBe(true);
    expect(origenDeConfianza(peticion("HEAD", { origin: "https://malo.example" }))).toBe(true);
  });
});

describe("escrituras desde el propio CRM", () => {
  it("POST con Origin del mismo host pasa", () => {
    expect(origenDeConfianza(peticion("POST", { origin: "https://kora-hotel.com", host: "kora-hotel.com" }))).toBe(true);
  });

  // En Vercel `host` puede ser el dominio interno y el público viene aparte.
  it("vale el host público de x-forwarded-host", () => {
    expect(
      origenDeConfianza(
        peticion(
          "PATCH",
          { origin: "https://kora-hotel.com", host: "kora-abc123.vercel.app", "x-forwarded-host": "kora-hotel.com" },
          "https://kora-abc123.vercel.app/api/crm/hoteles",
        ),
      ),
    ).toBe(true);
  });

  it("sin Origin, se usa el Referer", () => {
    expect(
      origenDeConfianza(peticion("DELETE", { referer: "https://kora-hotel.com/crm/hoteles", host: "kora-hotel.com" })),
    ).toBe(true);
  });

  it("en local, con puerto", () => {
    expect(
      origenDeConfianza(
        peticion("POST", { origin: "http://localhost:3000", host: "localhost:3000" }, "http://localhost:3000/api/crm/x"),
      ),
    ).toBe(true);
  });
});

describe("escrituras que NO salen del CRM", () => {
  it("otro sitio", () => {
    expect(origenDeConfianza(peticion("POST", { origin: "https://malo.example", host: "kora-hotel.com" }))).toBe(false);
  });

  // `sameSite: lax` le manda la cookie a un subdominio hermano: el origen no.
  it("un subdominio del mismo sitio", () => {
    expect(
      origenDeConfianza(peticion("POST", { origin: "https://hotel.kora-hotel.com", host: "kora-hotel.com" })),
    ).toBe(false);
  });

  it("el mismo host con otro puerto no es el mismo origen", () => {
    expect(
      origenDeConfianza(peticion("POST", { origin: "https://kora-hotel.com:8443", host: "kora-hotel.com" })),
    ).toBe(false);
  });

  it("sin Origin ni Referer", () => {
    expect(origenDeConfianza(peticion("POST", { host: "kora-hotel.com" }))).toBe(false);
  });

  // `Origin: null` es el navegador negándose a decir de dónde viene: no se le
  // da una segunda oportunidad con el Referer.
  it("Origin: null no cae al Referer", () => {
    expect(
      origenDeConfianza(
        peticion("POST", { origin: "null", referer: "https://kora-hotel.com/crm", host: "kora-hotel.com" }),
      ),
    ).toBe(false);
  });

  it("un Origin que no es URL", () => {
    expect(origenDeConfianza(peticion("POST", { origin: "kora-hotel.com", host: "kora-hotel.com" }))).toBe(false);
  });
});

describe("requireCrmMutacion", () => {
  it("devuelve 403 con un mensaje legible cuando el origen no cuadra", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await requireCrmMutacion(peticion("POST", { origin: "https://malo.example", host: "kora-hotel.com" }));
    expect(r?.status).toBe(403);
    const cuerpo = (await r!.json()) as { error: string };
    expect(cuerpo.error).toMatch(/CRM/);
    warn.mockRestore();
  });

  it("devuelve null cuando todo está bien", async () => {
    expect(
      await requireCrmMutacion(peticion("POST", { origin: "https://kora-hotel.com", host: "kora-hotel.com" })),
    ).toBeNull();
  });
});
