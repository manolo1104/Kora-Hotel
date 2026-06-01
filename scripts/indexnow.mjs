// Notifica a IndexNow (Bing, Yandex y motores que alimentan a Copilot/ChatGPT)
// todas las URLs del sitemap en vivo. Úsalo tras cada deploy: `npm run indexnow`.
//
// La llave vive en public/<KEY>.txt (debe estar publicada en el dominio).

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const KEY = "a40e702ec65b92696674e8c3a8b1223a";

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
