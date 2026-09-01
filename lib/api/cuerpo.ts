// Leer y validar el cuerpo de una petición, en una línea.
//
// Las 45 rutas de escritura del panel repetían —cuando lo hacían— este bloque:
//
//     let body; try { body = await req.json(); } catch { return 400 }
//     if (!body.algo || typeof body.algo !== "string") return 400
//     const notas = typeof body.notas === "string" ? body.notas : ""
//
// Con ese patrón, 27 de ellas acabaron SIN NINGUNA validación (A17.1): unas
// porque nadie se acordó, otras porque el `catch` sólo cubría el JSON roto y no
// la forma. `app/api/admin/clientes` mandaba `email` y `notas` a la base sin
// mirarlos siquiera, así que un objeto o un array llegaba tal cual.
//
// Aquí el esquema es la validación Y los tipos: lo que sale de `datos` ya está
// comprobado y tipado, sin castings.

import { NextResponse } from "next/server";
import { z } from "zod";

type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; respuesta: NextResponse };

/**
 * Lee el JSON del cuerpo y lo valida contra `esquema`.
 *
 *     const c = await leerCuerpo(req, ESQUEMA);
 *     if (!c.ok) return c.respuesta;
 *     const { email, notas } = c.datos;
 *
 * El 400 NO dice qué campo falló: quien llama a esta ruta es nuestro propio
 * panel, así que un fallo aquí es un error de programación, y el detalle sólo
 * le serviría a quien esté probando qué acepta la API. Va al log del servidor.
 */
export async function leerCuerpo<E extends z.ZodType>(
  req: Request,
  esquema: E,
): Promise<Resultado<z.infer<E>>> {
  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return {
      ok: false,
      respuesta: NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }),
    };
  }

  const r = esquema.safeParse(crudo);
  if (!r.success) {
    console.warn("[cuerpo] no validó:", r.error.issues.map((i) => `${i.path.join(".")}: ${i.code}`).join(", "));
    return {
      ok: false,
      respuesta: NextResponse.json({ error: "Datos inválidos." }, { status: 400 }),
    };
  }
  return { ok: true, datos: r.data };
}

// ─── Piezas que se repiten ────────────────────────────────────────────────────
//
// Los topes NO son decorativos: sin ellos, una nota de 40 MB entra en la base y
// sale luego en cada listado, en cada correo y en el Excel que el hotelero se
// descarga.

/** Texto libre corto (un nombre, un título). */
export const zTextoCorto = z.string().trim().min(1).max(200);

/** Texto libre largo (notas, descripciones). Vacío permitido. */
export const zTextoLargo = z.string().max(5_000);

/** Correo. `.email()` de zod ya rechaza lo que no lo parece. */
export const zEmail = z.string().trim().email().max(320);

/** Identificador de una fila (uuid o el id corto de una cotización). */
export const zId = z.string().trim().min(1).max(100);

/** Fecha en el formato que usa toda la base: `YYYY-MM-DD`. */
export const zFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "formato de fecha esperado: YYYY-MM-DD");
