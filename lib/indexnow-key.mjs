// Fuente única de la llave de IndexNow.
//
// Estaba escrita a mano en DOS archivos (`lib/indexnow.ts` y
// `scripts/indexnow.mjs`). No es un secreto —IndexNow exige justo lo contrario:
// que la llave esté publicada en `https://<dominio>/<LLAVE>.txt` para demostrar
// que el dominio es tuyo— pero sí es un dato que tiene que coincidir en TRES
// sitios: los dos módulos y el nombre del archivo en `public/`.
//
// Si se cambia aquí, hay que renombrar `public/<LLAVE>.txt` a la vez. La prueba
// `tests/indexnow-llave.test.ts` falla si dejan de coincidir, que es la única
// forma de que no se descubra el día que Bing deja de indexar en silencio.
//
// Va en .mjs (no .ts) porque `scripts/indexnow.mjs` es un script de Node suelto
// y no puede importar TypeScript; `allowJs` está activo, así que el lado TS lo
// importa igual.
export const INDEXNOW_KEY = "a40e702ec65b92696674e8c3a8b1223a";
