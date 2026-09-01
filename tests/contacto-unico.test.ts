// Los datos de contacto de Kora se escribieron a mano en 18 sitios, y en dos
// dominios distintos. Uno de los dos, `korahotel.mx`, NUNCA EXISTIÓ: sin NS,
// sin A y sin MX (comprobado el 1 sep 2026 contra 8.8.8.8 y 1.1.1.1). Los diez
// correos publicados ahí estaban en los Términos, en el Aviso de Privacidad, en
// el pie de página y en el Organization JSON-LD que lee Google.
//
// Esta prueba existe para que no vuelva a haber dos verdades.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { EMAIL_CONTACTO, EMAIL_PRIVACIDAD, EMAIL_RESERVAS, EMAIL_FROM } from "@/lib/contacto";

const raiz = join(__dirname, "..");

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(raiz, dir))) {
    const rel = join(dir, e);
    if (e === "node_modules" || e.startsWith(".")) continue;
    if (statSync(join(raiz, rel)).isDirectory()) fuentes(rel, acc);
    else if (/\.tsx?$/.test(e)) acc.push(rel);
  }
  return acc;
}

const sinComentarios = (t: string) =>
  t.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

describe("los datos de contacto salen de un solo sitio", () => {
  const archivos = ["app", "lib", "components"].flatMap((d) => fuentes(d));

  it("ningún archivo escribe un correo de Kora a mano", () => {
    const culpables = archivos
      .filter((rel) => rel !== join("lib", "contacto.ts"))
      .filter((rel) => /[a-zA-Z0-9._%+-]+@kora[a-z-]*\.[a-z]+/.test(sinComentarios(readFileSync(join(raiz, rel), "utf8"))));
    expect(culpables, `escriben el correo a mano en vez de importar lib/contacto.ts:\n${culpables.join("\n")}`).toEqual([]);
  });

  it("no ha vuelto korahotel.mx, que no es un dominio de nadie", () => {
    const todo = archivos.map((rel) => sinComentarios(readFileSync(join(raiz, rel), "utf8"))).join("\n");
    expect(/korahotel\.mx/.test(todo)).toBe(false);
  });

  it("todas las direcciones viven en el dominio que Kora sí controla", () => {
    for (const dir of [EMAIL_CONTACTO, EMAIL_PRIVACIDAD, EMAIL_RESERVAS]) {
      expect(dir.endsWith("@kora-hotel.com"), `${dir} no está en kora-hotel.com`).toBe(true);
    }
    expect(EMAIL_FROM).toContain(EMAIL_CONTACTO);
  });
});
