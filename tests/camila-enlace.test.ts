// El link de pago que llegaba roto al huésped.
//
// Caso real, Hotel San Luis, 8 sep 2026: el huésped mandó captura del checkout
// de Stripe diciendo "The link is incomplete. Use the unmodified URL or ask the
// business for a new one". No había expirado — llegó partida, porque el modelo
// tenía que copiar a mano 700 caracteres y porque la respuesta se cortaba en el
// tope de 1024 tokens sin que nadie lo mirara.
import { describe, it, expect } from "vitest";
import { conLinkDePago, seCorto } from "../agentes/camila/enlace.js";

// Una de verdad: 700+ caracteres, con #fragmento, %2F y base64.
const URL_BUENA =
  "https://checkout.stripe.com/c/pay/cs_live_a1i527VYlrjdIPFDS7qPGXgjR2BYVnCY5ZrUr5teHSExPGravzqcawNQSK" +
  "#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdicGRmZGhqaWBTZHdsZGtxJz8ncXdgZHFoYGtxWjYnKSd2cXdsdWBEZmZqcGtx" +
  "Jz8nZGZmcVo0UERffGlEa0dKYzNwdVZtJyknZHVsTmB8Jz8ndW5aaWxzYFowNFZwQ0tOVVdyXG48d0p%2FalBmMDNGb3FCTzdT";

describe("el modelo ya no transporta el link", () => {
  it("una URL que el modelo copió A MEDIAS se sustituye por la buena", () => {
    const rota = URL_BUENA.slice(0, 180); // se cortó por el tope de tokens
    const r = conLinkDePago(`Listo, aquí tienes tu link:\n${rota}`, URL_BUENA);
    expect(r).toContain(URL_BUENA);
    // Y no queda el pedazo suelto por ahí.
    expect(r.split(URL_BUENA)[0]).not.toContain("checkout.stripe.com");
  });

  it("una URL que el modelo ALTERÓ también se sustituye", () => {
    const alterada = URL_BUENA.replace("%2F", "/").replace("cs_live_", "cs_live_X");
    const r = conLinkDePago(`Te paso el pago: ${alterada}`, URL_BUENA);
    expect(r).toContain(URL_BUENA);
    expect(r).not.toContain("cs_live_X");
  });

  it("el resumen que escribió el modelo se conserva", () => {
    const r = conLinkDePago("Estandar Doble, 22 al 23 de septiembre. Total $600.", URL_BUENA);
    expect(r).toContain("Estandar Doble");
    expect(r).toContain("$600");
    expect(r.endsWith(URL_BUENA)).toBe(true);
  });

  it("si el modelo sólo escribió el link, el mensaje es el link", () => {
    expect(conLinkDePago(URL_BUENA.slice(0, 90), URL_BUENA)).toBe(URL_BUENA);
    expect(conLinkDePago("", URL_BUENA)).toBe(URL_BUENA);
  });

  // El del motor es corto y Camila lo manda a propósito en otros casos: ése sí
  // puede escribirlo sin romperlo, y tocarlo sería quitarle una vía de venta.
  it("NO toca el link del motor de reservas", () => {
    const motor = "https://kora-hotel.com/h/hotel-san-luis/reservar?checkin=2026-09-22&checkout=2026-09-23&adults=2";
    const r = conLinkDePago(`Puedes reservar aquí: ${motor}`, "");
    expect(r).toContain(motor);
  });

  it("sin link de pago, el mensaje sale tal cual", () => {
    expect(conLinkDePago("Buenos días, ¿en qué fechas?", "")).toBe("Buenos días, ¿en qué fechas?");
  });

  it("no deja renglones vacíos donde estaba la URL", () => {
    const r = conLinkDePago(`Tu reserva:\n\n${URL_BUENA}\n\n¡Nos vemos!`, URL_BUENA);
    expect(r).not.toMatch(/\n{3,}/);
    expect(r).toContain("¡Nos vemos!");
  });
});

describe("darse cuenta de que la respuesta se cortó", () => {
  it("reconoce el tope de tokens", () => {
    expect(seCorto("max_tokens")).toBe(true);
  });

  it("y no confunde un final normal con un corte", () => {
    for (const s of ["end_turn", "tool_use", "stop_sequence", null, undefined]) {
      expect(seCorto(s as string), String(s)).toBe(false);
    }
  });
});
