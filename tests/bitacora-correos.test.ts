// La bitácora de correos que no salieron. Paso 7.6 de la auditoría.
//
// `enviarEmail` nunca lanza a propósito —una reserva no se cae porque el correo
// falle— pero el fallo moría en un console.error que nadie lee: el huésped se
// quedaba sin su confirmación y nadie se enteraba hasta que reclamaba.
//
// Lo que se prueba aquí es lo que evita el daño CONTRARIO: que el reintento le
// mande la confirmación dos veces al mismo huésped.
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Fila {
  id: string;
  estado: string;
  intentos: number;
  resend_id: string | null;
  email_type: string;
}

let tabla: Fila[] = [];
let ultimoUpsert: Record<string, unknown> = {};
let ultimoUpdate: Record<string, unknown> = {};
let filtros: Record<string, unknown> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fake(): any {
  filtros = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    upsert(fila: Record<string, unknown>) { ultimoUpsert = fila; return Promise.resolve({ error: null }); },
    update(patch: Record<string, unknown>) { ultimoUpdate = patch; b._op = "update"; return b; },
    select() { b._op = b._op ?? "select"; return b; },
    eq(col: string, val: unknown) { filtros[col] = val; return b; },
    lt(col: string, val: unknown) { filtros[`lt_${col}`] = val; return b; },
    is(col: string, val: unknown) { filtros[`is_${col}`] = val; return b; },
    limit() { return b; },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then(res: (v: unknown) => any) {
      if (b._op === "update") return res({ data: null, error: null });
      const out = tabla.filter(
        (f) =>
          (filtros.estado === undefined || f.estado === filtros.estado) &&
          (filtros.lt_intentos === undefined || f.intentos < Number(filtros.lt_intentos)) &&
          (filtros.is_resend_id === undefined || f.resend_id === filtros.is_resend_id),
      );
      return res({ data: out, error: null });
    },
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  adminEnvReady: true,
  createAdminClient: () => ({ from: () => fake() }),
}));

const { registrarCorreo, correosFallidos, anotarReintento, MAX_INTENTOS } =
  await import("@/lib/email/bitacora");

beforeEach(() => {
  tabla = [];
  ultimoUpsert = {};
  ultimoUpdate = {};
});

describe("registrarCorreo", () => {
  it("un envío que salió queda como enviado, con su id de Resend", async () => {
    await registrarCorreo({
      hotelId: "h1", confirmacion: "KORA-1", tipo: "confirmacion_reserva",
      destino: "a@b.test", resultado: { ok: true, id: "re_123" },
    });
    expect(ultimoUpsert).toMatchObject({ estado: "enviado", resend_id: "re_123", ultimo_error: null });
  });

  it("uno que falló queda como fallido, con el motivo", async () => {
    await registrarCorreo({
      hotelId: "h1", confirmacion: "KORA-1", tipo: "confirmacion_reserva",
      destino: "a@b.test", resultado: { ok: false, error: "dominio no verificado" },
    });
    expect(ultimoUpsert).toMatchObject({ estado: "fallido", ultimo_error: "dominio no verificado" });
    expect(ultimoUpsert.resend_id).toBeNull();
  });
});

describe("a quién se le reintenta", () => {
  it("sólo a los fallidos que aún tienen intentos", async () => {
    tabla = [
      { id: "1", estado: "fallido", intentos: 1, resend_id: null, email_type: "confirmacion_reserva" },
      { id: "2", estado: "enviado", intentos: 1, resend_id: "re_x", email_type: "confirmacion_reserva" },
      { id: "3", estado: "fallido", intentos: MAX_INTENTOS, resend_id: null, email_type: "confirmacion_reserva" },
    ];
    const out = await correosFallidos();
    expect(out.map((f) => f.id)).toEqual(["1"]);
  });

  // LA REGRESIÓN QUE IMPORTA: con `resend_id` el correo LLEGÓ a Resend y pudo
  // haber salido (el fallo fue leyendo la respuesta). Reintentarlo le manda dos
  // confirmaciones al mismo huésped, que es peor que la que no llegó.
  it("NO reintenta lo que ya había llegado a Resend", async () => {
    tabla = [
      { id: "4", estado: "fallido", intentos: 1, resend_id: "re_dudoso", email_type: "confirmacion_reserva" },
    ];
    expect(await correosFallidos()).toHaveLength(0);
  });
});

describe("anotarReintento", () => {
  const fila = { id: "1", hotel_id: "h1", confirmacion: "KORA-1", email_type: "confirmacion_reserva", email_destino: "a@b.test", intentos: 1, ultimo_error: "x" };

  it("si salió, se cierra como enviado", async () => {
    await anotarReintento(fila, { ok: true, id: "re_ok" });
    expect(ultimoUpdate).toMatchObject({ estado: "enviado", intentos: 2, resend_id: "re_ok" });
  });

  it("si vuelve a fallar, sigue fallido y sube el contador", async () => {
    await anotarReintento(fila, { ok: false, error: "otra vez" });
    expect(ultimoUpdate).toMatchObject({ estado: "fallido", intentos: 2, ultimo_error: "otra vez" });
  });

  // Sin esto, un correo a un dominio que no existe se reintenta cada día para
  // siempre y ensucia el digest hasta que alguien lo borra a mano.
  it("al último intento se da por agotado y deja de reintentarse", async () => {
    await anotarReintento({ ...fila, intentos: MAX_INTENTOS - 1 }, { ok: false, error: "no existe" });
    expect(ultimoUpdate).toMatchObject({ estado: "agotado", intentos: MAX_INTENTOS });
  });
});
