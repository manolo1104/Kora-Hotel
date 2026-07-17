/**
 * content-strategy.js
 * Banco editorial del blog de kora-hotel.com (topics.json: 50 artículos
 * en 5 bloques). El agente publica 1 cada 3 días en orden editorial.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Categoría (visible en el blog) e imagen de portada por bloque del banco.
// Las imágenes viven en public/blog/ del sitio.
const BLOQUES = {
  bloque_1_reservas_directas_y_otas: {
    category: "Distribución hotelera",
    image: "/blog/reservas-directas.jpg",
    imageAlt: "Recepción de hotel boutique con huéspedes reservando directo",
  },
  bloque_2_whatsapp_ia_automatizacion: {
    category: "WhatsApp e IA",
    image: "/blog/agente-whatsapp.jpg",
    imageAlt: "Conversación de WhatsApp entre un hotel y su huésped",
  },
  bloque_3_revenue_management_precios: {
    category: "Revenue management",
    image: "/blog/revenue-management.jpg",
    imageAlt: "Dueño de hotel revisando tarifas y ocupación",
  },
  bloque_4_marketing_hotelero: {
    category: "Marketing hotelero",
    image: "/blog/reservas-directas.jpg",
    imageAlt: "Hotel boutique atrayendo huéspedes por canales digitales",
  },
  bloque_5_operacion_finanzas: {
    category: "Operación hotelera",
    image: "/blog/revenue-management.jpg",
    imageAlt: "Operación diaria de un hotel independiente en México",
  },
};

export function loadTopics() {
  const filePath = path.join(__dirname, "topics.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const calendario = data.calendario_editorial || {};

  const topics = [];
  for (const [bloqueKey, bloqueData] of Object.entries(calendario)) {
    const meta = BLOQUES[bloqueKey] || {
      category: "Gestión hotelera",
      image: "/blog/reservas-directas.jpg",
      imageAlt: "Hotel boutique en México",
    };
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
        image: meta.image,
        imageAlt: meta.imageAlt,
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
  return disponibles[0]; // orden editorial: el id más bajo pendiente
}
