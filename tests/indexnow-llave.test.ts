// La llave de IndexNow tiene que coincidir en TRES sitios: `lib/indexnow.ts`,
// `scripts/indexnow.mjs` y el NOMBRE del archivo publicado en `public/`. Estaba
// escrita a mano en los dos primeros y el tercero no lo comprobaba nadie.
//
// Si dejan de coincidir, IndexNow rechaza los avisos y Bing (y lo que se alimenta
// de Bing, como Copilot) deja de enterarse de las páginas nuevas — en silencio,
// sin error visible en ningún sitio. Por eso esto es una prueba y no un comentario.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { INDEXNOW_KEY } from "@/lib/indexnow-key.mjs";

const raiz = join(__dirname, "..");

describe("la llave de IndexNow es una sola", () => {
  it("el archivo publicado se llama como la llave", () => {
    const ruta = join(raiz, "public", `${INDEXNOW_KEY}.txt`);
    expect(existsSync(ruta), `falta public/${INDEXNOW_KEY}.txt`).toBe(true);
  });

  it("no hay OTRO .txt de llave suelto en public/ (una llave vieja despista)", () => {
    const sueltos = readdirSync(join(raiz, "public"))
      .filter((f) => /^[0-9a-f]{32}\.txt$/.test(f))
      .filter((f) => f !== `${INDEXNOW_KEY}.txt`);
    expect(sueltos, `sobran llaves en public/: ${sueltos.join(", ")}`).toEqual([]);
  });

  it("nadie la escribe a mano fuera de lib/indexnow-key.mjs", () => {
    for (const rel of ["lib/indexnow.ts", "scripts/indexnow.mjs"]) {
      const src = readFileSync(join(raiz, rel), "utf8");
      const sinComentarios = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      expect(sinComentarios.includes(INDEXNOW_KEY), `${rel} lleva la llave dentro`).toBe(false);
    }
  });
});
