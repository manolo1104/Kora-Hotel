// El pre check-in del huésped: la puerta pública y lo que se guarda.
//
// POR QUÉ IMPORTA MÁS QUE OTRAS PRUEBAS: es la primera pantalla de Kora que
// abre alguien SIN cuenta y que escribe datos personales —domicilio, firma,
// acompañantes— en la base. Todo lo que aquí se afloje se afloja para cualquiera
// con un enlace.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { apellidoCoincide, normalizarNombre } from "@/lib/booking/apellido";

describe("el apellido del QR del mostrador", () => {
  it("acepta el apellido tal cual", () => {
    expect(apellidoCoincide("Manuel Gonzales Ruiz", "Gonzales")).toBe(true);
  });

  it("tolera acentos y mayúsculas: el huésped teclea con una mano", () => {
    expect(apellidoCoincide("José Peña Álvarez", "peña")).toBe(true);
    expect(apellidoCoincide("José Peña Álvarez", "PENA")).toBe(true);
    expect(apellidoCoincide("José Peña Álvarez", "  Álvarez ")).toBe(true);
  });

  it("acepta cualquiera de los dos apellidos", () => {
    expect(apellidoCoincide("Ana Ruiz Mendoza", "Mendoza")).toBe(true);
    expect(apellidoCoincide("Ana Ruiz Mendoza", "Ruiz")).toBe(true);
  });

  it("🔴 NO acepta fragmentos: 'Ana' no abre la reserva de 'Anacleto'", () => {
    // Con un `includes` de cadena esto pasaría, y sería una puerta abierta.
    expect(apellidoCoincide("Anacleto Ruiz", "Ana")).toBe(false);
    expect(apellidoCoincide("Gonzales", "Gonza")).toBe(false);
  });

  it("no acepta una letra suelta ni el vacío", () => {
    expect(apellidoCoincide("Ana Ruiz", "a")).toBe(false);
    expect(apellidoCoincide("Ana Ruiz", "")).toBe(false);
    expect(apellidoCoincide("Ana Ruiz", "   ")).toBe(false);
  });

  it("no revienta con un nombre vacío en la reserva", () => {
    expect(apellidoCoincide("", "Ruiz")).toBe(false);
  });

  it("normalizarNombre quita acentos y colapsa espacios", () => {
    expect(normalizarNombre("  José   PEÑA  ")).toBe("jose pena");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Las defensas de la ruta pública. Se comprueban sobre el archivo porque es
// código de servidor con Supabase detrás: lo que importa aquí es que las cuatro
// piezas ESTÉN y en el orden correcto, no simular Postgres.
// ─────────────────────────────────────────────────────────────────────────────

const ruta = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("la ruta que guarda el registro", () => {
  const src = ruta("app/api/h/[slug]/pre-checkin/route.ts");

  it("limita por IP ANTES de tocar la base", () => {
    // Si el limitador va después, cada intento a ciegas ya costó una consulta.
    expect(src.indexOf("limitado(")).toBeLessThan(src.indexOf("resolveHotel("));
  });

  it("ata la reserva al hotel: `getBooking(hotel.id, ...)`", () => {
    // Sin el hotel.id, un uuid de OTRO hotel entraría por aquí.
    expect(src).toMatch(/getBooking\(hotel\.id,/);
  });

  it("valida el cuerpo con zod antes de escribir nada", () => {
    expect(src.indexOf("leerCuerpo(req, CUERPO)")).toBeLessThan(src.indexOf("guardarPreCheckin("));
  });

  it("pone tope a la firma (una imagen no puede colarse por ese campo)", () => {
    expect(src).toMatch(/FIRMA_MAX\s*=\s*300_000/);
    // En el fuente la barra va escapada dentro del regex del `refine`.
    expect(src).toMatch(/data:image\\?\/png;base64,/);
  });

  it("🔴 NO acepta ninguna foto de identificación: sólo tipo y últimos dígitos", () => {
    // Es una decisión de producto, no un pendiente: si esto cambia, hay que
    // volver a mirar el aviso de privacidad y el modelo de enlace.
    expect(src).not.toMatch(/documentoImagen|documentoFoto|identificacionUrl/);
    // Sin la bandera `s` (dotAll): el target de tsc del repo no la admite.
    expect(src).toMatch(/documentoRef:[^\n]*max\(8\)/);
  });

  it("exige el aviso de privacidad para guardar", () => {
    expect(src).toMatch(/aceptaPrivacidad/);
    expect(src).toMatch(/Hace falta aceptar el aviso de privacidad/);
  });
});

describe("la ruta que busca por folio + apellido", () => {
  const src = ruta("app/api/h/[slug]/pre-checkin/buscar/route.ts");

  it("limita por IP más fuerte que el formulario: es la que se puede adivinar", () => {
    expect(src).toMatch(/max:\s*8/);
  });

  it("busca sólo dentro de ESTE hotel", () => {
    expect(src).toMatch(/\.eq\("hotel_id", hotel\.id\)/);
  });

  it("🔴 un ÚNICO mensaje para todos los fallos: si no, es un oráculo de folios", () => {
    // "El folio existe pero el apellido no coincide" confirmaría que el folio es
    // real. Todos los caminos devuelven la misma respuesta.
    const veces = (src.match(/return noEncontrada;/g) ?? []).length;
    expect(veces).toBeGreaterThanOrEqual(4);
    // Sin los comentarios: la cabecera de ese archivo EXPLICA por qué no debe
    // decirse, y un chivato que se marca a sí mismo con su propia explicación no
    // vigila nada.
    const codigo = src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    expect(codigo).not.toMatch(/apellido (incorrecto|no coincide)/i);
  });
});

describe("la página pública", () => {
  const src = ruta("app/h/[slug]/pre-checkin/page.tsx");

  it("no se indexa: es un registro personal atado a una reserva", () => {
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("🔴 al que ya se registró NO se le devuelven sus datos", () => {
    // Quien tenga el enlace podría leerlos. Se confirma el hecho y se ofrece
    // rehacerlo en blanco: `tienePreCheckin` devuelve un booleano, no la ficha.
    expect(src).toMatch(/tienePreCheckin\(/);
    expect(src).not.toMatch(/getPreCheckin\(/);
  });

  it("un solo mensaje para enlace inválido, cancelada o caducada", () => {
    expect((src.match(/return enlaceMuerto;/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("la tabla", () => {
  const sql = ruta("sql/kora-pre-checkin.sql");

  it("está CERRADA: RLS activo, cero políticas y revoke a las llaves públicas", () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.pre_checkins from anon, authenticated/);
    expect(sql).not.toMatch(/create policy/);
  });

  it("es idempotente: correrla ES la comprobación", () => {
    expect(sql).toMatch(/create table if not exists/);
    expect(sql).toMatch(/create index if not exists/);
  });

  it("un registro por reserva, y se borra con ella", () => {
    expect(sql).toMatch(/booking_id\s+uuid not null unique references public\.bookings\(id\) on delete cascade/);
  });

  it("no tiene ninguna columna para guardar imágenes de identificación", () => {
    expect(sql).not.toMatch(/documento_imagen|documento_url|identificacion_url/);
  });
});
