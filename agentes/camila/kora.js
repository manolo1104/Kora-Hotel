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
// Techo de cada llamada a Kora. Sin él, un turno colgado bloquea el chat de ese
// huésped indefinidamente por el candado de index.js.
const TIMEOUT_MS = Number(process.env.KORA_TIMEOUT_MS || 20_000);

export class KoraHotel {
  /** @param {{ id?: string, slug: string, nombre: string, token: string, whatsapp?: string|null, lang?: "es"|"en" }} hotel */
  constructor(hotel) {
    this.id = hotel.id || hotel.slug;
    this.slug = hotel.slug;
    this.nombre = hotel.nombre;
    this.token = hotel.token;
    // El WhatsApp humano del hotel. Lo manda el fleet y hace falta cuando NO se
    // puede leer el cerebro: es la única salida que se le puede ofrecer al
    // huésped sin inventarle nada.
    this.whatsapp = hotel.whatsapp || null;
    this.lang = hotel.lang === "en" ? "en" : "es";
    this._knowledge = null;
    this._knowledgeAt = 0;
    this._knowledgeDia = ""; // día (México) con el que se cacheó el cerebro
    this._status = null; // { enabled, adminPhone }
    this._statusAt = 0;
  }

  /**
   * Refresca los datos del hotel desde el fleet: token rotado, nombre o idioma
   * cambiados. Se llama en CADA pasada del fleet sobre los hoteles que ya
   * corren.
   *
   * Sin esto (K-289), un hotel arrancado se quedaba con el token que leyó al
   * arrancar y no volvía a mirarlo NUNCA. O sea: el día que se roten los tokens
   * —que es lo que exige cerrar la fuga de `agent_token`— los bots vivos
   * seguirían mandando el viejo, `/api/agent` respondería 401 a todo, y Camila
   * se quedaría muda en los hoteles a la vez y sin que nadie supiera por qué.
   * Esta función es la que hace que esa rotación sea un trámite y no un apagón.
   *
   * Las cachés se invalidan SÓLO si el token cambió: hacerlo en cada pasada
   * (cada 5 min) dispararía el gasto de `knowledge` sin motivo.
   */
  actualizar(hotel) {
    if (!hotel) return;
    const cambio = this.token !== hotel.token;
    this.token = hotel.token;
    this.nombre = hotel.nombre;
    this.whatsapp = hotel.whatsapp || null;
    this.lang = hotel.lang === "en" ? "en" : "es";
    if (cambio) {
      this._knowledge = null;
      this._knowledgeAt = 0;
      this._knowledgeDia = "";
      this._status = null;
      this._statusAt = 0;
      console.log(`[${this.slug}] token rotado, cachés invalidadas`);
    }
  }

  // POST base a /api/agent. `conv` (teléfono/chat) alimenta las métricas del
  // panel sin doble conteo. Devuelve el JSON o lanza si la red/servidor falla.
  async _post(body) {
    // TIEMPO LÍMITE. Ninguna llamada lo tenía: si Vercel tardaba, el `await` se
    // quedaba esperando sin techo. Y como cada chat tiene un candado que
    // serializa sus turnos (index.js), un solo turno colgado bloqueaba TODO lo
    // que ese huésped escribiera después — sin error, sin log, sin recuperación.
    // 20 s es de sobra: `reservar` es lo más lento y habla con Stripe.
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await this._fetch(body, ctrl.signal);
    } catch (e) {
      // Un abort es un timeout, no un fallo raro: se etiqueta para que quien lo
      // reciba pueda distinguirlo (brain.js lo trata como transitorio).
      if (e && e.name === "AbortError") {
        const err = new Error(`kora timeout tras ${Math.round(TIMEOUT_MS / 1000)}s`);
        err.status = 504;
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(reloj);
    }
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

  /** El fetch en crudo. Separado para que `_post` se lea de un vistazo. */
  async _fetch(body, signal) {
    return fetch(`${KORA_BASE}/api/agent`, {
      method: "POST",
      signal,
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
  }

  /** Conocimiento del hotel (cuartos, precios "desde", amenidades, FAQs, guía).
   *  Se cachea `KNOWLEDGE_TTL_MS` para no golpear la API en cada mensaje. */
  async knowledge({ conv } = {}) {
    // La caché caduca también cuando CAMBIA EL DÍA, no sólo cuando pasan 15 min.
    //
    // El prompt lleva dentro la fecha de hoy ("Hoy es viernes 5 de septiembre")
    // porque Camila la necesita para entender "este finde" o "mañana". Al
    // cachearlo, entre las 00:00 y las 00:15 seguía diciendo que hoy es ayer si
    // algún huésped de ese hotel había escrito justo antes de medianoche. Y el
    // mensaje que llega a esa hora es el más caliente que recibe un hotel de
    // carretera: "¿tienen algo para hoy?". Camila cotizaba la noche de AYER y al
    // cerrar el servidor la cortaba con `fecha-pasada`.
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const fresh =
      this._knowledge &&
      this._knowledgeDia === hoy &&
      Date.now() - this._knowledgeAt < KNOWLEDGE_TTL_MS;
    if (fresh) return this._knowledge;
    const data = await this._post(conv ? { conv } : {});
    this._knowledge = data;
    this._knowledgeAt = Date.now();
    this._knowledgeDia = hoy;
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
    } catch (e) {
      // El fail-open se puso para los hipos de RED y los 5xx: no callar al bot
      // porque Kora tardó un segundo. Pero se tragaba también el 401 y el 403,
      // que no son hipos: 401 = el token murió (lo rotaron, o el hotel se borró);
      // 403 = la cuenta está bloqueada o la prueba venció. En los dos casos, lo
      // correcto es callarse — seguir conversando significa inventarle a un
      // huésped precios y disponibilidad de un hotel del que ya no sabemos nada.
      if (e && (e.status === 401 || e.status === 403)) {
        this._status = { enabled: false, adminPhone: null };
        console.warn(`[${this.slug}] Kora respondió ${e.status}: me callo hasta que se arregle.`);
      } else {
        this._status = this._status || { enabled: true, adminPhone: null };
      }
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
  async availability(checkin, checkout, { conv, huespedes } = {}) {
    // `huespedes` no estaba ni en la firma: aunque brain.js lo hubiera pasado,
    // no habría llegado. La ruta del servidor lleva meses preparada para
    // recibirlo (`app/api/agent/route.ts`, que si no lo ve asume 2), así que
    // este parámetro es lo único que separaba el precio que dice Camila del que
    // cobra Stripe en los hoteles con tarifa por número de personas.
    const n = Math.floor(Number(huespedes));
    return this._post({
      action: "availability",
      checkin,
      checkout,
      ...(Number.isFinite(n) && n > 0 ? { huespedes: n } : {}),
      ...(conv ? { conv } : {}),
    });
  }

  /**
   * Los últimos turnos guardados de un chat, para rehidratar el historial
   * cuando el proceso acaba de arrancar.
   *
   * El historial vive sólo en la memoria del runtime, así que CUALQUIER
   * reinicio de Railway —un despliegue, un fallo, una migración de máquina— lo
   * borraba entero. Un huésped que llevaba ocho mensajes (fechas, cuarto,
   * nombre; sólo faltaba el correo) mandaba el correo y Camila le contestaba
   * «¡Hola! ¿Para qué fechas te gustaría?». La venta se caía ahí.
   *
   * Devuelve `[]` si no hay nada o si algo falla: rehidratar es una mejora, no
   * puede impedir que se conteste.
   */
  async historial({ conv } = {}) {
    if (!conv) return [];
    try {
      const data = await this._post({ action: "historial", conv });
      const turnos = Array.isArray(data && data.turnos) ? data.turnos : [];
      return turnos
        .filter((t) => t && typeof t.texto === "string" && t.texto.trim())
        .map((t) => ({
          role: t.rol === "assistant" ? "assistant" : "user",
          content: t.texto,
        }));
    } catch (e) {
      console.warn(`[${this.slug}] no pude recuperar el historial de ${conv}:`, e && e.message);
      return [];
    }
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
