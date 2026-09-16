// «Regístrate, lo configuras tú y te ayudamos si quieres».
//
// Hasta el 15 sep 2026 Kora vendía otra cosa: «24 horas de implementación,
// nosotros lo configuramos», «llave en mano», «solo tomamos 5 hoteles nuevos al
// mes» y hasta «la migración de tus reservas es parte del arranque». Nada de eso
// existía: el alta es libre y por cuenta propia, no hay importador de reservas
// ni sincronía con las OTAs. La promesa vieja estaba escrita a mano en unos
// cuarenta textos de datos —la FAQ, las landings de SEO, el chat de la web, los
// llms.txt que leen ChatGPT y Perplexity, y los correos a leads—, y los correos
// ni siquiera enlazaban al registro: el botón «Probar 14 días gratis» abría un
// chat de WhatsApp con Manolo.
//
// Decisión de Manolo: el registro es el camino principal y WhatsApp sólo apoyo.
// Esta prueba vigila las dos mitades: que la promesa vieja no vuelva a entrar
// copiando un texto de otro sitio, y que cada superficie siga llevando al alta.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";

// llms.txt lista los hoteles publicados leyendo Supabase. Sin llaves no consulta
// nada, pero se fija aquí para que la prueba no dependa del entorno de quien la
// corre: ninguna prueba toca la red.
vi.mock("@/lib/supabase/env", () => ({
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  supabaseEnvReady: false,
}));

import { GARANTIA, PASOS_ALTA, PRECIO_DESDE, RUTA_REGISTRO } from "@/lib/oferta";
import { faqs } from "@/lib/faqs";
import { buildSystemPrompt, MARCADOR_ESCALAR } from "@/lib/soporte/prompt";
import { emailLeadSecuencia, URL_REGISTRO_CORREO, type LeadSecuencia } from "@/lib/email/templates";
import { emailGuia } from "@/lib/email/guia";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { GET as llmsFull } from "@/app/llms-full.txt/route";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Quita comentarios: documentar el defecto arreglado no puede reabrirlo. */
function sinComentarios(src: string): string {
  return src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

// Los textos de datos que hablan de cómo empezar. Si nace uno nuevo (otra
// familia de landings, otra secuencia de correos), hay que añadirlo aquí.
const TEXTOS = [
  "lib/faqs.ts",
  "lib/personas.ts",
  "lib/ciudades.ts",
  "lib/whatsapp.ts",
  "lib/ayuda.ts",
  "lib/soporte/prompt.ts",
  "lib/comparativas.ts",
  "lib/glosario.ts",
  "app/llms.txt/route.ts",
  "app/llms-full.txt/route.ts",
  "lib/email/templates.ts",
  "lib/email/guia.ts",
];

describe("ningún texto promete el montaje a mano que ya no se ofrece", () => {
  const PROHIBIDAS: [string, RegExp][] = [
    ["«llave en mano»", /llave en mano/i],
    ["«lo instalamos»", /\binstalamos\b/i],
    ["«nosotros lo configuramos»", /\bconfiguramos\b/i],
    ["«lo montamos»", /\bmontamos\b/i],
    ["«cargamos tu hotel»", /\bcargamos\b/i],
    ["«te capacitamos»", /\bcapacitamos\b/i],
    ["cupos limitados", /cupos? limitados?/i],
    ["un tope de hoteles nuevos al mes", /hoteles nuevos al mes|pocos hoteles al mes/i],
    ["planes por tamaño (hay uno solo)", /por tamaño del hotel/i],
    ["la migración de reservas incluida", /migraci[oó]n de tus reservas/i],
  ];

  for (const rel of TEXTOS) {
    it(`${rel} no lo promete`, () => {
      const texto = sinComentarios(leer(rel));
      const culpables = PROHIBIDAS.filter(([, re]) => re.test(texto)).map(([que]) => que);
      expect(culpables).toEqual([]);
    });
  }
});

describe("el precio y los días de prueba salen de lib/oferta.ts", () => {
  // La prueba bajó de 30 a 14 días el 6 sep 2026 y el precio ya cambió de forma
  // una vez: cada copia escrita a mano es una promesa que se queda vieja sola.
  const precio = new RegExp(`\\$\\s?${PRECIO_DESDE}\\b`);
  const dias = new RegExp(`\\b${GARANTIA.diasPrueba}\\s+d[ií]as`, "i");

  for (const rel of TEXTOS) {
    it(`${rel} no los escribe a mano`, () => {
      const texto = sinComentarios(leer(rel));
      expect(precio.test(texto), `${rel} escribe el precio a mano`).toBe(false);
      expect(dias.test(texto), `${rel} escribe los días de prueba a mano`).toBe(false);
    });
  }
});

describe("la FAQ dice cómo empezar, y lo dice arriba", () => {
  it("la pregunta de cómo empezar está entre las 8 que pinta la portada", () => {
    // FAQSection sólo muestra `faqs.slice(0, 8)`.
    const visible = faqs.slice(0, 8);
    const empezar = visible.find((f) => /c[oó]mo empiezo/i.test(f.question));
    expect(empezar).toBeDefined();
    expect(empezar!.answer).toMatch(/creas tu cuenta/i);
    expect(empezar!.answer).toContain(`${GARANTIA.diasPrueba} días gratis`);
  });

  it("ninguna respuesta dice que Kora se conecta con las OTAs", () => {
    for (const f of faqs) expect(f.answer).not.toMatch(/se conecta con tus OTAs/i);
  });
});

describe("el chat de la web invita a registrarse", () => {
  const prompt = buildSystemPrompt();

  it("su llamada a la acción es el registro, con los días de la prueba", () => {
    expect(prompt).toContain(RUTA_REGISTRO);
    expect(prompt).toContain(`${GARANTIA.diasPrueba} días gratis`);
  });

  it("sabe explicar los pasos del alta tal como funcionan", () => {
    for (const p of PASOS_ALTA) expect(prompt).toContain(p.titulo);
  });

  it("sigue pudiendo escalar a una persona cuando se lo piden", () => {
    expect(prompt).toContain(MARCADOR_ESCALAR);
  });

  it("la ruta del registro sale como enlace en el chat", () => {
    // `ChatWidget` sólo convierte en enlace las rutas que empiezan por estas
    // cinco. Si el alta se muda fuera de ellas, el bot la escribiría como texto
    // plano y nadie podría tocarla.
    expect(RUTA_REGISTRO).toMatch(/^\/(precios|panel|entrar|ayuda|herramientas)(\/|$)/);
  });
});

describe("los correos a leads llevan al registro; WhatsApp va debajo", () => {
  const TIPOS: LeadSecuencia[] = ["lead_day0", "lead_day3", "lead_day7"];

  it("la URL del registro es absoluta (el correo se abre fuera del sitio)", () => {
    expect(URL_REGISTRO_CORREO).toMatch(/^https?:\/\//);
    expect(URL_REGISTRO_CORREO.endsWith(RUTA_REGISTRO)).toBe(true);
  });

  for (const tipo of TIPOS) {
    it(`${tipo}: el botón principal es el registro, antes que cualquier WhatsApp`, () => {
      const { html } = emailLeadSecuencia(tipo, { nombre: "Luis Pérez", hotel: "Posada de Ejemplo" });
      const registro = html.indexOf(`href="${URL_REGISTRO_CORREO}"`);
      expect(registro).toBeGreaterThan(-1);
      const wa = html.indexOf("wa.me/");
      if (wa > -1) expect(registro).toBeLessThan(wa);
      expect(html).toContain(`Probar ${GARANTIA.diasPrueba} días gratis`);
    });
  }

  it("el correo de venta de la guía lleva al registro, no a /precios", () => {
    const { html } = emailGuia("guia_14", { nombre: "Luis", token: "tok-1" });
    expect(html).toContain(`${RUTA_REGISTRO}"`);
    expect(html).not.toMatch(/href="[^"]*\/precios"/);
  });
});

describe("los llms.txt dicen dónde registrarse y cómo empezar", () => {
  for (const [nombre, get] of [
    ["llms.txt", llmsTxt],
    ["llms-full.txt", llmsFull],
  ] as const) {
    it(`${nombre} trae la URL absoluta del registro y los pasos`, async () => {
      const texto = await (await get()).text();
      expect(texto).toMatch(new RegExp(`https?://[^\\s]+${RUTA_REGISTRO.replace(/\//g, "\\/")}`));
      for (const p of PASOS_ALTA) expect(texto).toContain(p.titulo);
      expect(texto).not.toMatch(/hoteles nuevos al mes/i);
    });
  }
});
