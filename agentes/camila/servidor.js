// El servidor HTTP del runtime de Camila: estado/QR, salud, y —desde hoy—
// mandar un mensaje y pausar un chat.
//
// Está fuera de `index.js` por una razón concreta: `index.js` arranca un
// Chromium por hotel en cuanto se importa, así que NADA de lo que vivía dentro
// se podía probar sin escanear un QR. Aquí la decisión («¿este POST puede mandar
// este mensaje?») es una función pura sobre datos, y eso sí entra en las
// pruebas. El I/O —leer el cuerpo, escribir la respuesta— se queda en la capa de
// abajo, que no decide nada.
//
// El candado es el mismo de antes: todo lo que no sea `/health` exige el secreto
// de flota. Y sigue estando ANTES del router, porque en su día una ruta sin
// cubrir servía el QR de vinculación de WhatsApp de cualquier hotel.

import { createServer } from "node:http";

/** Tope del texto que se puede mandar en un mensaje. */
export const MAX_TEXTO = 3000;

const noAutorizado = { status: 401, json: { error: "no-autorizado" } };

/** Lo que se puede enseñar de un hotel sin filtrar credenciales. */
function publico(h) {
  return {
    slug: h.slug,
    nombre: h.nombre,
    status: h.status,
    // El QR sólo cuando de verdad hay uno que escanear: es la credencial de
    // emparejamiento del número del hotel.
    qr: h.status === "qr" ? h.qr : null,
    ...(h.status === "error" && h.err ? { err: String(h.err).slice(0, 300) } : {}),
  };
}

const texto = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Decide qué contestar. PURA: no lee sockets ni escribe respuestas.
 *
 * @param {{ method?:string, url?:string, auth?:string, cuerpo?:Record<string,any> }} peticion
 * @param {{ secreto:string, estado:Map<string,any>, enviar:Function, pausar:Function }} deps
 * @returns {Promise<{ status:number, json?:any, texto?:string }>}
 */
export async function resolver(peticion, deps) {
  const { method = "GET", url = "/", auth = "", cuerpo = {} } = peticion;
  const ruta = String(url).split("?")[0];

  // Railway pega aquí para saber si el proceso vive. Sin auth a propósito: no
  // dice nada de ningún hotel.
  if (ruta === "/health") return { status: 200, texto: "ok" };

  if (!deps.secreto || auth !== `Bearer ${deps.secreto}`) return noAutorizado;

  if (ruta === "/estado" && method === "GET") {
    const slug = texto(new URL(url, "http://localhost").searchParams.get("slug"));
    if (slug) {
      const h = deps.estado.get(slug);
      return { status: 200, json: h ? publico(h) : { slug, status: "desconocido", qr: null } };
    }
    return { status: 200, json: { hotels: [...deps.estado.values()].map(publico) } };
  }

  // ── Mandar un mensaje que escribió una PERSONA desde el panel ──
  //
  // Kora no tiene sesiones de WhatsApp: el único que puede mandar es este
  // proceso, que tiene el Chromium abierto. Por eso existe esta ruta, y por eso
  // contesta con un motivo cuando no puede — el panel lo enseña tal cual en vez
  // de decir «enviado» sobre un mensaje que nadie recibió.
  if (ruta === "/enviar" && method === "POST") {
    const slug = texto(cuerpo.slug);
    const chatId = texto(cuerpo.chatId);
    const mensaje = texto(cuerpo.texto);
    if (!slug || !chatId || !mensaje) {
      return { status: 400, json: { error: "faltan-datos" } };
    }
    if (mensaje.length > MAX_TEXTO) return { status: 400, json: { error: "texto-muy-largo" } };
    // Grupos y difusión no se atienden ni entrando ni saliendo.
    if (chatId.endsWith("@g.us") || chatId.endsWith("@broadcast")) {
      return { status: 400, json: { error: "chat-no-permitido" } };
    }
    // El hotel tiene que estar CONECTADO, no sólo arrancado.
    //
    // `clientes` guarda el Client desde que empieza a levantarse, así que un
    // hotel en `starting`, `qr` o `error` también estaba ahí — y mandarle un
    // `sendMessage` a un Chromium que aún no ha terminado de abrir WhatsApp se
    // queda colgado los 120 s del protocolTimeout y devuelve un error confuso.
    // Pasó en producción con hotel-magico el día del despliegue. Con esto, el
    // panel recibe 409 al instante y dice lo que de verdad ocurre: que no hay
    // WhatsApp conectado.
    const st = deps.estado.get(slug);
    if (!st || st.status !== "ready") {
      return { status: 409, json: { error: "hotel-sin-sesion", estado: (st && st.status) || "desconocido" } };
    }

    const r = await deps.enviar(slug, chatId, mensaje);
    if (!r || !r.ok) {
      // 409 = «este hotel no tiene su WhatsApp levantado aquí». Es distinto de
      // un fallo al mandar, y el panel le dice cosas distintas al hotelero.
      const status = r && r.error === "hotel-sin-sesion" ? 409 : 502;
      return { status, json: { error: (r && r.error) || "no-enviado" } };
    }
    return { status: 200, json: { ok: true } };
  }

  // ── Reflejar en memoria una pausa que el panel ya guardó en la base ──
  // La fuente de verdad es Postgres (el runtime la consulta igualmente); esto
  // sólo evita el hueco de un mensaje que entre antes de que expire la caché.
  if (ruta === "/pausa" && method === "POST") {
    const slug = texto(cuerpo.slug);
    const chatId = texto(cuerpo.chatId);
    if (!slug || !chatId) return { status: 400, json: { error: "faltan-datos" } };
    const hasta = cuerpo.hasta ? Date.parse(cuerpo.hasta) : 0;
    deps.pausar(slug, chatId, Number.isFinite(hasta) && hasta > 0 ? hasta : 0);
    return { status: 200, json: { ok: true } };
  }

  return { status: 404, json: { error: "no-encontrado" } };
}

/** Lee el cuerpo JSON con tope, para que nadie llene la memoria del proceso. */
function leerCuerpo(req, maxBytes = 64 * 1024) {
  return new Promise((resolve) => {
    if (req.method !== "POST") return resolve({});
    let datos = "";
    let abortado = false;
    req.on("data", (trozo) => {
      if (abortado) return;
      datos += trozo;
      if (datos.length > maxBytes) {
        abortado = true;
        resolve({});
      }
    });
    req.on("end", () => !abortado && resolve(parse(datos)));
    req.on("error", () => !abortado && resolve({}));
  });
}

function parse(s) {
  try {
    const v = JSON.parse(s || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Levanta el servidor. Todo lo que decide algo vive en `resolver`. */
export function arrancarServidor(port, deps) {
  return createServer((req, res) => {
    leerCuerpo(req)
      .then((cuerpo) =>
        resolver(
          { method: req.method, url: req.url || "/", auth: req.headers["authorization"] || "", cuerpo },
          deps,
        ),
      )
      .then((r) => {
        if (r.texto !== undefined) {
          res.writeHead(r.status, { "content-type": "text/plain" });
          res.end(r.texto);
          return;
        }
        res.writeHead(r.status, { "content-type": "application/json" });
        res.end(JSON.stringify(r.json));
      })
      .catch((e) => {
        console.error("[camila] error sirviendo:", e && e.message);
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "error-interno" }));
      });
  }).listen(port, () => console.log(`[camila] estado/health/enviar en :${port}`));
}
