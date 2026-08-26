// El borde HTTP de la red de `lib/db/result.ts`. SOLO servidor.
//
// Convierte cualquier excepción de una ruta en una respuesta honesta: 500 con un
// mensaje que el hotelero puede leer, y el detalle técnico SÓLO en el log del
// servidor. Hoy 14 rutas hacen `NextResponse.json({ error: e.message })`, que le
// enseña al navegador el texto crudo de Postgres (nombres de tabla, columnas y
// restricciones incluidos).
import { NextResponse } from "next/server";
import { DbError } from "@/lib/db/result";

/**
 * Envuelve el cuerpo de una ruta. Si algo lanza, responde 500 en vez de dejar
 * que Next devuelva una página de error sin forma.
 *
 * El truco está en combinarlo con `escribir()`: la ruta ya no tiene que
 * acordarse de comprobar nada — sólo llega al `return { ok: true }` si de
 * verdad guardó.
 */
export async function rutaSegura(
  etiqueta: string,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[ruta:${etiqueta}]`, e);
    return NextResponse.json(
      {
        error:
          e instanceof DbError
            ? "No se pudo guardar. Intenta de nuevo."
            : "Error interno. Intenta de nuevo en un momento.",
      },
      { status: 500 },
    );
  }
}
