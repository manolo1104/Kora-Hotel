# Blog Agent — kora-hotel.com

Publica **1 artículo cada 3 días** en el blog de Kora, tomando el siguiente tema
pendiente del banco de 50 (`topics.json`).

## Cómo funciona

1. **GitHub Actions** (`.github/workflows/blog-agent.yml`) corre diario a las
   8:20 AM CDMX; el agente decide si "hoy toca" (cada 3 días exactos desde la
   fecha ancla en `index.js`).
2. Lee los posts ya publicados (`GET /api/blog/create`) — la BD es la fuente de
   verdad de qué temas del banco ya salieron (`topic_id`), así que el runner no
   guarda estado.
3. Toma el siguiente tema pendiente en orden editorial, **investiga con web
   search**, redacta el artículo (Claude, estilo de la casa: callouts, H2 con
   id, honestidad de cifras), valida longitud y links internos.
4. Publica vía `POST /api/blog/create` → tabla `blog_articles` de Supabase.
   Las páginas `/blog` fusionan estos artículos con los 5 estáticos de
   `lib/articles.ts`.

## Requisitos (una sola vez)

- Correr `sql/kora-blog-agent.sql` en Supabase (crea `blog_articles` + RLS).
- Env `BLOG_AGENT_SECRET` en Vercel (auth del endpoint).
- Secrets del repo en GitHub: `ANTHROPIC_API_KEY` y `BLOG_AGENT_SECRET`.

## Uso local

```bash
cd blog-agent && npm install
node index.js --dry-run          # genera sin publicar
node index.js --force            # publica hoy aunque no toque
node index.js --topic "chatbot"  # tema específico del banco
API_BASE_URL=http://localhost:3000 node index.js --force  # publicar contra localhost
```

Variables: `ANTHROPIC_API_KEY`, `BLOG_AGENT_SECRET`, opcional `BLOG_MODEL`
(default `claude-opus-4-8`) y `API_BASE_URL` (default `https://kora-hotel.com`).

## Añadir temas

Edita `topics.json`: agrega artículos con `id` nuevo (51+), `titulo`,
`palabras_clave` (la primera es la keyword principal), `objetivo_seo`,
`enfoque_agente` y `estado: "pendiente"` dentro del bloque que corresponda.
