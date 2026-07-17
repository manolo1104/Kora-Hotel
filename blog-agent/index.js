/**
 * blog-agent/index.js
 * ─────────────────────────────────────────────────────────
 * Agente de contenido del blog de Kora (kora-hotel.com).
 * Publica 1 artículo cada 3 días desde el banco de 50 temas
 * (topics.json), vía POST /api/blog/create → Supabase.
 *
 * Basado en el blog-agent de huasteca-potosina.com, adaptado
 * a la audiencia B2B hotelera y al stack Vercel + Supabase.
 *
 * Uso:
 *   node index.js                    ← publica si "toca" (cada 3 días)
 *   node index.js --force            ← ignora el calendario y publica hoy
 *   node index.js --dry-run          ← genera sin publicar
 *   node index.js --topic "chatbot"  ← tema específico del banco
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { selectTopic } from "./content-strategy.js";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const TOPIC_IDX = process.argv.indexOf("--topic");
const CUSTOM_TOPIC = TOPIC_IDX !== -1 ? process.argv[TOPIC_IDX + 1] : null;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.BLOG_MODEL || "claude-opus-4-8";

// Dominio público para links y contenido; API_BASE_URL permite apuntar el
// publish a localhost en pruebas (API_BASE_URL=http://localhost:3000).
const SITE_URL = "https://kora-hotel.com";
const API_BASE_URL = process.env.API_BASE_URL || process.env.SITE_URL || SITE_URL;
const BLOG_SECRET = process.env.BLOG_AGENT_SECRET;

// ── Calendario: cada 3 días exactos ─────────────────────────
// El workflow corre DIARIO a las 14:20 UTC; este gate decide si hoy toca
// publicar (a diferencia del cron "*/3", que se reinicia cada mes).
const ANCHOR_ISO = "2026-07-18"; // primer día de publicación

function tocaPublicarHoy() {
  const dias = Math.floor((Date.now() - Date.parse(ANCHOR_ISO)) / 86400000);
  return dias >= 0 && dias % 3 === 0;
}

// ── Utilidades ──────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callWithRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err?.status === 429 || err?.status >= 500;
      if (retryable && i < retries) {
        const wait = (i + 1) * 30000;
        console.log(`   ⏳ Error ${err.status} — reintentando en ${wait / 1000}s...`);
        await sleep(wait);
      } else throw err;
    }
  }
}

function normalizeStr(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function generateSlug(title, focusKeyword) {
  const keywordSlug = normalizeStr(focusKeyword);
  const titleSlug = normalizeStr(title);
  let slug = titleSlug.includes(keywordSlug)
    ? titleSlug
    : `${keywordSlug}-${titleSlug.replace(keywordSlug, "").replace(/^-|-$/g, "")}`;
  if (slug.length > 70) slug = slug.slice(0, 70).replace(/-$/, "");
  return slug;
}

function validateSlug(slug, focusKeyword) {
  const slugText = slug.split("-").join(" ");
  const kw = normalizeStr(focusKeyword).split("-").join(" ");
  // Basta con que el slug contenga las palabras significativas de la keyword
  const significativas = kw.split(" ").filter((w) => w.length > 3);
  const contiene = significativas.filter((w) => slugText.includes(w)).length;
  if (significativas.length > 0 && contiene < Math.ceil(significativas.length / 2)) {
    throw new Error(`SLUG INVÁLIDO: "${slug}" no refleja la keyword "${focusKeyword}".`);
  }
  return true;
}

// ── Investigación con web search (herramienta server-side) ──

async function doResearch(topic) {
  console.log(`\n🔍 Investigando: "${topic.focusKeyword}"...`);
  const year = new Date().getFullYear();

  const prompt = `Busca información actual sobre "${topic.focusKeyword}" para hoteles independientes en México (${year}). Extrae en máximo 250 palabras, solo datos concretos y verificables con su fuente:
1. Cifras del sector (comisiones OTA, adopción, benchmarks de ocupación/ADR en México)
2. Precios o rangos actuales relevantes al tema
3. 3 preguntas frecuentes que hacen los hoteleros sobre este tema
4. Un dato o ángulo que los artículos genéricos no cubren
Si no encuentras un dato confiable, dilo — NO inventes cifras.`;

  let messages = [{ role: "user", content: prompt }];
  const textos = [];

  for (let round = 0; round < 3; round++) {
    const response = await callWithRetry(() =>
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        tools: [{ type: "web_search_20260209", name: "web_search" }],
        messages,
      })
    );

    for (const block of response.content) {
      if (block.type === "text" && block.text) textos.push(block.text);
    }

    if (response.stop_reason !== "pause_turn") break;
    // pause_turn: reenviar para que el servidor continúe la búsqueda
    messages = [
      { role: "user", content: prompt },
      { role: "assistant", content: response.content },
    ];
  }

  const result = textos.join("\n\n").trim();
  if (result) console.log(`   ✅ Investigación completa (${result.length} chars)`);
  return result;
}

// ── Links internos: validar contra rutas reales del sitio ───

const RUTAS_FIJAS = new Set([
  "/", "/caracteristicas", "/precios", "/como-funciona", "/blog",
  "/herramientas", "/glosario", "/comparativas", "/hoteles-en",
  "/casos/paraiso-encantado", "/#contacto",
]);

function validateInternalLinks(content, verifiedBlogSlugs) {
  const slugs = new Set(verifiedBlogSlugs);
  let total = 0;
  let valid = 0;

  const fixed = content.replace(
    /href="(\/[^"]*)"/g,
    (match, ruta) => {
      total++;
      if (RUTAS_FIJAS.has(ruta)) { valid++; return match; }
      const blogMatch = ruta.match(/^\/blog\/([a-z0-9-]+)$/);
      if (blogMatch) {
        if (slugs.has(blogMatch[1])) { valid++; return match; }
        console.warn(`   ⚠️  Slug de blog no verificado: ${ruta} → /blog`);
        return `href="/blog"`;
      }
      // Rutas profundas no verificables desde aquí → subir al índice de su sección
      for (const prefijo of ["/herramientas", "/glosario", "/comparativas", "/hoteles-en", "/ayuda"]) {
        if (ruta.startsWith(prefijo + "/")) {
          console.warn(`   ⚠️  Ruta profunda no verificada: ${ruta} → ${prefijo}`);
          return `href="${prefijo}"`;
        }
      }
      if (ruta.startsWith("/caracteristicas#")) { valid++; return match; }
      console.warn(`   ⚠️  Ruta desconocida: ${ruta} → /`);
      return `href="/"`;
    }
  );

  return { content: fixed, validCount: valid, totalCount: total };
}

// ── Métricas de calidad ─────────────────────────────────────

function countWords(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function checkKeywordDensity(content, keyword) {
  const text = content.replace(/<[^>]+>/g, " ").toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const occurrences = (text.match(new RegExp(escaped, "gi")) || []).length;
  return { occurrences, wordCount, density: wordCount ? (occurrences / wordCount) * 100 : 0 };
}

// ── Extractor de JSON robusto (HTML con comillas sin escapar) ──

function extractBlogJSON(raw) {
  const result = {};
  for (const f of ["slug", "metaTitle", "title", "metaDescription", "excerpt"]) {
    const m = raw.match(new RegExp(`"${f}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"`));
    if (m) result[f] = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  const cIdx = raw.indexOf('"content"');
  if (cIdx !== -1) {
    const after = raw.slice(cIdx + '"content"'.length);
    const quote = after.indexOf('"', after.indexOf(":") + 1);
    if (quote !== -1) {
      const rest = after.slice(quote + 1);
      const endMarkers = [/",\s*"tags"\s*:/, /"\s*\}\s*$/];
      let bestEnd = rest.length;
      for (const marker of endMarkers) {
        const m = rest.search(marker);
        if (m !== -1 && m < bestEnd) bestEnd = m;
      }
      result.content = rest
        .slice(0, bestEnd)
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\\\/g, "\\");
    }
  }
  const tagsM = raw.match(/"tags"\s*:\s*(\[[^\]]*\])/);
  if (tagsM) { try { result.tags = JSON.parse(tagsM[1]); } catch { result.tags = []; } }
  if (!result.title || !result.content) throw new Error("No se pudo extraer el JSON del artículo");
  return result;
}

// ── Redacción ───────────────────────────────────────────────

const WORD_MIN = 1800;
const WORD_MAX = 2400;

function buildPrompt(topic, researchContext, verifiedBlogSlugs, slug) {
  const year = new Date().getFullYear();
  const secundarias = topic.secondaryKeywords.join(", ");
  const slugsList = verifiedBlogSlugs.map((s) => `/blog/${s}`).join(", ") || "(ninguno)";

  return `Escribe un artículo HTML para el blog de Kora (kora-hotel.com), el sistema de gestión hotelera para hoteles boutique e independientes en México (motor de reservas directas + agente de WhatsApp con IA + CRM, $550 MXN/mes, prueba de 30 días sin tarjeta).

AUDIENCIA: dueños y administradores de hoteles independientes en México (5–40 habitaciones), sin equipo técnico. Háblales de tú, directo, como un colega hotelero.

AUTOR (voz del artículo): Manolo Covarrubias, fundador de Kora y dueño del Hotel Paraíso Encantado en Xilitla, SLP. Escribe en primera persona cuando aporte experiencia real de operar su hotel ("en mi hotel...", "cuando empezamos a..."). Español mexicano natural.

TEMA: ${topic.title}
KEYWORD PRINCIPAL: ${topic.focusKeyword}
KEYWORDS SECUNDARIAS: ${secundarias}
OBJETIVO SEO: ${topic.objetivoSeo}
ENFOQUE EDITORIAL: ${topic.enfoque}

CONTEXTO INVESTIGADO (única fuente permitida para cifras externas):
${researchContext || "(Sin investigación — usa solo conocimiento general y NO inventes cifras específicas)"}

LONGITUD: estrictamente ${WORD_MIN}–${WORD_MAX} palabras (sin contar tags HTML). Desarrolla con ejemplos numéricos concretos y experiencia real — nada de relleno.

ESTRUCTURA OBLIGATORIA del campo "content" (HTML, SIN <h1>):

1. Abre con este bloque de resumen (estilo de la casa):
<div class="callout-summary">
  <p class="callout-summary-title">Lo más importante</p>
  <ul>
    <li>[3 bullets con las conclusiones clave del artículo, con números cuando existan]</li>
  </ul>
</div>

2. Intro de 2–3 párrafos <p>. El PRIMER párrafo empieza con una oración que defina o responda "${topic.focusKeyword}" en 15–25 palabras, auto-contenida y extractable (AI SEO). Incluye la keyword en las primeras 2 oraciones. NO empieces con "Si estás buscando..." ni "En el mundo de...".

3. De 4 a 6 secciones <h2 id="kebab-case-del-titulo"> (los id son OBLIGATORIOS: alimentan el índice de la página). Al menos 2 headings formulados como pregunta real de búsqueda ("¿Cuánto...?", "¿Cómo...?"). Usa <h3> para subtemas, <ul>/<ol> para listas, y una <table> si el tema compara opciones o rangos de precio.

4. Exactamente 1 bloque de estadística destacada donde el dato sea más fuerte:
<div class="callout-stat">
  <span class="callout-stat-number">[cifra]</span>
  <span class="callout-stat-label">[qué significa esa cifra]</span>
</div>

5. Exactamente 1 consejo práctico:
<div class="callout-tip">
  <p class="callout-tip-title">[título corto]</p>
  <p>[consejo accionable]</p>
</div>

6. Sección final <h2 id="preguntas-frecuentes">Preguntas frecuentes sobre ${topic.focusKeyword}</h2> con 3 <h3> en forma de pregunta y respuesta directa de ≤60 palabras cada una.

7. Cierra con este CTA (estilo de la casa, adapta el texto al tema):
<div class="callout-cta">
  <strong>[frase de beneficio ligada al tema]</strong>
  <p>[1–2 líneas: cómo Kora lo resuelve. Menciona la prueba de 30 días sin tarjeta.]</p>
  <a href="/#contacto">[CTA de acción] →</a>
</div>

LINKS INTERNOS (usa 3 a 5, rutas relativas):
- Artículos verificados del blog (SOLO estos): ${slugsList}
- Páginas del sitio: /caracteristicas, /precios, /como-funciona, /herramientas, /glosario, /comparativas
- NUNCA inventes un slug de blog ni una ruta que no esté en esta lista.

KEYWORD DENSITY: usa "${topic.focusKeyword}" entre 8 y 14 veces (1 vez en un H2, 2 veces en el intro, resto natural). Para lo demás usa las secundarias y sinónimos. El keyword stuffing penaliza.

HONESTIDAD DE CIFRAS (regla de la casa, innegociable):
- Cifras externas SOLO del contexto investigado, con atribución ("según [fuente], ... en ${year}").
- Si no hay dato investigado, usa rangos conservadores presentados como estimación ("típicamente entre X y Y") — nunca una cifra exacta inventada ni estadísticas falsas de Kora.
- Los ejemplos numéricos de hotel (12 habitaciones, $1,500/noche, 65% ocupación) preséntalo como ejemplo hipotético, no como dato.

PROHIBIDO: "increíble", "sin duda alguna", "en el competitivo mundo de", "hoy en día", "es importante mencionar", emojis, y cualquier promesa de resultados garantizados.

Responde JSON puro sin markdown fences:
{"slug":"${slug}","metaTitle":"máx 60 chars con la keyword","title":"H1 completo (puede diferir ligeramente del tema)","metaDescription":"140-155 chars con la keyword","excerpt":"2 líneas que den ganas de leer","content":"HTML completo","tags":["tag1","tag2","tag3","tag4"]}`;
}

async function writeArticle(topic, researchContext, verifiedBlogSlugs) {
  console.log(`\n✍️  Redactando artículo (${WORD_MIN}–${WORD_MAX} palabras, modelo ${MODEL})...`);

  const slug = generateSlug(topic.title, topic.focusKeyword);
  validateSlug(slug, topic.focusKeyword);
  console.log(`   🔗 Slug: ${slug}`);

  const prompt = buildPrompt(topic, researchContext, verifiedBlogSlugs, slug);

  const response = await callWithRetry(async () => {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 24000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });
    return stream.finalMessage();
  });

  let raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("El modelo no devolvió JSON válido");

  let post;
  try {
    post = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn("   ⚠️  JSON con caracteres problemáticos — extrayendo por campo...");
    post = extractBlogJSON(jsonMatch[0]);
  }

  post.slug = slug; // forzar el slug generado y validado
  post.category = topic.category;
  post.image = topic.image;
  post.imageAlt = topic.imageAlt;
  post.focusKeyword = topic.focusKeyword;
  post.secondaryKeywords = topic.secondaryKeywords;
  post.topicId = topic.id;
  post.tags = (post.tags || []).slice(0, 5);

  const linkCheck = validateInternalLinks(post.content || "", verifiedBlogSlugs);
  post.content = linkCheck.content;
  post._links = linkCheck;

  return post;
}

// ── Corrección de word count (1 pasada) ─────────────────────

async function correctWordCount(content, wordCount) {
  const action = wordCount > WORD_MAX ? "recorta" : "expande";
  const objetivo = wordCount > WORD_MAX
    ? `máximo ${WORD_MAX} palabras eliminando párrafos redundantes del cuerpo (NUNCA el callout-summary, el FAQ ni el callout-cta)`
    : `mínimo ${WORD_MIN} palabras profundizando las secciones más cortas con ejemplos numéricos concretos (no relleno)`;

  console.log(`   🔄 Corrigiendo word count (${wordCount} → ${action})...`);
  const response = await callWithRetry(async () => {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 24000,
      messages: [{
        role: "user",
        content: `Este artículo HTML tiene ${wordCount} palabras. Ajústalo a ${objetivo}. Conserva la estructura, los id de los H2 y todos los bloques callout. Devuelve SOLO el HTML corregido, sin explicaciones ni markdown fences.\n\n---\n\n${content}`,
      }],
    });
    return stream.finalMessage();
  });

  const corrected = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()
    .replace(/^```html?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return corrected.length > 500 ? corrected : content;
}

// ── Publicar ────────────────────────────────────────────────

async function publishPost(post) {
  if (DRY_RUN) {
    console.log("\n🧪 DRY-RUN — Artículo NO publicado. Preview:\n");
    console.log(`Meta título:  ${post.metaTitle}`);
    console.log(`H1:           ${post.title}`);
    console.log(`Slug:         ${post.slug}`);
    console.log(`Categoría:    ${post.category}`);
    console.log(`Keyword:      ${post.focusKeyword}`);
    console.log(`Meta desc:    ${post.metaDescription}`);
    console.log(`Tags:         ${(post.tags || []).join(", ")}`);
    console.log(`\n--- CONTENT (primeros 1200 chars) ---`);
    console.log((post.content || "").slice(0, 1200) + "...");
    return { slug: post.slug, dryRun: true };
  }

  const res = await fetch(`${API_BASE_URL}/api/blog/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BLOG_SECRET}`,
    },
    body: JSON.stringify(post),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`API error ${res.status}: ${JSON.stringify(data)}`);

  console.log(`\n🚀 Publicado: ${SITE_URL}/blog/${data.post.slug}`);
  return data.post;
}

// ── Log de calidad ──────────────────────────────────────────

function printQualityLog(post) {
  const wc = countWords(post.content || "");
  const kd = checkKeywordDensity(post.content || "", post.focusKeyword);
  const h2Ids = (post.content.match(/<h2 id="/g) || []).length;
  const tieneCta = post.content.includes('class="callout-cta"');
  const tieneSummary = post.content.includes('class="callout-summary"');
  const issues = [];

  console.log("\n" + "─".repeat(55));
  console.log("📊 MÉTRICAS DE CALIDAD");
  console.log("─".repeat(55));

  const wcOk = wc >= WORD_MIN && wc <= WORD_MAX + 200;
  console.log(`${wcOk ? "✅" : "❌"} Word count: ${wc} (objetivo ${WORD_MIN}–${WORD_MAX})`);
  if (!wcOk) issues.push(`word count ${wc}`);

  const kdOk = kd.occurrences >= 6 && kd.occurrences <= 16;
  console.log(`${kdOk ? "✅" : "⚠️"} Keyword: ${kd.occurrences} ocurrencias (${kd.density.toFixed(1)}%)`);
  if (!kdOk) issues.push(`keyword ${kd.occurrences} occ`);

  console.log(`${h2Ids >= 4 ? "✅" : "❌"} H2 con id: ${h2Ids} (mínimo 4 — alimentan el índice)`);
  if (h2Ids < 4) issues.push("faltan H2 con id");

  console.log(`${tieneSummary ? "✅" : "❌"} callout-summary inicial: ${tieneSummary ? "sí" : "NO"}`);
  console.log(`${tieneCta ? "✅" : "❌"} callout-cta final: ${tieneCta ? "sí" : "NO"}`);
  if (!tieneSummary) issues.push("sin callout-summary");
  if (!tieneCta) issues.push("sin callout-cta");

  const lv = post._links || { validCount: 0, totalCount: 0 };
  console.log(`✅ Links internos: ${lv.validCount}/${lv.totalCount} verificados (los rotos se redirigieron)`);

  if (issues.length) console.log(`\n⚠️  REQUIERE REVISIÓN: ${issues.join(" | ")}`);
  else console.log(`\n🎯 Todas las verificaciones pasaron`);
  console.log("─".repeat(55));
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("\n📝  BLOG AGENT — kora-hotel.com");
  console.log(`    1 artículo cada 3 días · ${WORD_MIN}–${WORD_MAX} palabras · ${MODEL}`);
  console.log(`    Modo: ${DRY_RUN ? "🧪 DRY-RUN" : "🚀 LIVE"}`);
  console.log("═".repeat(55));

  // Gate del calendario (el workflow corre diario)
  if (!FORCE && !DRY_RUN && !CUSTOM_TOPIC && !tocaPublicarHoy()) {
    console.log("\n📅 Hoy no toca publicar (cadencia: cada 3 días desde " + ANCHOR_ISO + "). Saliendo.");
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY");
  if (!DRY_RUN && !BLOG_SECRET) throw new Error("Falta BLOG_AGENT_SECRET");

  // Posts existentes: dedup por topic_id + slugs verificados para links
  let postsExistentes = [];
  if (BLOG_SECRET) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/blog/create`, {
        headers: { Authorization: `Bearer ${BLOG_SECRET}` },
      });
      if (res.ok) {
        const data = await res.json();
        postsExistentes = data.posts || [];
        console.log(`\n📚 Posts existentes: ${postsExistentes.length}`);
      } else {
        console.warn(`\n⚠️  GET /api/blog/create → ${res.status} (continuando sin lista)`);
      }
    } catch (e) {
      console.warn(`\n⚠️  No se pudo leer posts existentes: ${e.message}`);
    }
  }

  const publishedTopicIds = postsExistentes.map((p) => p.topic_id).filter((x) => x != null);
  const usedSlugs = postsExistentes.map((p) => p.slug);
  const verifiedBlogSlugs = usedSlugs;

  const topic = selectTopic(publishedTopicIds, usedSlugs, CUSTOM_TOPIC);
  console.log(`\n📌 Tema #${topic.id}: ${topic.title}`);
  console.log(`🔑 Keyword:   ${topic.focusKeyword}`);
  console.log(`🏷️  Categoría: ${topic.category}`);

  const researchContext = await doResearch(topic).catch((e) => {
    console.warn(`   ⚠️  Investigación fallida: ${e.message}`);
    return "";
  });

  const post = await writeArticle(topic, researchContext, verifiedBlogSlugs);

  // Word count con 1 corrección
  let wc = countWords(post.content || "");
  if (wc < WORD_MIN || wc > WORD_MAX) {
    post.content = await correctWordCount(post.content, wc);
    wc = countWords(post.content);
    console.log(`   ${wc >= WORD_MIN && wc <= WORD_MAX + 200 ? "✅" : "⚠️"} Word count final: ${wc}`);
  } else {
    console.log(`   ✅ Word count: ${wc}`);
  }

  const publicado = await publishPost(post);
  printQualityLog(post);

  console.log("\n" + "═".repeat(55));
  console.log(`✅  Blog Agent completado${DRY_RUN ? " (dry-run)" : `: /blog/${publicado.slug}`}`);
  console.log("═".repeat(55) + "\n");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
