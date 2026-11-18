// Contrato SEO de las páginas públicas de Kora (18 nov 2026).
//
// La auditoría de ese día encontró el sitio limpio en títulos y canónicas, pero
// SIN ninguna prueba que lo sostuviera, y tres defectos: 14 páginas sin
// openGraph, las que sí lo tenían sin `siteName` ni `og:url`, y un FAQPage en
// la portada con 13 preguntas cuando se veían 8 (y sin las respuestas en el
// HTML). Esto lee la metadata REAL de cada página —la misma que sirve Next— y
// exige lo mínimo que Google y WhatsApp necesitan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import type { Metadata } from "next";

// Las páginas importan módulos de servidor (Supabase, blog) que en pruebas no
// tienen variables de entorno; para la metadata no hacen falta.
vi.mock("@/lib/blog-db", () => ({ getAllArticles: async () => [], getArticleBySlug: async () => null }));

import { personas } from "@/lib/personas";
import { comparativas } from "@/lib/comparativas";
import { ciudades } from "@/lib/ciudades";
import { glosario } from "@/lib/glosario";
import { paginasWhatsApp } from "@/lib/whatsapp";
import { AYUDA } from "@/lib/ayuda";
import { faqs } from "@/lib/faqs";
import { conSocial, direccionPostal } from "@/lib/seo";

const ESTATICAS = [
  "page", "pms/page", "motor-de-reservas/page", "precios/page", "caracteristicas/page",
  "como-funciona/page", "contacto/page", "guia/page", "whatsapp/page",
  "sincronizar-airbnb-booking/page", "casos/paraiso-encantado/page",
  "para/page", "hoteles-en/page", "comparativas/page", "glosario/page", "ayuda/page",
  "herramientas/page", "privacidad/page", "terminos/page",
];

type GenMeta = (a: { params: Promise<Record<string, string>> }) => Promise<Metadata>;
const DINAMICAS: Array<[string, string, string[]]> = [
  ["para/[slug]/page", "slug", personas.map((p) => p.slug)],
  ["comparativas/[slug]/page", "slug", comparativas.map((c) => c.slug)],
  ["hoteles-en/[ciudad]/page", "ciudad", ciudades.map((c) => c.slug)],
  ["glosario/[termino]/page", "termino", glosario.map((t) => t.slug)],
  ["whatsapp/[slug]/page", "slug", paginasWhatsApp.map((w) => w.slug)],
  ["ayuda/[slug]/page", "slug", AYUDA.map((a) => a.slug)],
];

function titulo(m: Metadata): string {
  const t = m.title;
  if (typeof t === "string") return t;
  return (t as { absolute?: string; default?: string } | null)?.absolute ?? "";
}

function revisar(nombre: string, m: Metadata) {
  const t = titulo(m);
  const og = (m.openGraph ?? {}) as Record<string, unknown>;
  expect(t, `${nombre}: sin title`).not.toBe("");
  expect(t.length, `${nombre}: title de ${t.length} (> 60): «${t}»`).toBeLessThanOrEqual(60);
  const d = String(m.description ?? "");
  expect(d.length, `${nombre}: description vacía`).toBeGreaterThan(50);
  expect(d.length, `${nombre}: description de ${d.length} (> 160)`).toBeLessThanOrEqual(160);
  expect(m.alternates?.canonical, `${nombre}: sin canónica`).toBeTruthy();
  expect(og.url, `${nombre}: sin og:url`).toBeTruthy();
  expect(og.siteName, `${nombre}: sin og:site_name`).toBe("Kora");
  expect(og.title, `${nombre}: sin og:title`).toBeTruthy();
}

describe("metadata de las páginas públicas", () => {
  for (const ruta of ESTATICAS) {
    it(`/${ruta.replace(/\/?page$/, "")}`, async () => {
      const mod = (await import(`@/app/${ruta}`)) as { metadata: Metadata };
      revisar(ruta, mod.metadata);
    });
  }

  for (const [ruta, param, slugs] of DINAMICAS) {
    it(`/${ruta.replace(/\/page$/, "")} (${slugs.length} páginas)`, async () => {
      const mod = (await import(`@/app/${ruta}`)) as { generateMetadata: GenMeta };
      const titulos = new Set<string>();
      for (const slug of slugs) {
        const m = await mod.generateMetadata({ params: Promise.resolve({ [param]: slug }) });
        revisar(`${ruta} → ${slug}`, m);
        const t = titulo(m);
        expect(titulos.has(t), `${ruta}: title duplicado «${t}»`).toBe(false);
        titulos.add(t);
      }
    });
  }
});

describe("FAQ de la portada", () => {
  const seccion = readFileSync(join(__dirname, "..", "components/landing/FAQSection.tsx"), "utf8");
  const portada = readFileSync(join(__dirname, "..", "app/page.tsx"), "utf8");

  it("el FAQPage marca las mismas preguntas que se ven", () => {
    // Las dos recorren `faqs` entero; si alguien vuelve a recortar una sola, falla.
    expect(portada).toMatch(/mainEntity:\s*faqs\.map/);
    expect(seccion).toMatch(/\{faqs\.map\(/);
    expect(seccion).not.toMatch(/faqs\.slice\(/);
    expect(faqs.length).toBeGreaterThan(5);
  });

  it("las respuestas están en el HTML aunque estén plegadas", () => {
    // Antes: `{open === i && (<motion.div>…{faq.answer}…)}` — montada sólo al abrir.
    expect(seccion).not.toMatch(/open === i &&/);
    expect(seccion).toMatch(/\{faq\.answer\}/);
  });
});

describe("conSocial", () => {
  it("deriva og y twitter sin pisar lo que la página puso", () => {
    const m = conSocial({
      title: "Título | Kora",
      description: "Descripción",
      alternates: { canonical: "/x" },
      openGraph: { title: "OG propio" },
    });
    const og = m.openGraph as Record<string, unknown>;
    expect(og).toMatchObject({ siteName: "Kora", url: "/x", title: "OG propio", description: "Descripción" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "OG propio" });
  });
});

describe("direccionPostal", () => {
  it("parte la ubicación en calle, ciudad, estado y CP", () => {
    expect(direccionPostal("Cda. 6 22, Deportivo Pensil, Miguel Hidalgo, 11480 Ciudad de México, CDMX")).toEqual({
      "@type": "PostalAddress",
      addressCountry: "MX",
      streetAddress: "Cda. 6 22, Deportivo Pensil, Miguel Hidalgo",
      addressLocality: "Ciudad de México",
      addressRegion: "CDMX",
      postalCode: "11480",
    });
    expect(direccionPostal("Xilitla, SLP, México.")).toMatchObject({ addressLocality: "Xilitla", addressRegion: "SLP" });
    expect(direccionPostal("mineral del chico")).toMatchObject({ addressLocality: "mineral del chico" });
  });
});
