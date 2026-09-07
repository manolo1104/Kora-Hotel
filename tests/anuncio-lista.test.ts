// El correo de novedades a la lista de Kora.
//
// Es correo COMERCIAL a personas reales, así que lo que se prueba no es que se
// vea bien: es que nadie lo reciba sin una salida, y que el nombre que teclea
// un desconocido en el formulario de la guía no se convierta en marcado dentro
// del correo de otro.
import { describe, it, expect } from "vitest";
import { emailAnuncio, TIPO_ANUNCIO } from "@/lib/email/anuncio";

describe("nadie lo recibe sin poder salirse", () => {
  it("lleva el enlace de baja con SU token", () => {
    const { html } = emailAnuncio({ nombre: "Luis", token: "tok-123" });
    expect(html).toContain("/baja?t=tok-123");
    expect(html).toContain("Darme de baja");
  });

  it("dice por qué le llega", () => {
    expect(emailAnuncio({ token: "t" }).html).toContain("Recibes esto porque");
  });
});

describe("el nombre lo teclea un desconocido", () => {
  it("no se convierte en marcado", () => {
    const { html } = emailAnuncio({ nombre: 'Luis <b>MALO</b> & "Cía"', token: "t" });
    expect(html).not.toContain("<b>MALO</b>");
    expect(html).toContain("&lt;b&gt;MALO&lt;/b&gt;");
    expect(html).not.toContain("&amp;amp;");
  });

  it("sin nombre saluda igual, sin dejar un hueco", () => {
    const { html } = emailAnuncio({ token: "t" });
    expect(html).not.toContain("Hola, ,");
    expect(html).not.toContain("undefined");
  });
});

describe("el contenido", () => {
  it("no promete nada que no exista y no deja variables sin resolver", () => {
    const { subject, html } = emailAnuncio({ nombre: "Luis", token: "t" });
    expect(subject.length).toBeGreaterThan(20);
    expect(html).not.toMatch(/\{[a-zA-Z]+\}/);
    expect(html).not.toContain("NaN");
  });

  it("el tipo del apunte es estable (si cambia, se puede reenviar a todos)", () => {
    expect(TIPO_ANUNCIO).toBe("anuncio_bandeja_correos");
  });
});
