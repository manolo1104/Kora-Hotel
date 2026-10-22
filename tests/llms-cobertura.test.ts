// Cada página que Kora le anuncia a Google también se la anuncia a las IA.
//
// 🔴 POR QUÉ EXISTE. Al 22 oct 2026 /llms.txt no tenía NI UN artículo del blog,
// ni el glosario, la ayuda o 17 de las 18 herramientas, y /llms-full.txt leía
// sólo los 5 artículos escritos a mano: los que publica el agente no salían en
// ninguno. Nadie lo notó porque nada comparaba esos archivos con el sitemap.
// Esta prueba lo hace: si alguien agrega una sección al sitemap y se le olvida
// en los llms, truena aquí y no en ChatGPT.
//
// Las páginas de cada hotel (/h/…) no entran: viven en su propio
// /h/{slug}/llms.txt y, sin Supabase, el sitemap no las emite.
import { describe, it, expect, vi } from "vitest";

// Ninguna prueba toca la red: sin llaves, sitemap y llms sólo leen lo estático
// (mismo arreglo que tests/alta-autoservicio-textos.test.ts).
vi.mock("@/lib/supabase/env", () => ({
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  supabaseEnvReady: false,
}));

import sitemap from "@/app/sitemap";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { GET as llmsFull } from "@/app/llms-full.txt/route";
import { TENANTS_PRUEBA } from "@/lib/seo";

async function urlsDe(texto: string): Promise<Set<string>> {
  // Una URL termina en espacio, paréntesis o fin de línea; se le quita la
  // puntuación final que la prosa le pega («…/precios.»).
  const urls = texto.match(/https?:\/\/[^\s)]+/g) ?? [];
  return new Set(urls.map((u) => u.replace(/[.,;:]+$/, "").replace(/\/$/, "")));
}

describe("llms.txt + llms-full.txt cubren el sitemap", () => {
  it("cada URL del sitemap aparece en alguno de los dos archivos", async () => {
    const enSitemap = (await sitemap()).map((e) => e.url.replace(/\/$/, ""));
    expect(enSitemap.length).toBeGreaterThan(100);

    const enLlms = new Set([
      ...(await urlsDe(await (await llmsTxt()).text())),
      ...(await urlsDe(await (await llmsFull()).text())),
    ]);
    // La portada sale como «https://kora-hotel.com» a secas.
    const faltan = enSitemap.filter((u) => !enLlms.has(u));
    expect(faltan).toEqual([]);
  });

  it("el sitemap no repite URLs", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    const repetidas = urls.filter((u, i) => urls.indexOf(u) !== i);
    expect(repetidas).toEqual([]);
  });

  it("ningún archivo para IA enlaza un hotel de prueba", async () => {
    const texto =
      (await (await llmsTxt()).text()) + (await (await llmsFull()).text());
    for (const slug of TENANTS_PRUEBA) {
      expect(texto).not.toContain(`/h/${slug}`);
    }
  });
});
