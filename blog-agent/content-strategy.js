/**
 * content-strategy.js
 * Banco editorial del blog de kora-hotel.com (topics.json: 50 artículos
 * en 5 bloques). El agente publica 1 cada 3 días en orden editorial.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Categoría (visible en el blog) por bloque del banco.
const BLOQUES = {
  bloque_1_reservas_directas_y_otas: { category: "Distribución hotelera" },
  bloque_2_whatsapp_ia_automatizacion: { category: "WhatsApp e IA" },
  bloque_3_revenue_management_precios: { category: "Revenue management" },
  bloque_4_marketing_hotelero: { category: "Marketing hotelero" },
  bloque_5_operacion_finanzas: { category: "Operación hotelera" },
};

// Portada por TEMA del banco (no por bloque): cada artículo estrena la suya.
// El mapa lo genera scripts/portadas-blog/render.py en lib/blog-portadas.json,
// que es el MISMO archivo que usa el sitio (lib/blog-db.ts) — así el agente y
// el blog nunca se desincronizan. Si un tema no tiene portada, el agente no
// publica en vez de salir con una foto ajena al tema.
const PORTADAS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "lib", "blog-portadas.json"), "utf-8")
).porTema;

export function loadTopics() {
  const filePath = path.join(__dirname, "topics.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const calendario = data.calendario_editorial || {};

  const topics = [];
  for (const [bloqueKey, bloqueData] of Object.entries(calendario)) {
    const meta = BLOQUES[bloqueKey] || { category: "Gestión hotelera" };
    for (const art of bloqueData?.articulos || []) {
      const palabras = art.palabras_clave || [];
      topics.push({
        id: art.id,
        title: art.titulo,
        focusKeyword: (palabras[0] || "").toLowerCase(),
        secondaryKeywords: palabras.slice(1).map((k) => k.toLowerCase()),
        objetivoSeo: art.objetivo_seo || "",
        enfoque: art.enfoque_agente || "",
        estado: art.estado || "pendiente",
        category: meta.category,
        image: PORTADAS[art.id]?.image,
        imageAlt: PORTADAS[art.id]?.imageAlt,
      });
    }
  }
  return topics.sort((a, b) => a.id - b.id);
}

/**
 * Siguiente tema a publicar. Sin estado local: la fuente de verdad son los
 * topic_id ya publicados en la BD (GET /api/blog/create) — así el runner de
 * GitHub Actions no necesita commitear topics.json.
 */
export function selectTopic(publishedTopicIds = [], usedSlugs = [], customTopic = null) {
  const topics = loadTopics();

  if (customTopic) {
    const q = customTopic.toLowerCase();
    const found = topics.find(
      (t) => t.title.toLowerCase().includes(q) || t.focusKeyword.includes(q)
    );
    if (found) return found;
    throw new Error(`No se encontró el tema "${customTopic}" en topics.json`);
  }

  const publicados = new Set(publishedTopicIds.filter((x) => x != null));
  const pendientes = topics.filter((t) => t.estado === "pendiente" && !publicados.has(t.id));

  // Doble seguro por similitud de slug (por si un post se publicó sin topic_id).
  const disponibles = pendientes.filter((t) => {
    const kwSlug = t.focusKeyword.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return !usedSlugs.some((s) => kwSlug.length > 8 && s.includes(kwSlug));
  });

  if (disponibles.length === 0) {
    throw new Error("Banco agotado: los 50 temas de topics.json ya están publicados. Añade más temas.");
  }
  const elegido = disponibles[0]; // orden editorial: el id más bajo pendiente
  if (!elegido.image) {
    throw new Error(
      `El tema #${elegido.id} ("${elegido.title}") no tiene portada en PORTADAS de ` +
        `content-strategy.js. Genérala con scripts/portadas-blog/render.py y agrégala ` +
        `al mapa antes de publicar.`
    );
  }
  return elegido;
}
