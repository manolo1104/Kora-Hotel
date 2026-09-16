// El sitio dice que se empieza CREANDO LA CUENTA, y lo dice con los números de
// verdad.
//
// Hasta el 15 sep 2026 la web vendía dos historias a la vez. La portada y la
// barra de cierre llevaban al registro, pero /como-funciona contaba un proceso
// de venta asistida que no existía —«Solicitas acceso por WhatsApp», «Nosotros
// configuramos todo, conectamos Booking y Expedia», «Migración de reservas»,
// «Setup en 24 horas o te devolvemos el primer mes»— y su único botón era
// WhatsApp. /precios, además, prometía «Solo tomamos 5 hoteles nuevos al mes:
// montamos cada uno a mano» y «Al activar tu plan, montamos todo por ti».
//
// Decisión de Manolo: el registro es el botón principal en todo el sitio, la
// promesa es «lo configuras tú y te ayudamos si quieres», y WhatsApp queda como
// apoyo. Esta prueba vigila las dos cosas que se rompieron:
//
//   1. Que las cifras y rutas salgan de lib/oferta.ts. El «14» y el «$550»
//      estaban escritos a mano en ~60 sitios; por eso la prueba de 14 días y la
//      garantía de 30 llegaron a convivir en la misma pantalla.
//   2. Que no vuelvan las promesas de montaje a mano, que Kora ya no hace.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { PASOS_ALTA, RUTA_REGISTRO, RUTA_ACTIVAR, AYUDA_ALTA, GARANTIA } from "@/lib/oferta";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/**
 * Quita comentarios de bloque (también los `{/* … *\/}` de JSX, que ocupan
 * varias líneas) y los de línea. Documentar el defecto arreglado —«decía
 * "montamos cada uno a mano"»— no puede reabrirlo. El `//` de línea sólo cuenta
 * al principio o tras un espacio, para no comerse el `https://` de una URL.
 */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

// Las superficies de venta de la portada, /precios y /como-funciona. Se listan
// a mano a propósito: si nace una sección nueva con un botón de empezar, hay que
// añadirla aquí, y ése es el momento de leer este comentario.
const SUPERFICIES = [
  "app/page.tsx",
  "app/opengraph-image.tsx",
  "app/precios/page.tsx",
  "app/precios/opengraph-image.tsx",
  "app/como-funciona/page.tsx",
  "app/como-funciona/opengraph-image.tsx",
  "components/shared/BarraCTA.tsx",
  "components/shared/BotonWhatsApp.tsx",
  "components/landing/Hero.tsx",
  "components/landing/Navbar.tsx",
  "components/landing/Footer.tsx",
  "components/landing/SolutionSection.tsx",
  "components/landing/AgenteSection.tsx",
  "components/landing/MotorReservasSection.tsx",
  "components/landing/DemoMotorSection.tsx",
  "components/landing/CalculadoraROI.tsx",
  "components/landing/ComparisonSection.tsx",
  "components/landing/PricingSection.tsx",
  "components/landing/FAQSection.tsx",
  "components/landing/ContactForm.tsx",
  "components/landing/WhatsAppDemoChat.tsx",
  // Añadidas al integrar (15 sep 2026): las dos se pintan en la PORTADA y las
  // dos habían quedado fuera de la revisión. `lib/fundador.ts` decía «damos de
  // alta a pocos al mes», un cupo que contradice el alta libre, justo debajo
  // del botón de crear cuenta; `HerramientasSection` anuncia la mini-página.
  // El texto de la sección del fundador vive en `lib/fundador.ts`, no en su
  // componente: `FundadorSection.tsx` es sólo maquetación y el `d="…"` del icono
  // de LinkedIn trae «20.45h-3.56», que el patrón del plazo lee como «h» de hora.
  "components/landing/HerramientasSection.tsx",
  "lib/fundador.ts",
];

describe("las cifras y las rutas del alta salen de lib/oferta.ts", () => {
  for (const rel of SUPERFICIES) {
    const src = sinComentarios(leer(rel));

    it(`${rel} no escribe a mano los días de prueba ni el precio`, () => {
      expect(/\b14\s+d[ií]as\b/i.test(src), "usa GARANTIA.diasPrueba").toBe(false);
      expect(/dos semanas/i.test(src), "usa GARANTIA.diasPrueba").toBe(false);
      expect(/\$\s?550\b/.test(src), "usa PRECIO_DESDE").toBe(false);
      expect(/to=\{550\}|price:\s*["']550["']/.test(src), "usa PRECIO_DESDE").toBe(false);
    });

    it(`${rel} no escribe a mano la ruta del registro, la del pago ni un wa.me`, () => {
      expect(src.includes('"/panel/onboarding'), "usa RUTA_REGISTRO").toBe(false);
      expect(src.includes('"/pago/iniciar'), "usa RUTA_ACTIVAR").toBe(false);
      expect(src.includes("`/pago/iniciar"), "usa RUTA_ACTIVAR").toBe(false);
      expect(/wa\.me/.test(src), "usa waLink de lib/contacto.ts").toBe(false);
    });

    it(`${rel} no promete montar el hotel a mano`, () => {
      const PROMESAS: [string, RegExp][] = [
        // Sin guion a los lados: «w-8 h-8» es Tailwind, no un plazo.
        ["un plazo de implementación", /(?<![\w-])\d+\s*(?:h|horas)\b(?!-)/i],
        ["montar el hotel por el cliente", /\bmontamos\b|\bte montamos\b|montado en/i],
        ["configurar por el cliente", /nosotros (lo )?configuramos/i],
        ["un cupo de altas al mes", /hoteles (nuevos )?al mes/i],
        ["migrar reservas", /migraci[oó]n de reservas|importamos (todas )?tus reservas/i],
        ["elegir un tamaño de plan que no existe", /te ayudamos a elegir/i],
      ];
      for (const [que, patron] of PROMESAS) {
        expect(patron.test(src), `${rel} vuelve a prometer ${que}`).toBe(false);
      }
    });
  }
});

describe("/como-funciona cuenta el alta real", () => {
  const src = sinComentarios(leer("app/como-funciona/page.tsx"));
  const og = sinComentarios(leer("app/como-funciona/opengraph-image.tsx"));

  it("los pasos salen de PASOS_ALTA, no de una lista propia", () => {
    expect(src).toMatch(/PASOS_ALTA\.map\(/);
    // Ningún título de paso escrito a mano en la página.
    for (const p of PASOS_ALTA) {
      expect(src.includes(`"${p.titulo}"`), `«${p.titulo}» está escrito a mano`).toBe(false);
    }
  });

  it("el botón principal es el registro y WhatsApp es la ayuda", () => {
    expect(src).toContain("href={RUTA_REGISTRO}");
    expect(src).toContain("Crear mi cuenta gratis");
    expect(src).toContain("{AYUDA_ALTA}");
    expect(src).toContain("waLink(");
  });

  it("lleva los datos estructurados HowTo con los pasos", () => {
    expect(src).toMatch(/"@type":\s*"HowTo"/);
    expect(src).toMatch(/"@type":\s*"HowToStep"/);
  });

  it("ni la página ni su tarjeta para compartir hablan de llave en mano ni de OTAs conectadas", () => {
    for (const texto of [src, og]) {
      expect(/llave en mano/i.test(texto)).toBe(false);
      expect(/conectamos tus canales/i.test(texto)).toBe(false);
      expect(/capacitaci[oó]n de \d+/i.test(texto)).toBe(false);
    }
  });
});

describe("la portada y el motor cuentan la prueba como funciona", () => {
  // La primera versión de SolutionSection buscaba «el paso de probar» con
  // `/prueb/i`, pero el título es «Pruébalo», con tilde: nunca acertaba y la
  // portada enseñaba «Crea tu cuenta · Carga tu hotel · Activa tu plan» —justo
  // sin el paso que Manolo pidió dejar claro— numerados 1-2-3 cuando eran 1-2-5.
  it("«Cómo empezar» de la portada toma los tres primeros pasos, y ahí está el de probar", () => {
    const src = sinComentarios(leer("components/landing/SolutionSection.tsx"));
    expect(src).toContain("PASOS_ALTA.slice(0, 3)");
    const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const titulos = PASOS_ALTA.slice(0, 3).map((p) => sinTildes(p.titulo));
    expect(titulos[0]).toContain("cuenta");
    expect(titulos.some((t) => t.includes("prueba")), "el paso de probar salió de los tres primeros").toBe(true);
  });

  // El motor sólo simula el pago si el hotel está EN PRUEBA y sin cobros listos
  // (`decidirModoPrueba`). Quien activa su plan sin conectar Stripe cobra de
  // verdad, así que «mientras no conectes tus cobros» a secas es falso.
  it("quien promete reservas de prueba sin cobro dice que es durante la prueba", () => {
    for (const rel of [
      "app/como-funciona/page.tsx",
      "components/landing/MotorReservasSection.tsx",
      "components/landing/DemoMotorSection.tsx",
    ]) {
      const src = sinComentarios(leer(rel));
      // `\s+`: en JSX la frase se parte en varias líneas.
      if (!/no\s+cobran\s+nada|se\s+simula/.test(src)) continue;
      expect(/Durante\s+tu\s+prueba/.test(src), `${rel} omite que el simulacro es sólo durante la prueba`).toBe(true);
    }
  });
});

describe("el apoyo por WhatsApp no compite con el registro", () => {
  it("el botón flotante habla de dudas, no de empezar", () => {
    const src = sinComentarios(leer("components/shared/BotonWhatsApp.tsx"));
    expect(src).toMatch(/Dudas/);
    expect(/empezar/i.test(src)).toBe(false);
  });

  it("el pie enlaza al registro y no lleva el número escrito a mano", () => {
    const src = sinComentarios(leer("components/landing/Footer.tsx"));
    expect(src).toContain("href={RUTA_REGISTRO}");
    expect(/489\s?125\s?1458/.test(src)).toBe(false);
  });

  it("el formulario de contacto enlaza también al registro", () => {
    expect(sinComentarios(leer("components/landing/ContactForm.tsx"))).toContain("href={RUTA_REGISTRO}");
  });
});

describe("las constantes que usa el sitio tienen sentido", () => {
  it("las rutas son rutas internas", () => {
    expect(RUTA_REGISTRO.startsWith("/")).toBe(true);
    expect(RUTA_ACTIVAR.startsWith("/")).toBe(true);
  });

  it("el texto de ayuda es la vía secundaria y menciona WhatsApp", () => {
    expect(AYUDA_ALTA).toMatch(/WhatsApp/);
  });

  it("el primer paso del alta dice los mismos días de prueba que la garantía", () => {
    expect(PASOS_ALTA[0].texto).toContain(`${GARANTIA.diasPrueba} días`);
  });
});
