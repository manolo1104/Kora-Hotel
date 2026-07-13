// fleet.js — de qué hoteles arranca Camila.
//
// Fuente principal: el endpoint protegido /api/bots/fleet de Kora (con
// BOT_FLEET_SECRET). Así, cuando un hotel activa su bot en el panel, aparece
// aquí sin tocar el runtime. Fallback para pruebas/local: KORA_FLEET, un JSON
// con la lista puesta a mano.

const KORA_BASE = (process.env.KORA_BASE_URL || "https://kora-hotel.com").replace(/\/+$/, "");

/**
 * @returns {Promise<Array<{id:string,slug:string,nombre:string,token:string,whatsapp:string|null,lang:"es"|"en"}>>}
 */
export async function loadFleet() {
  // Fallback explícito por env (útil en local, o para forzar un solo hotel).
  const raw = process.env.KORA_FLEET;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.filter((h) => h && h.slug && h.token);
      }
    } catch (e) {
      console.error("[fleet] KORA_FLEET no es JSON válido:", e.message);
    }
  }

  const secret = process.env.BOT_FLEET_SECRET;
  if (!secret) {
    console.error("[fleet] falta BOT_FLEET_SECRET (y no hay KORA_FLEET). Sin hoteles.");
    return [];
  }

  try {
    const res = await fetch(`${KORA_BASE}/api/bots/fleet`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    if (!res.ok) {
      console.error(`[fleet] /api/bots/fleet respondió ${res.status}`);
      return [];
    }
    const data = await res.json();
    const hotels = Array.isArray(data.hotels) ? data.hotels : [];
    return hotels.filter((h) => h && h.slug && h.token);
  } catch (e) {
    console.error("[fleet] error consultando el fleet:", e.message);
    return [];
  }
}
