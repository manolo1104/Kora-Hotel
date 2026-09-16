// La guarda de las rutas del CRM que CAMBIAN algo. SOLO servidor.
//
// `requireCrmAuth()` sólo mira la cookie, y con botones que leen eso basta. Con
// botones que regalan saldo, alargan pruebas o callan a Camila, no:
//
//   · La cookie `kora_crm` va con `path: "/"` (lib/crm/auth.ts, `setCrmCookie`),
//     así que el navegador la manda a CUALQUIER ruta del dominio, incluidas las
//     que no son del CRM.
//   · Ese dominio es el mismo que sirve las páginas públicas de los hoteles
//     (`/h/[slug]`), con contenido que escribe cada hotelero, y el mismo al que
//     apuntan los enlaces que circulan por correo y WhatsApp.
//   · El repositorio es PÚBLICO: las rutas y el formato de cada petición se leen
//     en GitHub, no hay que adivinarlos. Montar una petición falsa es copiar.
//
// Lo que cierra esta guarda: que una página de OTRO origen —otro sitio, otro
// subdominio del mismo sitio (a los que `sameSite: "lax"` sí les manda la
// cookie), o un navegador que no respete `sameSite`— dispare un POST contra
// `/api/crm/*` aprovechando la sesión del fundador. La cabecera `Origin` la pone
// el navegador en todo lo que no sea GET/HEAD y ningún script la puede fijar; si
// no coincide con el host al que va la petición, no se hace nada.
//
// Lo que NO cierra, dicho claro para que nadie lo dé por resuelto: un script que
// corra DENTRO del mismo origen (un XSS en `/h/[slug]`) manda el mismo `Origin`
// que el CRM. Eso sólo lo arregla sacar el CRM a su propio subdominio (o limitar
// la cookie a /crm y /api/crm, que ayuda pero no basta), y las dos cosas cambian
// el login y el despliegue.

import { requireCrmAuth } from "@/lib/crm/auth";

const METODOS_DE_LECTURA = new Set(["GET", "HEAD"]);

/** `host` de una URL, en minúsculas, o null si no se puede leer. */
function hostDe(url: string | null): string | null {
  if (!url || url === "null") return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Los hosts a los que puede ir dirigida esta petición. Los pone la plataforma
 * (Vercel reescribe `host` a su dominio interno y deja el público en
 * `x-forwarded-host`), no la página que la lanza: ningún script del navegador
 * puede fijar `Host`, así que aceptar cualquiera de ellos no abre nada.
 */
function hostsDestino(req: Request): Set<string> {
  const hosts = new Set<string>();
  const reenviado = req.headers.get("x-forwarded-host");
  if (reenviado) {
    for (const h of reenviado.split(",")) {
      const limpio = h.trim().toLowerCase();
      if (limpio) hosts.add(limpio);
    }
  }
  const host = req.headers.get("host")?.trim().toLowerCase();
  if (host) hosts.add(host);
  const deLaUrl = hostDe(req.url);
  if (deLaUrl) hosts.add(deLaUrl);
  return hosts;
}

/**
 * ¿La petición sale de una página de este mismo host? PURA (sólo cabeceras).
 *
 * GET y HEAD pasan siempre: no cambian nada. Para lo demás se mira `Origin` y,
 * sólo si falta, `Referer`. Un `Origin: null` (iframe aislado, redirección
 * opaca) NO cae al Referer: es el navegador diciendo «no te voy a decir de
 * dónde vengo», y eso en una ruta que mueve saldo es un no.
 */
export function origenDeConfianza(req: Request): boolean {
  if (METODOS_DE_LECTURA.has(req.method.toUpperCase())) return true;

  const origin = req.headers.get("origin");
  const origen = origin !== null ? hostDe(origin) : hostDe(req.headers.get("referer"));
  if (!origen) return false;

  return hostsDestino(req).has(origen);
}

/**
 * Para route handlers del CRM que escriben: devuelve null si todo está bien, o
 * la Response que hay que devolver tal cual (401 sin sesión, 403 si la petición
 * no sale del propio CRM).
 *
 *     const no = await requireCrmMutacion(req);
 *     if (no) return no;
 */
export async function requireCrmMutacion(req: Request): Promise<Response | null> {
  const sinSesion = await requireCrmAuth();
  if (sinSesion) return sinSesion;

  if (!origenDeConfianza(req)) {
    console.warn(
      `[crm] petición ${req.method} rechazada: no sale del CRM ` +
        `(origin=${req.headers.get("origin") ?? "—"}, referer=${req.headers.get("referer") ?? "—"}).`,
    );
    return new Response(
      JSON.stringify({ error: "Por seguridad, esta acción sólo se puede hacer desde la pantalla del CRM. Recarga la página e inténtalo de nuevo." }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }
  return null;
}
