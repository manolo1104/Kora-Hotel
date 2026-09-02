// Notifica a IndexNow (Bing, Yandex y motores que alimentan a Copilot/ChatGPT)
// todas las URLs del sitemap en vivo. Úsalo tras cada deploy: `npm run indexnow`.
//
// La llave sale de lib/indexnow-key.mjs y da nombre a public/<KEY>.txt, que
// TIENE que estar publicado en el dominio para que IndexNow acepte los avisos.

import { INDEXNOW_KEY } from "../lib/indexnow-key.mjs";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const KEY = INDEXNOW_KEY;

async function main() {
  const host = new URL(SITE).host;

  const sm = await fetch(`${SITE}/sitemap.xml`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!sm.ok) throw new Error(`No se pudo leer el sitemap: HTTP ${sm.status}`);
  const xml = await sm.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  if (urls.length === 0) {
    console.error("No se encontraron URLs en el sitemap.");
    process.exit(1);
  }

  const body = {
    host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList: urls,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  console.log(`IndexNow → HTTP ${res.status} (${res.statusText})`);
  console.log(`URLs enviadas: ${urls.length}`);
  // 200/202 = aceptado. Otros códigos: revisar la llave o el keyLocation.
  process.exit(res.status >= 200 && res.status < 300 ? 0 : 1);
}

main().catch((e) => {
  console.error("Error en IndexNow:", e.message);
  process.exit(1);
});
