// El aviso de recargas del 1 oct 2026: dice los precios nuevos y nunca los viejos.
import { describe, it, expect } from "vitest";
import { emailAvisoRecargas, TIPO_AVISO_RECARGAS } from "@/lib/email/aviso-recargas";

describe("aviso de recargas", () => {
  const { subject, html } = emailAvisoRecargas({ nombre: "Rosa" });

  it("anuncia el 1 de octubre, que cae en jueves", () => {
    expect(subject).toContain("1 de octubre");
    expect(html).toContain("jueves 1 de octubre");
    expect(new Date(2026, 9, 1).getDay()).toBe(4);
  });

  it("trae los paquetes nuevos y no el de $100 = 300", () => {
    expect(html).toContain("$300 = 500 mensajes");
    expect(html).toContain("$2,000 = 4,500 mensajes");
    expect(html).not.toContain("$100 =");
  });

  it("manda las dudas a WhatsApp: el correo de Kora no tiene buzón", () => {
    expect(html).toContain("https://wa.me/");
    expect(html).not.toMatch(/contéstame este correo/i);
  });

  it("lleva la fecha en el tipo, para no salir dos veces", () => {
    expect(TIPO_AVISO_RECARGAS).toMatch(/2026_10_01$/);
  });
});
