import type { MetadataRoute } from "next";
import { articles } from "@/lib/articles";
import { herramientasDisponibles } from "@/lib/herramientas";
import { glosario } from "@/lib/glosario";
import { comparativas } from "@/lib/comparativas";
import { personas } from "@/lib/personas";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// Fecha estable de última actualización (no usar new Date() por entrada: cambiaría
// en cada build y le manda a Google señales falsas de "página modificada").
const SITE_UPDATED = new Date("2026-06-01");

export default function sitemap(): MetadataRoute.Sitemap {
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${BASE_URL}/blog/${article.slug}`,
    lastModified: new Date(article.updatedIso || article.publishedIso),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const herramientaEntries: MetadataRoute.Sitemap = herramientasDisponibles.map(
    (h) => ({
      url: `${BASE_URL}/herramientas/${h.slug}`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    })
  );

  const glosarioEntries: MetadataRoute.Sitemap = glosario.map((t) => ({
    url: `${BASE_URL}/glosario/${t.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const comparativaEntries: MetadataRoute.Sitemap = comparativas.map((c) => ({
    url: `${BASE_URL}/comparativas/${c.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const personaEntries: MetadataRoute.Sitemap = personas.map((p) => ({
    url: `${BASE_URL}/para/${p.slug}`,
    lastModified: SITE_UPDATED,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: SITE_UPDATED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/caracteristicas`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/precios`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/casos/paraiso-encantado`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/como-funciona`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: SITE_UPDATED,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/herramientas`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/glosario`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/comparativas`,
      lastModified: SITE_UPDATED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...herramientaEntries,
    ...glosarioEntries,
    ...comparativaEntries,
    ...personaEntries,
    ...articleEntries,
    {
      url: `${BASE_URL}/privacidad`,
      lastModified: SITE_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terminos`,
      lastModified: SITE_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
