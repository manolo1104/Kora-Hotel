// Hosts a los que se permite SEGUIR una redirección.
//
// Antes el fetch iba con `redirect: "follow"`, y eso era una puerta abierta:
// `goo.gl` es un ACORTADOR — quien crea el link decide a dónde apunta. Bastaba
// con pegar en el panel un goo.gl que redirigiera a `http://169.254.169.254/`
// (los metadatos de la nube) o a `http://localhost:…` para que fuera NUESTRO
// servidor quien lo pidiera, desde dentro de la red, y contarnos si respondía.
//
// Ahora la redirección se sigue a mano y cada salto tiene que caer en un dominio
// de Google. Un link que apunte a otro sitio se queda sin expandir, que es
// exactamente lo que ya pasa con los que llevan a la página de consentimiento.
const HOSTS_SEGUIBLES = [
  "goo.gl", "g.co", "google.com", "google.com.mx", "google.es", "googleusercontent.com",
];
export const MAX_SALTOS = 5;

export function saltoPermitido(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return HOSTS_SEGUIBLES.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
