// Límite de intentos por IP, en memoria del proceso.
//
// Había CINCO copias de estas quince líneas —leads, crm/login, soporte,
// suscribir, agent-demo— y cada ruta nueva añadía la sexta. Es el mismo patrón
// que hizo que `notas` acabara con cinco parsers y tres rotos: veinte líneas
// copiadas no divergen porque alguien se equivoque, sino porque el día que hay
// que cambiarlas hay que acordarse de las cinco.
//
// ⚠️ LO QUE ESTO **NO** ES: un limitador compartido. El contador vive en la
// memoria de UNA instancia, y Vercel levanta varias. Sirve contra el doble clic,
// el script tonto y el reintento en bucle —que es contra lo que se puso— pero un
// atacante que reparta sus peticiones entre instancias lo esquiva. El limitador
// de verdad (por IP, compartido) es el paso 9.9 del plan y necesita Redis.

const CUBOS = new Map<string, Map<string, number[]>>();

/**
 * `true` = esta IP ya se pasó y hay que responder 429.
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

/** La IP del que llama, detrás del proxy de Vercel. */
export function ipDe(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "desconocida";
}
