import { INDEXNOW_KEY } from "./indexnow-key.mjs";
// Ping a IndexNow (Bing, Yandex y los motores que alimentan a Copilot/ChatGPT)
// para que descubran una URL nueva en minutos en vez de días. Si falla, no rompe
// nada — el sitemap y scripts/indexnow.mjs siguen cubriendo.
// La llave sale de lib/indexnow-key.mjs, que es también la que da nombre al
// archivo de public/. Antes estaba escrita a mano aquí Y en el script.
//
// NO es fire-and-forget: quien la llama debe hacerle `await`. En Vercel una
// petición lanzada sin esperar se congela cuando la función responde, así que el
// ping "de mejor esfuerzo" no salía casi nunca — que es distinto de "salió y
// falló". El tope de 3 s es lo que hace que esperarlo sea barato.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const KEY = INDEXNOW_KEY;

export async function pingIndexNow(rutas: string[]): Promise<void> {
  const urlList = rutas.filter(Boolean).map((r) => (r.startsWith("http") ? r : `${SITE}${r}`));
  if (urlList.length === 0) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      signal: AbortSignal.timeout(3000),
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE).host,
        key: KEY,
        keyLocation: `${SITE}/${KEY}.txt`,
        urlList,
      }),
    });
  } catch (e) {
    // No lanza a propósito: indexar es mejor-esfuerzo y publicar no puede fallar
    // por esto. Pero deja rastro: antes ni eso.
    console.error("[indexnow] ping falló:", e instanceof Error ? e.message : e);
  }
}
