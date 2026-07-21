// fleet.js — de qué hoteles arranca Camila.
//
// Fuente principal: el endpoint protegido /api/bots/fleet de Kora (con
// BOT_FLEET_SECRET). Así, cuando un hotel activa su bot en el panel, aparece
// aquí sin tocar el runtime. Fallback para pruebas/local: KORA_FLEET, un JSON
// con la lista puesta a mano.

const KORA_BASE = (process.env.KORA_BASE_URL || "https://kora-hotel.com").replace(/\/+$/, "");

/**
 * Devuelve `{ ok, hotels }`.
 *  - `ok:true`  → respuesta CONFIABLE del fleet (aunque `hotels` esté vacío: es
 *                 un "vacío real", p. ej. ningún hotel con acceso).
 *  - `ok:false` → NO se pudo leer el fleet (red caída, 5xx, sin secreto). El
 *                 llamador debe CONSERVAR los hoteles actuales, no apagarlos:
 *                 un hipo transitorio nunca debe tumbar a los bots vivos.
 * @returns {Promise<{ ok: boolean, hotels: Array<{id:string,slug:string,nombre:string,token:string,whatsapp:string|null,lang:"es"|"en"}> }>}
 */
export async function loadFleet() {
  // Fallback explícito por env (útil en local, o para forzar un solo hotel).
  const raw = process.env.KORA_FLEET;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return { ok: true, hotels: arr.filter((h) => h && h.slug && h.token) };
      }
    } catch (e) {
      console.error("[fleet] KORA_FLEET no es JSON válido:", e.message);
    }
  }

  const secret = process.env.BOT_FLEET_SECRET;
  if (!secret) {
    console.error("[fleet] falta BOT_FLEET_SECRET (y no hay KORA_FLEET). Sin hoteles.");
    return { ok: false, hotels: [] };
  }

  try {
    const res = await fetch(`${KORA_BASE}/api/bots/fleet`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    if (!res.ok) {
      console.error(`[fleet] /api/bots/fleet respondió ${res.status}`);
      return { ok: false, hotels: [] };
    }
    const data = await res.json();
    const hotels = Array.isArray(data.hotels) ? data.hotels : [];
    return { ok: true, hotels: hotels.filter((h) => h && h.slug && h.token) };
  } catch (e) {
    console.error("[fleet] error consultando el fleet:", e.message);
    return { ok: false, hotels: [] };
  }
}
