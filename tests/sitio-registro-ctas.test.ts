// El camino del sitio es registrarse y probar Kora con tu hotel.
//
// Decisión de Manolo (15 sep 2026): el botón principal de TODO el sitio es el
// registro, y WhatsApp queda sólo como apoyo. Hasta ese día las páginas
// secundarias hacían lo contrario: los 14 bloques de las herramientas gratis
// decían «Ver cómo funciona Kora» y abrían un formulario en /contacto, el blog
// cerraba con «Solicitar demo», /para con «Solicitar una demo», y el agente del
// blog seguía publicando cada 3 días artículos que prometían «prueba de 30
// días» cuando el sistema daba 14.
//
// Nada de eso rompía la compilación ni una prueba: eran textos y enlaces
// escritos a mano en 20 archivos. Estas pruebas vigilan que no vuelvan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { GARANTIA, PRECIO_DESDE, RUTA_REGISTRO } from "@/lib/oferta";
import { articles, ctaDeArticuloAlRegistro } from "@/lib/articles";
import { leerOferta } from "../blog-agent/oferta.js";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Quita comentarios de línea y de bloque JSX: contar la historia no es reabrirla. */
function sinComentarios(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

describe("los artículos ya publicados por el agente se corrigen al pintarse", () => {
  // La forma exacta que pedía la plantilla vieja de blog-agent/index.js.
  const viejo = `<p>Hace 30 días subí la tarifa.</p>
<div class="callout-cta">
  <strong>Deja de pagar comisiones</strong>
  <p>Kora lo resuelve. Pruébalo con la prueba de 30 días sin tarjeta.</p>
  <a href="/#contacto">Agenda tu demo →</a>
</div>`;

  it("el botón del CTA lleva al registro y dice lo que hace", () => {
    const html = ctaDeArticuloAlRegistro(viejo);
    expect(html).not.toContain('href="/#contacto"');
    expect(html).toContain(`<a href="${RUTA_REGISTRO}">Pruébalo gratis →</a>`);
    expect(html).not.toContain("Agenda tu demo");
  });

  it("dentro del CTA, los 30 días pasan a ser los de la prueba real", () => {
    const html = ctaDeArticuloAlRegistro(viejo);
    expect(html).toContain(`prueba de ${GARANTIA.diasPrueba} días`);
  });

  it("fuera del CTA no toca nada: un «30 días» ahí puede ser otra cosa", () => {
    expect(ctaDeArticuloAlRegistro(viejo)).toContain("Hace 30 días subí la tarifa.");
  });

  it("también corrige un CTA que apuntaba a /contacto con parámetros", () => {
    const html = ctaDeArticuloAlRegistro(
      '<div class="callout-cta"><a href="/contacto?utm_source=blog">Quiero saber más</a></div>',
    );
    expect(html).toContain(`href="${RUTA_REGISTRO}"`);
  });

  it("también corrige el enlace al formulario escrito con el dominio completo", () => {
    const html = ctaDeArticuloAlRegistro(
      '<div class="callout-cta"><a href="https://kora-hotel.com/#contacto">Agenda tu demo</a></div>',
    );
    expect(html).toContain(`href="${RUTA_REGISTRO}"`);
    expect(html).not.toContain("Agenda tu demo");
  });

  it("no toca los 30 días de la garantía de devolución (esos sí son 30)", () => {
    // GARANTIA.diasDevolucion también es 30: cambiarlo por los días de prueba
    // convertiría una frase verdadera en una falsa.
    const html = ctaDeArticuloAlRegistro(
      '<div class="callout-cta"><p>Prueba de 30 días sin tarjeta. Si cancelas, te devolvemos tu mensualidad dentro de 30 días.</p></div>',
    );
    expect(html).toContain(`Prueba de ${GARANTIA.diasPrueba} días sin tarjeta.`);
    expect(html).toContain("te devolvemos tu mensualidad dentro de 30 días.");
  });

  it("deja en paz los enlaces a otras páginas dentro del CTA", () => {
    const html = '<div class="callout-cta"><a href="/precios">Ver precios</a></div>';
    expect(ctaDeArticuloAlRegistro(html)).toBe(html);
  });

  it("es idempotente", () => {
    const una = ctaDeArticuloAlRegistro(viejo);
    expect(ctaDeArticuloAlRegistro(una)).toBe(una);
  });
});

describe("los artículos fijos del blog llevan al registro", () => {
  for (const a of articles) {
    it(`${a.slug}: su CTA va a ${RUTA_REGISTRO}, no a /contacto`, () => {
      const cta = a.content.match(/<div class="callout-cta">([\s\S]*?)<\/div>/);
      expect(cta, "el artículo perdió su bloque callout-cta").not.toBeNull();
      expect(cta![1]).toContain(`href="${RUTA_REGISTRO}"`);
      expect(cta![1]).not.toMatch(/href="\/(#)?contacto/);
    });
  }

  it("ningún artículo escribe los días de prueba a mano", () => {
    // En el fuente, no en el texto ya interpolado: lo que se desincroniza es el literal.
    expect(/\d+\s+días gratis/.test(sinComentarios(leer("lib/articles.ts")))).toBe(false);
  });
});

describe("el agente del blog lee la oferta de la fuente única", () => {
  it("sus expresiones sacan exactamente lo que exporta lib/oferta.ts", () => {
    expect(leerOferta(leer("lib/oferta.ts"))).toEqual({
      precio: PRECIO_DESDE,
      diasPrueba: GARANTIA.diasPrueba,
      rutaRegistro: RUTA_REGISTRO,
    });
  });

  it("si no puede leer una constante, falla en vez de inventar un valor", () => {
    expect(() => leerOferta("export const PRECIO_DESDE = 550;")).toThrow(/diasPrueba/);
  });

  const agente = sinComentarios(leer("blog-agent/index.js"));

  it("el prompt ya no escribe a mano ni el precio ni los días de prueba", () => {
    expect(agente).not.toMatch(/prueba (gratis )?de \d+ días/);
    expect(agente).not.toMatch(/\$\d{3}\s*MXN/);
  });

  it("la plantilla del CTA apunta al registro, no a /#contacto", () => {
    const cta = agente.match(/<div class="callout-cta">([\s\S]*?)<\/div>/);
    expect(cta).not.toBeNull();
    expect(cta![1]).toContain("${OFERTA.rutaRegistro}");
    expect(cta![1]).not.toContain("#contacto");
  });

  it("el prompt le prohíbe decir que Kora conecta el hotel a Google Hotels", () => {
    // El 3 sep 2026 un hotel que paga escribió «dice ChatGPT que ofreces Google
    // Free Links»: lo había sacado de un artículo de este agente. Kora no es socio
    // de conectividad de Google (no manda precios ni disponibilidad).
    const nunca = agente.match(/NUNCA digas que Kora[^\n]*/);
    expect(nunca).not.toBeNull();
    expect(nunca![0]).toMatch(/Google Hotels/);
    expect(nunca![0]).toMatch(/enlaces de reserva gratuitos/);
  });

  it("ningún artículo del repo promete integración directa con Google", () => {
    expect(sinComentarios(leer("lib/articles.ts"))).not.toMatch(/integraci[oó]n directa con tu motor/);
  });

  it("la ruta del registro está entre las rutas válidas (si no, se reescribe a «/»)", () => {
    const rutas = agente.match(/const RUTAS_FIJAS = new Set\(\[([\s\S]*?)\]\)/);
    expect(rutas).not.toBeNull();
    expect(rutas![1]).toContain("OFERTA.rutaRegistro");
  });
});

describe("las páginas secundarias no mandan a pedir una demo", () => {
  const PAGINAS = [
    "app/caracteristicas/page.tsx",
    "app/casos/paraiso-encantado/page.tsx",
    "app/para/[slug]/page.tsx",
    "app/whatsapp/page.tsx",
    "app/contacto/page.tsx",
    "app/not-found.tsx",
    "app/blog/[slug]/page.tsx",
    "app/guia/page.tsx",
    "app/ayuda/page.tsx",
    "app/herramientas/mini-pagina/page.tsx",
    "components/soporte/ChatWidget.tsx",
    "components/herramientas/LeadCaptureTool.tsx",
  ];
  // Las 14 herramientas con bloque «el puente a Kora».
  const HERRAMIENTAS = [
    "Anticipo", "AuditoriaFicha", "CalculadoraComisiones", "CalculadoraImpuestos",
    "CalculadoraPuntoEquilibrio", "CalculadoraTarifa", "CalendarioPuentes",
    "Cotizacion", "DescuentoMaximo", "DocumentosLegales", "GeneradorIA",
    "QrReservas", "TarifaNeta", "DiagnosticoHotel",
  ].map((n) => `components/herramientas/${n}.tsx`);

  for (const rel of [...PAGINAS, ...HERRAMIENTAS]) {
    it(`${rel} no enlaza a /contacto ni pide una demo`, () => {
      const src = sinComentarios(leer(rel));
      expect(src).not.toMatch(/href=\{?[`"]\/contacto/);
      expect(src).not.toMatch(/Solicitar (una |mi )?demo|Ver demo en vivo|Quiero ver el demo/);
    });
  }

  for (const rel of PAGINAS) {
    it(`${rel} no arma el enlace de WhatsApp a mano (usa waLink)`, () => {
      expect(leer(rel)).not.toMatch(/wa\.me\/\$\{/);
    });
  }

  it("cada herramienta lleva su puente al registro con el componente común", () => {
    for (const rel of HERRAMIENTAS) {
      const src = leer(rel);
      expect(src, rel).toContain("<CtaRegistroHerramienta");
      expect(src, rel).not.toContain("Ver cómo funciona Kora");
    }
  });

  it("ninguna herramienta dice que Kora hace precio dinámico (lib/oferta.ts lo deja fuera)", () => {
    for (const rel of HERRAMIENTAS) {
      const src = sinComentarios(leer(rel));
      expect(src, rel).not.toMatch(/Precio dinámico automático/i);
      expect(src, rel).not.toMatch(/Kora ajusta tu tarifa/i);
      expect(src, rel).not.toMatch(/con Kora[^.]*precio\s+dinámico/i);
    }
  });

  it("/contacto ya no promete dejarlo operando en un plazo", () => {
    const src = sinComentarios(leer("app/contacto/page.tsx"));
    expect(src).not.toContain("IMPLEMENTACION_HORAS");
    expect(src).toContain("RUTA_REGISTRO");
  });

  it("/whatsapp ya no dice que la conexión la montamos nosotros", () => {
    const src = sinComentarios(leer("app/whatsapp/page.tsx"));
    expect(src).not.toMatch(/la montamos nosotros|llave en mano|lo hacemos nosotros/i);
    expect(src).toContain("Dispositivos vinculados");
  });
});
