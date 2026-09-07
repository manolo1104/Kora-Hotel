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

// Las dos versiones del mismo correo. Lo que se prueba es que no se crucen: un
// cliente que paga no puede recibir un botón a la página de precios, y alguien
// de la lista de captación no puede recibir un correo comercial sin baja.
describe("hotelero y suscriptor no reciben lo mismo", () => {
  it("al HOTELERO se le manda a su panel, no a precios", () => {
    const { html } = emailAnuncio({ nombre: "Luis" });
    expect(html).toContain("Abrir mi panel");
    expect(html).not.toContain("Ver Kora");
    expect(html).toContain("tienes un hotel en Kora");
  });

  it("al hotelero NO se le pone una baja que no le corresponde", () => {
    expect(emailAnuncio({ nombre: "Luis" }).html).not.toContain("Darme de baja");
  });

  it("al SUSCRIPTOR se le manda a precios y con baja", () => {
    const { html } = emailAnuncio({ nombre: "Luis", token: "tok-9" });
    expect(html).toContain("Ver Kora");
    expect(html).toContain("Darme de baja");
    expect(html).not.toContain("Abrir mi panel");
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
