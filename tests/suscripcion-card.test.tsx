// La barra de suscripción del panel. Quien CANCELÓ caía en el bloque de
// "Prueba gratis" —copy falso, y encima le quitaba el botón del portal de
// Stripe, que es su única vía para bajar sus recibos o volver a activar—.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SuscripcionCard } from "@/components/panel/SuscripcionCard";

const pinta = (p: Parameters<typeof SuscripcionCard>[0]) =>
  renderToStaticMarkup(<SuscripcionCard {...p} />);

describe("quien nunca tuvo plan", () => {
  const html = pinta({ plan: null, estado: null, esStripe: false });
  it("ve la invitación de prueba gratis", () => expect(html).toContain("Prueba gratis"));
  it("y el botón de activar", () => expect(html).toContain("Activar mi plan"));
});

describe("quien CANCELÓ (el caso roto)", () => {
  const html = pinta({ plan: "kora", estado: "cancelada", esStripe: true });
  it("ya NO se le habla de prueba gratis", () => expect(html).not.toContain("Prueba gratis"));
  it("ve que está cancelada", () => expect(html).toContain("Cancelada"));
  it("conserva el acceso a sus recibos", () => expect(html).toContain("Mis recibos"));
  it("puede volver: se le ofrece activar de nuevo", () => expect(html).toContain("Activar mi plan"));
  it("no se le ofrece cancelar lo ya cancelado", () =>
    expect(html).not.toContain("Cancelar suscripción"));
});

describe("quien PAGA", () => {
  const html = pinta({ plan: "kora", estado: "activa", esStripe: true });
  it("administra su pago", () => expect(html).toContain("Administrar mi pago"));
  it("y cancela en un clic, como promete el sitio", () =>
    expect(html).toContain("Cancelar suscripción"));
  it("sin que se le hable de prueba", () => expect(html).not.toContain("Prueba gratis"));
});

// Sin cliente en Stripe no hay portal que abrir: ahí la invitación sí es lo
// correcto (nunca llegó a pagar).
describe("pago a medias y sin cliente en Stripe", () => {
  const html = pinta({ plan: null, estado: "incompleta", esStripe: false });
  it("vuelve a la invitación", () => expect(html).toContain("Prueba gratis"));
});
