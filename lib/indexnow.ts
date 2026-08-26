// Ping a IndexNow (Bing, Yandex y los motores que alimentan a Copilot/ChatGPT)
// para que descubran una URL nueva en minutos en vez de días. Si falla, no rompe
// nada — el sitemap y scripts/indexnow.mjs siguen cubriendo.
// Misma llave que el script manual (public/{KEY}.txt).
//
// NO es fire-and-forget: quien la llama debe hacerle `await`. En Vercel una
// petición lanzada sin esperar se congela cuando la función responde, así que el
// ping "de mejor esfuerzo" no salía casi nunca — que es distinto de "salió y
// falló". El tope de 3 s es lo que hace que esperarlo sea barato.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const KEY = "a40e702ec65b92696674e8c3a8b1223a";

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
