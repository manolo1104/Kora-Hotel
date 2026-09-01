// Límite de intentos por IP.
//
// Había CINCO copias de estas quince líneas —leads, crm/login, soporte,
// suscribir, agent-demo— y cada ruta nueva añadía la sexta. Es el mismo patrón
// que hizo que `notas` acabara con cinco parsers y tres rotos: veinte líneas
// copiadas no divergen porque alguien se equivoque, sino porque el día que hay
// que cambiarlas hay que acordarse de las cinco.
//
// Hay DOS limitadores y sirven para cosas distintas:
//
//   • `limitado()`   — el bueno (paso 9.9). El contador vive en Postgres, así
//     que lo comparten TODAS las instancias de Vercel. Es el que deben usar las
//     rutas que protegen algo que importa.
//   • `rateLimited()` — el viejo, en memoria del proceso. Se queda porque es el
//     respaldo cuando la base no contesta y porque no cuesta una ida a la base.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

const CUBOS = new Map<string, Map<string, number[]>>();

/**
 * `true` = esta IP ya se pasó y hay que responder 429.
 *
 * ⚠️ **NO ES UN LIMITADOR COMPARTIDO.** El contador vive en la memoria de UNA
 * instancia y Vercel levanta varias, así que el tope real se multiplica por el
 * número de instancias vivas y quien reparta sus peticiones lo esquiva. Sirve
 * contra el doble clic, el script tonto y el reintento en bucle. Para todo lo
 * demás, `limitado()`.
 *
 * Cada `nombre` lleva su propio contador: que alguien agote los reenvíos de
 * confirmación no puede dejarle sin consultar su reserva.
 */
export function rateLimited(
  nombre: string,
  ip: string,
  opts: { max: number; ventanaMs: number },
): boolean {
  let cubo = CUBOS.get(nombre);
  if (!cubo) {
    cubo = new Map();
    CUBOS.set(nombre, cubo);
  }
  const ahora = Date.now();
  const previos = (cubo.get(ip) || []).filter((t) => ahora - t < opts.ventanaMs);
  previos.push(ahora);
  cubo.set(ip, previos);

  // Poda: sin esto el Map crece con una entrada por IP para siempre, y en una
  // instancia de Vercel que vive horas eso es una fuga de memoria lenta.
  if (cubo.size > 5_000) {
    for (const [k, v] of cubo) {
      if (v.every((t) => ahora - t >= opts.ventanaMs)) cubo.delete(k);
    }
  }

  return previos.length > opts.max;
}

/**
 * `true` = esta IP ya se pasó y hay que responder 429. **Compartido entre
 * instancias** (paso 9.9): el contador vive en Postgres y lo suma la RPC
 * `rl_consumir` de `sql/kora-e9-limitador-ip.sql`.
 *
 * Cuesta una ida a la base (~20-40 ms). Va bien en las rutas que protege
 * —formularios, login, IA— porque son de baja frecuencia y porque lo que hay al
 * otro lado (la contraseña del fundador, la factura de Anthropic, la
 * cancelación de la reserva de alguien) vale mucho más que 40 ms.
 *
 * **Falla hacia el RESPALDO, no hacia abierto ni hacia cerrado.** Si la base no
 * contesta —o si el SQL todavía no se ha corrido— cae al contador en memoria,
 * que es peor pero no es nada. Fallar CERRADO tiraría todos los formularios del
 * sitio con un parpadeo de la base; fallar ABIERTO dejaría el login del CRM sin
 * ninguna protección justo cuando la base está en apuros.
 */
export async function limitado(
  nombre: string,
  ip: string,
  opts: { max: number; ventanaMs: number },
): Promise<boolean> {
  // El contador en memoria se consume SIEMPRE, conteste la base o no: así el
  // respaldo llega con su cuenta al día en vez de empezar de cero justo en el
  // momento en que hace falta.
  const enMemoria = rateLimited(nombre, ip, opts);

  if (!adminEnvReady) return enMemoria;

  try {
    const { data, error } = await createAdminClient().rpc("rl_consumir", {
      p_clave: `${nombre}:${ip}`,
      p_max: opts.max,
      p_ventana_s: Math.max(1, Math.round(opts.ventanaMs / 1000)),
    });
    if (error) {
      // `42883` = la función no existe: el SQL aún no se ha corrido. No es una
      // avería, es el estado de antes de aplicarlo, y no merece una línea de
      // error cada vez que alguien manda un formulario.
      if (error.code !== "42883") {
        console.error("[rate-limit] rl_consumir:", error.code, error.message);
      }
      return enMemoria;
    }
    return data === true;
  } catch (e) {
    console.error("[rate-limit] rl_consumir:", e instanceof Error ? e.message : e);
    return enMemoria;
  }
}

/**
 * Borra los contadores cuya ventana lleva más de un día cerrada. Lo llama el
 * cron diario: sin esto la tabla guarda una fila por cada IP que haya visitado
 * el sitio, para siempre. Devuelve cuántas borró, o `null` si no pudo.
 */
export async function limpiarLimitador(): Promise<number | null> {
  if (!adminEnvReady) return null;
  try {
    const { data, error } = await createAdminClient().rpc("rl_limpiar");
    if (error) {
      if (error.code !== "42883") {
        console.error("[rate-limit] rl_limpiar:", error.code, error.message);
      }
      return null;
    }
    return typeof data === "number" ? data : null;
  } catch (e) {
    console.error("[rate-limit] rl_limpiar:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** La IP del que llama, detrás del proxy de Vercel. */
export function ipDe(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "desconocida"
  );
}
