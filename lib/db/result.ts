// La red que hace imposible perder una escritura en silencio. SOLO servidor.
//
// supabase-js NUNCA lanza: pase lo que pase devuelve `{ data, error }`. Si nadie
// mira `error`, el fallo desaparece — y ese es, medido, el bug más repetido de
// este repo: 45 lecturas que desestructuran sólo `{ data }` (una consulta rota es
// indistinguible de "no hay filas") y 22 escrituras que terminan en
// `if (error) console.error(...)` mientras la ruta responde `{ok:true}`.
//
// La idea de fondo: **lanzar es el default**. Un `Promise<void>` que lanza no
// obliga a cambiar ninguna firma ni a que el llamador se acuerde de mirar nada,
// así que lo seguro es lo que sale sin esfuerzo. Y "este fallo no importa" hay
// que escribirlo a mano (`escribirMejorEsfuerzo`), lo que lo vuelve una decisión
// declarada y greppable en vez de un descuido.
//
// Por qué no `Promise<{ok, error}>` (que es lo que proponía la auditoría):
// TypeScript no obliga a leer un valor devuelto. En seis meses alguien escribe
// `await updateQuote(...)` sin mirar y el bug vuelve entero.

/** La forma que devuelve cualquier consulta de supabase-js. */
type Respuesta<T> = {
  data: T | null;
  error: { message: string; code?: string; details?: string | null } | null;
};

/** Error de base de datos. El borde HTTP (`rutaSegura`) lo traduce a un 500. */
export class DbError extends Error {
  constructor(
    public etiqueta: string,
    public detalle: string,
    public code?: string,
  ) {
    super(`[db:${etiqueta}] ${detalle}`);
    this.name = "DbError";
  }
}

/**
 * LECTURA. Devuelve los datos; si la consulta falla, LANZA.
 *
 * Nunca confunde "hubo un error" (lanza) con "no hay filas" (`null` / `[]`).
 * Esa confusión es la que hoy hace que un parpadeo de Supabase se vea como un
 * hotel sin reservas, un usuario sin permisos o un cuarto disponible.
 */
export async function leer<T>(etiqueta: string, q: PromiseLike<Respuesta<T>>): Promise<T | null> {
  const { data, error } = await q;
  if (error) throw new DbError(etiqueta, error.message, error.code);
  return data ?? null;
}

/**
 * ESCRITURA. Si falla, LANZA. Es el default A PROPÓSITO: perder una escritura
 * en silencio (una reserva editada que no se guardó, un cobro que no quedó
 * registrado) es el fallo más caro que puede tener esta plataforma.
 */
export async function escribir(etiqueta: string, q: PromiseLike<Respuesta<unknown>>): Promise<void> {
  const { error } = await q;
  if (error) throw new DbError(etiqueta, error.message, error.code);
}

/**
 * ESCRITURA que de verdad puede fallar sin consecuencias: marcas de "ya avisé",
 * telemetría, contadores. No lanza, pero deja rastro y dice si funcionó.
 *
 * Usarla es DECLARAR POR ESCRITO que este fallo concreto no importa. Si algún
 * día importa, `grep escribirMejorEsfuerzo` los enumera todos.
 */
export async function escribirMejorEsfuerzo(
  etiqueta: string,
  q: PromiseLike<Respuesta<unknown>>,
): Promise<boolean> {
  const { error } = await q;
  if (error) {
    console.error(`[db:${etiqueta}] (mejor-esfuerzo) ${error.message}`);
    return false;
  }
  return true;
}
