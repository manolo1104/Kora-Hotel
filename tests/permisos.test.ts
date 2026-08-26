// La matriz de permisos: quién puede hacer qué en el panel de un hotel.
//
// Kora vende una sola cosa: que el hotel de cada quien sea suyo. Estos casos son
// los que hacen que se pueda invitar personal sin regalarles el dinero, y están
// escritos como preguntas que un hotelero haría en voz alta.
import { describe, it, expect } from "vitest";
import { puede, PERMISOS, type Permiso } from "@/lib/panel/permisos";
import type { RolHotel } from "@/lib/tenant";

const ROLES: RolHotel[] = ["dueno", "encargada", "recepcion", "limpieza", "cocina"];

describe("el dueño puede todo", () => {
  it("no hay ni un permiso que le falte", () => {
    const sinDueno = (Object.keys(PERMISOS) as Permiso[]).filter((p) => !puede("dueno", p));
    expect(sinDueno).toEqual([]);
  });
});

describe("el dinero y la identidad son SÓLO del dueño", () => {
  const soloDueno: Permiso[] = [
    "pagos:ver", // el Express Dashboard de Stripe, donde se cambia la cuenta bancaria
    "pagos:conectar",
    "bot:configurar", // la CLABE que Camila le dicta a los huéspedes
    "bot:vincular", // el QR de WhatsApp y el token del bot
    "hotel:eliminar",
  ];
  for (const p of soloDueno) {
    it(`nadie más que el dueño tiene "${p}"`, () => {
      for (const rol of ROLES) {
        expect(puede(rol, p), `${rol} no debería tener ${p}`).toBe(rol === "dueno");
      }
    });
  }
});

describe("las preguntas que haría un hotelero", () => {
  it("¿puede la recepción cancelar una reserva? NO", () =>
    expect(puede("recepcion", "reservas:cancelar")).toBe(false));
  it("...pero sí crearlas y editarlas", () =>
    expect(puede("recepcion", "reservas:escribir")).toBe(true));
  it("¿puede la cocina ver el calendario? SÍ, leer", () =>
    expect(puede("cocina", "reservas:leer")).toBe(true));
  it("¿puede la cocina tocarlo? NO", () =>
    expect(puede("cocina", "calendario:escribir")).toBe(false));
  it("¿puede la camarista marcar un cuarto como limpio? SÍ", () =>
    expect(puede("limpieza", "operaciones:escribir")).toBe(true));
  it("¿puede la camarista cancelar una reserva? NO (antes SÍ podía)", () =>
    expect(puede("limpieza", "reservas:cancelar")).toBe(false));
  it("¿puede la encargada afinar cómo responde Camila? SÍ", () =>
    expect(puede("encargada", "bot:entrenar")).toBe(true));
  it("¿puede la encargada cambiar la CLABE del bot? NO", () =>
    expect(puede("encargada", "bot:configurar")).toBe(false));
  it("¿puede la recepción ver los canales de Booking? NO", () =>
    expect(puede("recepcion", "canales:leer")).toBe(false));
});

describe("invariantes de la matriz", () => {
  it("ningún permiso se queda sin nadie que lo tenga", () => {
    for (const [p, roles] of Object.entries(PERMISOS)) {
      expect(roles.length, `${p} no lo tiene nadie`).toBeGreaterThan(0);
    }
  });

  it("todos los roles de la matriz existen de verdad", () => {
    for (const [p, roles] of Object.entries(PERMISOS)) {
      for (const r of roles) expect(ROLES, `${p} tiene un rol inventado`).toContain(r);
    }
  });

  // Si alguien puede escribir en un área, tiene que poder leerla: lo contrario
  // es una pantalla que guarda cambios que su propio autor no puede ver.
  it("quien escribe también puede leer", () => {
    const pares: [Permiso, Permiso][] = [
      ["cotizaciones:escribir", "cotizaciones:leer"],
      ["clientes:escribir", "clientes:leer"],
      ["operaciones:escribir", "operaciones:leer"],
      ["canales:escribir", "canales:leer"],
      ["sitio:editar", "sitio:leer"],
      ["reservas:escribir", "reservas:leer"],
      ["reservas:cancelar", "reservas:leer"],
    ];
    for (const [escribir, leer] of pares) {
      for (const rol of ROLES) {
        if (puede(rol, escribir)) {
          expect(puede(rol, leer), `${rol} escribe ${escribir} pero no puede ${leer}`).toBe(true);
        }
      }
    }
  });
});
