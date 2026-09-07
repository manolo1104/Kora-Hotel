// Hablarle al runtime de Camila (el servicio de Railway que tiene las sesiones
// de WhatsApp abiertas).
//
// Hasta ahora la conversación era de un solo sentido: el runtime le pedía cosas
// a Kora (`/api/agent`) y Kora sólo le leía el estado (`/estado`, desde
// `bot-qr` y `bot-status`). Para contestar un WhatsApp desde el panel hace falta
// el sentido contrario, y ese camino no existía en todo el proyecto.
//
// Lo importante de este archivo es lo que NO hace: no finge. Si no hay servicio
// configurado, si tarda, o si el hotel no tiene su sesión levantada, lo dice con
// un motivo — nunca devuelve «enviado». Un panel que dice que mandó un mensaje
// que nadie recibió es peor que uno que no deja mandarlo.
//
// SOLO servidor.

/** Lo que puede salir mal, ya traducido a algo que el hotelero entiende. */
export type FalloRuntime =
  | "sin-servicio" // no hay CAMILA_RUNTIME_URL / BOT_FLEET_SECRET en el entorno
  | "hotel-sin-sesion" // el runtime no tiene WhatsApp conectado para este hotel
  | "sin-respuesta" // timeout o red
  | "rechazado"; // el runtime contestó que no

export type ResultadoRuntime<T> = { ok: true; datos: T } | { ok: false; fallo: FalloRuntime; detalle?: string };

const TIMEOUT_MS = 8_000;

export function runtimeConfigurado(): boolean {
  return Boolean(process.env.CAMILA_RUNTIME_URL && process.env.BOT_FLEET_SECRET);
}

/**
 * Un POST al runtime, con el secreto de flota y un tope de espera.
 *
 * 8 segundos y no 3: aquí no se está leyendo un estado cacheado, se está
 * mandando un mensaje de WhatsApp por un Chromium remoto. Cortar a los 3 s
 * dejaría al hotelero viendo un error mientras el mensaje SÍ sale, que es la
 * peor de las dos mentiras posibles.
 */
export async function postAlRuntime<T = unknown>(
  ruta: string,
  cuerpo: Record<string, unknown>,
): Promise<ResultadoRuntime<T>> {
  const base = process.env.CAMILA_RUNTIME_URL;
  const secreto = process.env.BOT_FLEET_SECRET;
  if (!base || !secreto) return { ok: false, fallo: "sin-servicio" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secreto}`, "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: controller.signal,
      cache: "no-store",
    });
    const datos = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.status === 409) return { ok: false, fallo: "hotel-sin-sesion" };
    if (!res.ok) return { ok: false, fallo: "rechazado", detalle: String(datos?.error ?? res.status) };
    return { ok: true, datos };
  } catch {
    // Timeout o red. NO se distingue de «no salió»: por eso quien llama tiene
    // que decírselo al hotelero como una duda, no como un fallo.
    return { ok: false, fallo: "sin-respuesta" };
  } finally {
    clearTimeout(timeout);
  }
}

/** El texto que ve el hotelero para cada fallo. */
export const MENSAJE_FALLO: Record<FalloRuntime, string> = {
  "sin-servicio": "El servicio de WhatsApp no está configurado. Avísale a Kora.",
  "hotel-sin-sesion":
    "Camila no tiene tu WhatsApp conectado ahora mismo. Ve al paso «Conecta tu WhatsApp» y vuelve a intentarlo.",
  "sin-respuesta":
    "No obtuve respuesta del servicio de WhatsApp. Revisa la conversación en tu teléfono antes de reenviarlo: puede que sí haya salido.",
  rechazado: "El servicio de WhatsApp rechazó el mensaje. Inténtalo de nuevo en un momento.",
};
