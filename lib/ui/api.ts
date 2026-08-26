// Llamadas al API desde el NAVEGADOR. Seguro para componentes cliente: no
// importa nada de servidor.
//
// De nada sirve que la API responda 500 si el panel pinta el ✓ igual. Hay 79
// `await fetch(` en `app/` y `components/` y sólo ~21 miran `res.ok`; el resto
// entra al `try`, no lanza (fetch sólo lanza si la RED falla, no ante un 4xx o
// 5xx) y llega al `setSaved(true)` como si nada. El hotelero ve "guardado",
// cierra el modal, y descubre que no se guardó cuando recarga la página.
//
// `postJson` LANZA en los dos casos, así que cualquier `try` que no capture deja
// de marcar éxito solo. Es el mismo principio que `lib/db/result.ts`, en el
// navegador: lo seguro es lo que sale sin esfuerzo.

/** Error de una llamada al API. `status` 0 = ni siquiera hubo respuesta. */
export class ApiError extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ApiError";
  }
}

/**
 * POST/PATCH/DELETE con JSON. LANZA si la red falla o si el servidor no
 * respondió 2xx. Nunca devuelve "éxito" por defecto.
 *
 * El mensaje que trae el error ya está redactado para enseñárselo al usuario:
 * viene del `{ error: "..." }` de la ruta, o de un texto por defecto.
 *
 * Regla al usarla: todo `try` debe llevar
 *   `catch (e) { setError(e instanceof ApiError ? e.message : "Error inesperado."); }`
 * y `finally { setGuardando(false); }` — si no, un fallo deja el botón girando.
 */
export async function postJson<T = unknown>(
  url: string,
  body?: unknown,
  metodo: "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Sin conexión. Revisa tu internet e intenta de nuevo.");
  }

  const texto = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  } catch {
    /* respuesta no-JSON (una página de error de Vercel, por ejemplo) */
  }

  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? "No se pudo guardar. Intenta de nuevo."));
  }
  return data as T;
}

/** GET con JSON, con las mismas reglas. Para pantallas que hoy se vacían solas. */
export async function getJson<T = unknown>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiError(0, "Sin conexión. Revisa tu internet e intenta de nuevo.");
  }
  const texto = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  } catch {
    /* respuesta no-JSON */
  }
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? "No se pudo cargar. Intenta de nuevo."));
  }
  return data as T;
}

/** El mensaje que se le enseña al usuario a partir de cualquier excepción. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Error inesperado. Intenta de nuevo.";
}
