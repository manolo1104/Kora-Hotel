// kora.js — cliente de la plataforma Kora para UN hotel.
//
// Todo lo específico del hotel (cuartos, precios, disponibilidad, cobro) vive en
// Kora, no aquí. Este módulo es la única puerta a `/api/agent`: con el token del
// hotel pide conocimiento, checa disponibilidad y cierra reservas (link de pago
// de Stripe). El cerebro (brain.js) nunca inventa datos: siempre pasa por aquí.

const KORA_BASE = (process.env.KORA_BASE_URL || "https://kora-hotel.com").replace(/\/+$/, "");
const KNOWLEDGE_TTL_MS = Number(process.env.KORA_KNOWLEDGE_TTL_MS || 15 * 60 * 1000); // 15 min
// Estado on/off del bot: caché corta para que "apagar" (panel o comando) surta
// efecto en vivo sin golpear la API en cada mensaje.
const STATUS_TTL_MS = Number(process.env.KORA_BOT_STATUS_TTL_MS || 45 * 1000); // 45 s

export class KoraHotel {
  /** @param {{ id?: string, slug: string, nombre: string, token: string, lang?: "es"|"en" }} hotel */
  constructor(hotel) {
    this.id = hotel.id || hotel.slug;
    this.slug = hotel.slug;
    this.nombre = hotel.nombre;
    this.token = hotel.token;
    this.lang = hotel.lang === "en" ? "en" : "es";
    this._knowledge = null;
    this._knowledgeAt = 0;
    this._status = null; // { enabled, adminPhone }
    this._statusAt = 0;
  }

  // POST base a /api/agent. `conv` (teléfono/chat) alimenta las métricas del
  // panel sin doble conteo. Devuelve el JSON o lanza si la red/servidor falla.
  async _post(body) {
    const res = await fetch(`${KORA_BASE}/api/agent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // SEGUNDO FACTOR. El `agent_token` identifica al hotel, pero es una sola
        // credencial: si se filtra, quien la tenga puede apagar a Camila o
        // generar links de pago y bloquear cuartos a nombre del hotel. Este
        // secreto lo tiene el RUNTIME (Railway), no el token, así que un token
        // filtrado se queda de sólo lectura: sirve para leer el cerebro del
        // hotel —que ya es público en su sitio— y para nada más.
        //
        // No es un rate limit: en Vercel Hobby, sin Redis, un contador en
        // memoria es decorativo (cada petición puede caer en otra instancia).
        // Un segundo factor con un secreto que YA existe es más barato y no
        // depende de infraestructura que no hay.
        authorization: `Bearer ${process.env.BOT_FLEET_SECRET || ""}`,
      },
      body: JSON.stringify({ token: this.token, ...body }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* respuesta no-JSON */
    }
    if (!res.ok) {
      // 401 (token inválido) / 4xx-5xx: lo propagamos con el código para diagnóstico.
      const err = new Error(`kora ${res.status}: ${(data && data.error) || "error"}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data ?? {};
  }

  /** Conocimiento del hotel (cuartos, precios "desde", amenidades, FAQs, guía).
   *  Se cachea `KNOWLEDGE_TTL_MS` para no golpear la API en cada mensaje. */
  async knowledge({ conv } = {}) {
    const fresh = this._knowledge && Date.now() - this._knowledgeAt < KNOWLEDGE_TTL_MS;
    if (fresh) return this._knowledge;
    const data = await this._post(conv ? { conv } : {});
    this._knowledge = data;
    this._knowledgeAt = Date.now();
    return data;
  }

  /** Estado on/off del bot + número admin autorizado. Se cachea STATUS_TTL_MS.
   *  Fail-open: si la API falla, se asume encendido (un hipo de red no debe
   *  silenciar a Camila). Devuelve { enabled:boolean, adminPhone:string|null }. */
  async status() {
    const fresh = this._status && Date.now() - this._statusAt < STATUS_TTL_MS;
    if (fresh) return this._status;
    try {
      const data = await this._post({ action: "status" });
      this._status = {
        enabled: data.enabled !== false,
        adminPhone: typeof data.adminPhone === "string" ? data.adminPhone : null,
      };
    } catch {
      this._status = this._status || { enabled: true, adminPhone: null };
    }
    this._statusAt = Date.now();
    return this._status;
  }

  /** Enciende/apaga el bot (comando del número admin). Escribe el mismo
   *  config.bot_enabled que el panel. Devuelve true si se aplicó. */
  async setEnabled(enabled) {
    try {
      const data = await this._post({ action: "set-status", enabled: Boolean(enabled) });
      const ok = data && data.ok !== false;
      if (ok) {
        this._status = {
          enabled: Boolean(enabled),
          adminPhone: (this._status && this._status.adminPhone) || null,
        };
        this._statusAt = Date.now();
      }
      return ok;
    } catch {
      return false;
    }
  }

  /** Disponibilidad real por fechas (YYYY-MM-DD). Devuelve cuartos con id,
   *  nombre, capacidad y total de la estancia. */
  async availability(checkin, checkout, { conv } = {}) {
    return this._post({ action: "availability", checkin, checkout, ...(conv ? { conv } : {}) });
  }

  /** Guarda el texto de un turno (mensaje del huésped + respuesta de Camila) en
   *  Kora para poder analizarlo después. Fire-and-forget: nunca lanza ni bloquea
   *  la conversación; un fallo de red aquí no debe afectar al huésped. */
  async logConversacion({ conv, turnos } = {}) {
    if (!conv || !Array.isArray(turnos) || turnos.length === 0) return;
    try {
      await this._post({ action: "log-conv", conv, turnos });
    } catch {
      /* la captura es best-effort; no rompe la conversación */
    }
  }

  /** Cierra la reserva: aparta el cuarto y genera link de pago. `ok:false` trae
   *  un código de error de negocio que el cerebro traduce al huésped. */
  async reservar(params, { conv } = {}) {
    return this._post({
      action: "reservar",
      lang: this.lang,
      ...params,
      ...(conv ? { conv } : {}),
    });
  }
}
