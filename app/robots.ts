import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// Bots de motores de IA: permitirlos explícitamente para poder ser CITADOS
// en ChatGPT, Perplexity, Claude, Gemini y Copilot (bloquearlos = no aparecer).
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "PerplexityBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "Google-Extended",
  "Bingbot",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  // Rutas privadas / no indexables (panel del hotelero, login, auth, guía del huésped).
  const NO_INDEX = ["/api/", "/panel", "/entrar", "/auth/", "/g/"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: NO_INDEX },
      { userAgent: AI_BOTS, allow: "/", disallow: NO_INDEX },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
