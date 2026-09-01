// El caso Paraíso es el ÚNICO dato de resultado propio que tiene Kora, y
// aparece en la landing, en el pie, en la página del caso, en dos artículos del
// blog y en la secuencia de correos de la guía. Cada vez que se escribió a mano
// en un sitio nuevo, se desincronizó:
//
//   • 27 ago 2026 — tres superficies publicaban 75%→53% cuando el dato real,
//     verificado por Manolo, era 40%→25%.
//   • 31 ago 2026 — la landing publicaba "≈$30,000 que se queda en el hotel" y
//     la página del caso "$8,400 MXN/mes" para EL MISMO ahorro, a un scroll de
//     distancia. Y el tiempo de implementación valía 48 h en la landing, "48 a
//     72" en el formulario y 72 h en el caso.
//
// Esta prueba existe para que la cuarta vez no ocurra: cualquier cifra del caso
// escrita a mano en prosa tiene que coincidir con lib/caso-paraiso.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  OTA_ANTES,
  OTA_DESPUES,
  AHORRO_MENSUAL,
  AHORRO_ANUAL,
  AHORRO_TRIMESTRE,
  AHORRO_NETO_ANUAL,
  COSTO_KORA_ANUAL,
  MESES,
  COMISION_OTA,
  CRECIMIENTO_DIRECTAS,
} from "@/lib/caso-paraiso";
import { PRECIO_DESDE, IMPLEMENTACION_HORAS } from "@/lib/oferta";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

// Superficies que citan el caso en PROSA (no importan la fuente única porque
// son textos largos y interpolar cada número los volvería ilegibles).
const PROSA = [
  "lib/articles.ts",
  "lib/email/guia.ts",
  "components/landing/CalculadoraROI.tsx",
];

describe("las cifras del caso Paraíso no se contradicen entre sí", () => {
  it("los derivados salen de los datos medidos, no de números sueltos", () => {
    expect(AHORRO_TRIMESTRE).toBe(AHORRO_MENSUAL * MESES);
    expect(AHORRO_ANUAL).toBe(AHORRO_MENSUAL * 12);
    expect(COSTO_KORA_ANUAL).toBe(PRECIO_DESDE * 12);
    expect(AHORRO_NETO_ANUAL).toBe(AHORRO_ANUAL - COSTO_KORA_ANUAL);
  });

  it("la dependencia de OTAs baja, no sube", () => {
    expect(OTA_DESPUES).toBeLessThan(OTA_ANTES);
  });

  it("el ahorro anual paga Kora con holgura (si no, el caso no vende nada)", () => {
    expect(AHORRO_ANUAL).toBeGreaterThan(COSTO_KORA_ANUAL * 2);
  });
});

describe("ninguna superficie publica una cifra del caso ya caducada", () => {
  // Cifras que estuvieron publicadas y son FALSAS hoy. Si alguna reaparece, es
  // que alguien copió texto viejo de otro archivo o de un borrador.
  const CADUCADAS: [string, RegExp][] = [
    ["la dependencia vieja 75%→53%", /\b53\s*%/],
    ["el ahorro trimestral mal calculado ($30,000)", /\$\s?30,000/],
    ["el costo anual inventado ($35,880)", /\$\s?35,880/],
    ["el precio con IVA que los Términos ya no cobran ($638)", /\$\s?638/],
  ];

  for (const rel of PROSA) {
    const texto = leer(rel);
    for (const [que, patron] of CADUCADAS) {
      it(`${rel} no dice ${que}`, () => {
        expect(patron.test(texto)).toBe(false);
      });
    }
  }
});

describe("la prosa cita las mismas cifras que la fuente única", () => {
  const todo = PROSA.map(leer).join("\n");

  it(`usa ${OTA_ANTES}% → ${OTA_DESPUES}% de dependencia de OTAs`, () => {
    // Al menos una superficie tiene que contar la caída completa; si el dato
    // cambia en lib/caso-paraiso.ts y nadie actualiza la prosa, esto falla.
    const caida = new RegExp(`${OTA_ANTES}\\s*%\\s*al\\s*${OTA_DESPUES}\\s*%`);
    expect(caida.test(todo)).toBe(true);
  });

  it(`no queda ningún tiempo de implementación distinto de ${IMPLEMENTACION_HORAS} h`, () => {
    // Las 48 h y 72 h eran tres promesas distintas del mismo servicio. Se
    // excluyen los usos que hablan de OTRA cosa (la vigencia de una cotización,
    // el mínimo de 48 h de Stripe, la antelación de una reserva).
    const publicas = [
      "app/como-funciona/page.tsx",
      "components/landing/Hero.tsx",
      "components/landing/SolutionSection.tsx",
      "components/landing/ContactForm.tsx",
      "components/landing/PricingSection.tsx",
      "lib/faqs.ts",
      "lib/ciudades.ts",
      "lib/personas.ts",
      "app/llms.txt/route.ts",
    ].map(leer).join("\n");
    expect(/\b(48|72)\s*(h\b|horas)/.test(publicas)).toBe(false);
  });
});

describe("los datos medidos siguen siendo los verificados por Manolo", () => {
  // Candado de valor: si alguien cambia una cifra publicada, esta prueba lo
  // obliga a venir aquí y a dejar constancia de que fue deliberado.
  it("40% → 25%, verificado el 27 ago 2026", () => {
    expect([OTA_ANTES, OTA_DESPUES]).toEqual([40, 25]);
  });
  it("$8,400 MXN/mes de comisión evitada, confirmado el 31 ago 2026", () => {
    expect(AHORRO_MENSUAL).toBe(8_400);
  });
  it("18% de comisión promedio de OTA y +40% de volumen directo", () => {
    expect(COMISION_OTA).toBe(18);
    expect(CRECIMIENTO_DIRECTAS).toBe(40);
  });
});

describe("el anuncio no promete lo que el contrato niega", () => {
  // Hasta el 31 ago 2026, /precios prometía la "Garantía Reservas Directas"
  // —recuperar la mensualidad en comisiones a los 60 días o seguir trabajando
  // gratis— mientras los Términos §6 decían que Kora NO garantiza resultados de
  // ocupación ni de ingresos. Publicidad que el propio contrato niega es
  // engañosa (LFPC art. 32), y además era incobrable: nada mide "comisiones
  // ahorradas". La garantía viva es la de devolución, y sale de lib/oferta.ts.
  const COMERCIALES = [
    "components/landing/PricingSection.tsx",
    "app/llms.txt/route.ts",
    "app/llms-full.txt/route.ts",
    "lib/faqs.ts",
  ];

  for (const rel of COMERCIALES) {
    it(`${rel} no promete resultados de ocupación ni de comisiones`, () => {
      const texto = leer(rel);
      expect(/comisiones ahorradas/i.test(texto)).toBe(false);
      expect(/Garant[ií]a Reservas Directas/i.test(texto)).toBe(false);
      expect(/seguimos trabajando gratis/i.test(texto)).toBe(false);
    });
  }

  it("los Términos siguen diciendo que no se garantizan resultados", () => {
    expect(leer("app/terminos/page.tsx")).toContain(
      "no garantiza resultados específicos",
    );
  });

  it("la garantía de devolución la escriben los dos desde la misma fuente", () => {
    for (const rel of ["components/landing/PricingSection.tsx", "app/terminos/page.tsx"]) {
      expect(leer(rel)).toContain("GARANTIA");
    }
  });

  it("nadie pinta un precio tachado (afirma un precio anterior que no existió)", () => {
    // LFPC art. 32 y NOM-029-SCFI: el "precio anterior" tiene que haber sido
    // real. Kora nunca cobró los $23,500 del arranque.
    expect(leer("components/landing/PricingSection.tsx")).not.toContain("line-through");
  });
});
