// ¿A dónde puede mandar un `?next=` después de iniciar sesión?
//
// El parámetro lo escribe quien manda el enlace, no nosotros. Si acepta un
// destino externo, se convierte en un open-redirect: un correo con
//
//     https://kora-hotel.com/entrar?next=//sitio-del-atacante/entrar
//
// sale de NUESTRO dominio —el que el hotelero reconoce y en el que confía— y
// aterriza en una copia del formulario de acceso. Es la forma más barata de
// robar una contraseña, porque el enlace es genuinamente nuestro.
//
// Había DOS comprobaciones para la misma regla, y no decían lo mismo:
// `app/entrar/page.tsx` rechazaba `//` y `/\`, y `app/auth/callback/route.ts`
// —el que recibe el enlace mágico del correo— sólo rechazaba `//`. Un
// `next=/\sitio-del-atacante` pasaba por ahí, y varios navegadores lo tratan
// igual que `//`.
//
// Ahora hay una sola, y no compara prefijos a mano: deja que el PARSER DE URL
// haga la normalización, que es exactamente la que hará el navegador. Así no hay
// que ir adivinando trucos (`/%09/`, `/%2F%2F`, un tabulador en medio…).

/** Origen imposible: sólo sirve para resolver la ruta relativa. */
const BASE = "https://destino.invalid";

/**
 * Devuelve el destino si es una ruta INTERNA; `null` si apunta fuera.
 *
 * Lo que devuelve está ya normalizado (`pathname + search + hash`), así que se
 * puede pegar detrás del origen sin volver a mirarlo.
 */
export function destinoSeguro(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null;
  // Un destino de 2 KB no es un destino: es alguien probando.
  if (v.length > 512) return null;
  // Tiene que ser una ruta, no una URL absoluta ni un esquema.
  if (!v.startsWith("/")) return null;

  try {
    const u = new URL(v, BASE);
    // Si al resolverla cambió de origen, es que apuntaba fuera: eso pasa con
    // `//otro.com`, con `/\otro.com` y con las variantes codificadas.
    if (u.origin !== BASE) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}
