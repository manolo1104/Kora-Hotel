// index.js — runtime de Camila (multi-tenant) para los hoteles de Kora.
//
// Arranca UNA sesión de WhatsApp por hotel (whatsapp-web.js + Chromium) y
// conecta cada mensaje entrante con el cerebro (brain.js), que a su vez habla
// con /api/agent usando el token de ESE hotel. Corre en Railway (proceso
// persistente); NO puede vivir en Vercel (serverless no aguanta un navegador).
//
// Primera vez por hotel: se escanea un QR con el teléfono del hotel. Después el
// login queda guardado en el disco persistente (.wwebjs_auth) y no vuelve a pedirlo.

import "dotenv/config"; // carga agentes/camila/.env (en Railway las envs vienen de la plataforma)
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import { createServer } from "node:http";
import path from "node:path";
import { rmSync, existsSync, renameSync } from "node:fs";
import { loadFleet } from "./fleet.js";
import { KoraHotel } from "./kora.js";
import { handleTurn } from "./brain.js";

const DATA_PATH = process.env.WWEBJS_DATA_PATH || "./.wwebjs_auth";
const PORT = Number(process.env.PORT || 3001);
const FLEET_SECRET = process.env.BOT_FLEET_SECRET || "";
const MESSAGE_WAIT_MS = Number(process.env.MESSAGE_DEBOUNCE_MS || 2500);
const HUMAN_TAKEOVER_MS = Number(process.env.HUMAN_TAKEOVER_MS || 60 * 60 * 1000); // 1 h
const CHROMIUM = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

// Estado por hotel para la página de estado/QR.
/** @type {Map<string, {slug:string,nombre:string,status:string,qr:string|null,err:string|null}>} */
const estado = new Map();
// Conversación por chat: `${slug}::${chatId}` -> mensajes (formato Anthropic).
const historiales = new Map();
// Debounce por chat: `${slug}::${chatId}` -> { textos, timer }.
const pendientes = new Map();
// "Toma humana": chat en pausa hasta timestamp.
const pausados = new Map();
// Ventana para no confundir el envío del propio bot con una respuesta humana.
const botEnvioAt = new Map();
// Y el TEXTO de ese último envío: la ventana de tiempo sola falla si WhatsApp
// tarda en confirmar, y entonces Camila se pausaba a sí misma.
const ultimoEnvioBot = new Map();
// Clientes de WhatsApp VIVOS por hotel: slug -> Client. Fuente de verdad de qué
// hoteles está atendiendo Camila ahora mismo (para arrancar/apagar en caliente).
// slug -> { client, kora }. Guarda TAMBIÉN el KoraHotel para poder refrescarle
// el token en cada pasada del fleet (K-289): antes sólo se guardaba el Client y
// el token quedaba congelado desde el arranque, así que rotar tokens habría
// dejado muda a Camila en todos los hoteles a la vez.
const clientes = new Map();
// Cada cuánto re-consultar el fleet para arrancar hoteles nuevos (registros en
// prueba) y apagar los que caen (prueba vencida sin pago, bot apagado).
const FLEET_POLL_MS = Number(process.env.FLEET_POLL_MS || 5 * 60 * 1000); // 5 min

// Cuántas veces se vuelve a intentar levantar un hotel cuyo arranque falló.
// Con el poll de 5 min son ~25 minutos de reintentos: cubre de sobra un fallo
// pasajero de recursos, y evita quemar CPU con un hotel roto de verdad.
const MAX_REINTENTOS_ARRANQUE = 5;

// Pausa entre arrancar un hotel y el siguiente: cada uno abre su propio
// Chromium y lanzarlos todos a la vez es lo que tumba los arranques.
const ARRANQUE_ESCALON_MS = Number(process.env.ARRANQUE_ESCALON_MS || 8000);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Turnos EN CURSO por chat: `${slug}::${chatId}` -> Promise.
//
// Sin candado (K-336), dos mensajes separados por más de MESSAGE_DEBOUNCE_MS se
// procesaban en paralelo sobre el MISMO historial: los dos leían la misma foto y
// el segundo `historiales.set` pisaba al primero. Resultado: un turno entero
// desaparecido del hilo, y Camila contestando sin acordarse de lo que acababa de
// decir. Aquí se serializan por chat, que es la unidad natural.
const enCurso = new Map();

// Los cuatro Maps de arriba viven en un proceso que corre semanas sin reiniciar
// y NADIE los limpiaba (K-170): cada chat nuevo dejaba su historial dentro para
// siempre. Se purga lo que no se ha tocado en 6 h, en la misma pasada del fleet.
const CHAT_TTL_MS = Number(process.env.CHAT_TTL_MS || 6 * 60 * 60 * 1000); // 6 h

/** Última actividad por chat, para saber qué purgar. */
const ultimaActividad = new Map();

function purgarChatsInactivos() {
  const corte = Date.now() - CHAT_TTL_MS;
  let n = 0;
  for (const [key, at] of [...ultimaActividad.entries()]) {
    if (at > corte) continue;
    // Un turno a medias NO se purga: se acabaría borrando su historial debajo.
    if (enCurso.has(key)) continue;
    const pend = pendientes.get(key);
    if (pend && pend.timer) clearTimeout(pend.timer);
    historiales.delete(key);
    pendientes.delete(key);
    pausados.delete(key);
    botEnvioAt.delete(key);
    ultimoEnvioBot.delete(key);
    acusesNoTexto.delete(key);
    ultimaActividad.delete(key);
    n += 1;
  }
  if (n) console.log(`[camila] purgados ${n} chat(s) sin actividad en ${Math.round(CHAT_TTL_MS / 3600000)} h`);
}

// ── Comando de control desde el número admin (apagar/encender por WhatsApp) ──
function soloDigitos(s) {
  return String(s || "").replace(/\D/g, "");
}
// Coincide con el número admin tolerando lada/país (52/521 en MX): compara los
// últimos 10 dígitos. El admin debe escribir desde un número normal (@c.us);
// los @lid no exponen el teléfono real de forma fiable.
function mismoNumero(chatId, adminPhone) {
  const a = soloDigitos(String(chatId).split("@")[0]);
  const b = soloDigitos(adminPhone);
  if (!a || !b || b.length < 10) return false;
  const n = Math.min(10, a.length, b.length);
  return a.slice(-n) === b.slice(-n);
}
// Reconoce un comando SOLO si el mensaje es esencialmente la orden (con "camila"
// opcional al inicio). Así el dueño no apaga el bot por escribir texto normal.
function parseComando(texto) {
  let t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  t = t.replace(/^camila[\s,:-]*/, "").replace(/[.!¡¿?]+$/g, "").trim();
  const OFF = ["apagar", "apaga", "apagate", "pausar", "pausa", "off", "desactivar", "detente", "detener", "silencio"];
  const ON = ["encender", "enciende", "prender", "prende", "activar", "activa", "on", "reanudar", "reanuda", "despierta"];
  if (OFF.includes(t)) return "off";
  if (ON.includes(t)) return "on";
  return null;
}

// Borra "candados" viejos del perfil de Chromium (si un contenedor anterior no
// cerró bien, deja un SingletonLock que impide arrancar: "Code 21"). Auto-recuperable.
function limpiarLocks(slug) {
  const dir = path.join(DATA_PATH, `session-${slug}`);
  for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket", "DevToolsActivePort"]) {
    try {
      rmSync(path.join(dir, f), { force: true, recursive: true });
    } catch {
      /* no-op */
    }
  }
}

/**
 * La sesión de WhatsApp se guarda por SLUG, y los slugs se reutilizan: al borrar
 * un hotel su slug queda libre y `crear-hotel` se lo puede dar a otro. Ese hotel
 * nuevo heredaba la sesión de WhatsApp del anterior — o sea, el número y los
 * chats de un hotel que ya no es suyo.
 *
 * El uuid del hotel no se reutiliza jamás, así que la sesión pasa a llamarse por
 * él. Y para no obligar a los cinco hoteles a re-escanear su QR, la carpeta
 * vieja se RENOMBRA sola la primera vez. El plan pedía hacer esto a mano con el
 * runtime apagado; renombrar aquí no necesita ventana de mantenimiento ni que
 * nadie se acuerde del paso.
 */
function migrarSesion(slug, id) {
  if (!slug || !id || slug === id) return;
  const vieja = path.join(DATA_PATH, `session-${slug}`);
  const nueva = path.join(DATA_PATH, `session-${id}`);
  try {
    if (existsSync(vieja) && !existsSync(nueva)) {
      renameSync(vieja, nueva);
      console.log(`[${slug}] sesión migrada a session-${id} (el QR no hay que re-escanearlo)`);
    }
  } catch (e) {
    // Si falla, el hotel pide QR de nuevo una vez: molesto, nunca peligroso.
    console.error(`[${slug}] no se pudo migrar la sesión:`, e && e.message);
  }
}

function arrancarHotel(hotel) {
  const slug = hotel.slug;
  const kora = new KoraHotel(hotel);
  estado.set(slug, { slug, nombre: hotel.nombre, status: "starting", qr: null, err: null });
  migrarSesion(slug, hotel.id);
  limpiarLocks(hotel.id || slug);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: hotel.id || slug, dataPath: DATA_PATH }),
    puppeteer: {
      headless: true,
      executablePath: CHROMIUM,
      protocolTimeout: 120000, // tolera arranques lentos de Chromium (evita "callFunctionOn timed out")
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
      ],
    },
  });

  client.on("qr", async (qr) => {
    console.log(`\n[${slug}] Escanea este QR con el WhatsApp del hotel:`);
    qrcodeTerminal.generate(qr, { small: true });
    const st = estado.get(slug);
    if (st) {
      st.status = "qr";
      try {
        st.qr = await QRCode.toDataURL(qr);
      } catch {
        st.qr = null;
      }
    }
  });

  client.on("ready", () => {
    console.log(`[${slug}] ✅ Camila conectada (${hotel.nombre}).`);
    const st = estado.get(slug);
    if (st) {
      st.status = "ready";
      st.qr = null;
      st.err = null;
      // Volver a estar arriba BORRA el historial de intentos. Sin esto, ahora
      // que también se reintenta tras una desconexión, un hotel que se cayera
      // cinco veces a lo largo de meses —cada una recuperada sin problema— se
      // quedaría marcado para siempre y a la sexta ya nadie lo levantaría.
      // El tope es para un hotel que no consigue arrancar, no para uno que vive.
      st.intentos = 0;
      st.avisado = false;
    }
  });

  client.on("auth_failure", (m) => {
    console.error(`[${slug}] auth_failure:`, m);
    const st = estado.get(slug);
    if (st) {
      st.status = "auth_failure";
      st.err = String(m);
    }
  });

  client.on("disconnected", (reason) => {
    console.error(`[${slug}] desconectado:`, reason);
    const st = estado.get(slug);
    if (st) st.status = "disconnected";
    // whatsapp-web.js reintenta reconectar solo; si no, Railway reinicia el proceso.
  });

  // Mensajes ENTRANTES del huésped.
  client.on("message", async (msg) => {
    try {
      await onMensaje(client, slug, kora, msg);
    } catch (e) {
      console.error(`[${slug}] error en message:`, e && e.message);
    }
  });

  // TOMA HUMANA: si alguien del hotel contesta a mano, Camila se calla en ese
  // chat y deja hablar a la persona.
  //
  // Estaba APAGADA porque `fromMe` no es fiable: con el formato @lid,
  // whatsapp-web.js marca como propios mensajes ENTRANTES, así que el mensaje de
  // un huésped pausaba su propio chat y Camila se quedaba muda sin causa
  // aparente. La consecuencia de tenerla apagada también es mala: la
  // recepcionista contesta "te lo dejo en $1,800" y Camila responde encima con
  // el precio de sistema — dos precios distintos del mismo hotel en el mismo
  // minuto.
  //
  // No se reactiva la señal rota: se cruza con dos que sí lo son.
  //   1. `msg.to` tiene que ser el HUÉSPED, no nosotros. En un saliente de
  //      verdad el destino es el chat del huésped; en un entrante mal
  //      etiquetado, el destino somos nosotros. Es lo que distingue los dos
  //      casos que `fromMe` confunde.
  //   2. El texto no puede ser el que Camila acaba de mandar (además de la
  //      ventana de tiempo, que sola falla si el envío tarda).
  //
  // Y falla hacia el lado seguro: si no sabemos cuál es nuestro propio número
  // —`client.info` aún no está listo— NO se pausa. En el peor caso se comporta
  // como hasta ahora, que es el comportamiento que hoy está en producción.
  client.on("message_create", (msg) => {
    if (process.env.CAMILA_HUMAN_TAKEOVER === "0") return; // válvula de escape
    if (!msg.fromMe) return;
    const chatId = msg.to;
    if (!chatId || chatId.endsWith("@g.us") || chatId.endsWith("@broadcast")) return;

    const propio = client.info && client.info.wid && client.info.wid._serialized;
    if (!propio) return; // sin saber quiénes somos, no se pausa nada
    if (chatId === propio) return; // entrante mal etiquetado como propio

    // Evita pausar por mensajes VIEJOS que WhatsApp reproduce al sincronizar
    // cuando se vincula el dispositivo (si no, arranca en pausa sin razón).
    if (msg.timestamp && Date.now() / 1000 - msg.timestamp > 120) return;

    const key = `${slug}::${chatId}`;
    const reciénBot = Date.now() - (botEnvioAt.get(key) || 0) < 8000;
    const mismoTexto = (msg.body || "").trim() === (ultimoEnvioBot.get(key) || "");
    if (reciénBot || mismoTexto) return; // lo mandó Camila, no una persona

    pausados.set(key, Date.now() + HUMAN_TAKEOVER_MS);
    console.log(
      `[${slug}] toma humana en ${chatId} — Camila en pausa ${Math.round(HUMAN_TAKEOVER_MS / 60000)} min.`,
    );
  });

  client.initialize().catch((e) => {
    console.error(`[${slug}] no se pudo inicializar:`, e && e.message);
    const st = estado.get(slug);
    if (st) {
      st.status = "error";
      st.err = String(e && e.message);
      st.errAt = new Date().toISOString();
    }
  });

  return { client, kora };
}

// Cuándo se acusó por última vez un mensaje que no es texto, por chat. Evita
// seis avisos idénticos si alguien manda seis fotos seguidas.
const acusesNoTexto = new Map();
const ACUSE_NO_TEXTO_MS = 30 * 60 * 1000; // 30 min

/**
 * Qué contestar a un mensaje que no es texto. `null` = no merece acuse.
 *
 * El tono es el de alguien que no puede hacer algo y lo dice sin drama, dejando
 * clara la salida. Nada de "no soporto ese formato".
 */
function respuestaPorTipo(tipo) {
  switch (tipo) {
    case "ptt": // nota de voz
    case "audio":
      return "¡Hola! Todavía no puedo escuchar notas de voz 🙈 ¿Me lo escribes y te contesto enseguida?";
    case "image":
    case "document":
      return "Recibí tu archivo 📎 Todavía no puedo abrirlo, pero ya queda en la conversación del hotel. Si es un comprobante de pago, cuéntame por aquí a nombre de quién es la reserva y qué fechas, y le doy seguimiento.";
    case "video":
      return "Recibí tu video 🎥 Todavía no puedo verlo. ¿Me cuentas por aquí en qué te ayudo?";
    case "location":
      return "¡Gracias por la ubicación! 📍 Si quieres saber cómo llegar al hotel o si tenemos lugar para tus fechas, dime y te ayudo.";
    default:
      return null; // stickers, reacciones, contactos y demás: no hace falta acusar
  }
}

async function onMensaje(client, slug, kora, msg) {
  const chatId = msg.from;
  // Solo chats individuales: descarta grupos (@g.us) y difusión de estado.
  // Acepta @c.us Y @lid: WhatsApp usa @lid en cuentas nuevas; si solo
  // aceptáramos @c.us, esos mensajes se caerían en silencio.
  if (!chatId) return;
  if (chatId.endsWith("@g.us") || chatId.endsWith("@broadcast")) return;
  if (msg.fromMe) return;
  console.log(`[${slug}] 📩 mensaje de ${chatId} (tipo ${msg.type})`);

  // NADA SE DESCARTA EN SILENCIO.
  //
  // Antes, todo lo que no fuera texto se tiraba aquí sin contestar: audio, foto,
  // ubicación, documento, sticker. En México media clientela pregunta por nota
  // de voz, y el propio prompt le pide al huésped que mande la FOTO de su
  // comprobante de transferencia — o sea que el flujo de pago que Camila
  // propone terminaba en un silencio absoluto. Para el huésped, el hotel
  // simplemente no contestó.
  //
  // Camila todavía no oye ni ve, y decirlo es mucho mejor que callar: mantiene
  // viva la conversación y le dice qué hacer para seguir.
  if (msg.type !== "chat") {
    const st = await kora.status();
    if (!st.enabled) return;
    const respuesta = respuestaPorTipo(msg.type);
    if (!respuesta) return; // sin acuse para lo que no lo merece (stickers, etc.)
    const key = `${slug}::${chatId}`;
    // Una vez por chat cada media hora: si alguien manda seis fotos seguidas no
    // recibe seis avisos idénticos.
    const ultimo = acusesNoTexto.get(key) || 0;
    if (Date.now() - ultimo < ACUSE_NO_TEXTO_MS) return;
    acusesNoTexto.set(key, Date.now());
    ultimaActividad.set(key, Date.now());
    botEnvioAt.set(key, Date.now());
    ultimoEnvioBot.set(key, respuesta);
    await client
      .sendMessage(chatId, respuesta)
      .catch((e) => console.error(`[${slug}] no pude acusar un ${msg.type}:`, e && e.message));
    return;
  }

  const texto = (msg.body || "").trim();
  if (!texto) return;

  const key = `${slug}::${chatId}`;

  // Estado on/off del bot (cacheado ~45s) + número admin autorizado.
  const st = await kora.status();

  // Comando de control desde el número admin: "apagar" / "encender" por WhatsApp.
  if (st.adminPhone && mismoNumero(chatId, st.adminPhone)) {
    const cmd = parseComando(texto);
    if (cmd) {
      const encender = cmd === "on";
      const ok = await kora.setEnabled(encender);
      const resp = ok
        ? encender
          ? "✅ Camila encendida. Vuelvo a responder a tus huéspedes."
          : // "escribe *encender*" era imposible de cumplir: apagar el bot lo
            // saca del fleet, y en la siguiente pasada (≤5 min) el runtime
            // destruye su sesión de WhatsApp. A partir de ahí nadie escucha ese
            // número, así que el mensaje del dueño no llega a ninguna parte. Se
            // le dice la verdad: hay una ventana corta, y después el panel.
            "🔕 Camila apagada. No responderé a tus huéspedes hasta que la enciendas de nuevo desde tu panel, en la pantalla de Camila."
        : "No pude cambiar el estado ahora, inténtalo de nuevo.";
      botEnvioAt.set(key, Date.now());
      // Si el acuse no sale, el dueño no sabe si su "apagar" surtió efecto (el
      // estado SÍ cambió arriba). Tragarse el fallo dejaba al dueño creyendo
      // que Camila sigue encendida, o al revés.
      await client
        .sendMessage(chatId, resp)
        .catch((e) => console.error(`[${slug}] no pude confirmarle el comando al dueño:`, e && e.message));
      console.log(`[${slug}] comando admin de ${chatId}: ${cmd} (${ok ? "ok" : "falló"})`);
      return;
    }
  }

  // Apagado EN VIVO: si el dueño apagó a Camila (panel o comando), no responde
  // aunque siga conectada. Fail-open lo maneja kora.status().
  if (!st.enabled) return;

  // ¿Chat en pausa por toma humana? Ignora hasta que expire.
  const pausadoHasta = pausados.get(key) || 0;
  if (Date.now() < pausadoHasta) return;
  if (pausadoHasta) pausados.delete(key);

  // Debounce: agrupa mensajes seguidos para tener el contexto completo.
  const p = pendientes.get(key) || { textos: [] };
  p.textos.push(texto);
  if (p.timer) clearTimeout(p.timer);
  p.timer = setTimeout(() => {
    pendientes.delete(key);
    procesar(client, slug, kora, chatId, p.textos.join("\n")).catch((e) =>
      console.error(`[${slug}] error procesando:`, e && e.message),
    );
  }, MESSAGE_WAIT_MS);
  pendientes.set(key, p);
}

// Silencio DECLARADO, no error tragado: el fallo del turno anterior ya se
// reporta en su propio `await turno` (más abajo). Encadenamos aquí sólo para que
// un turno que revienta no rompa la cola del siguiente huésped. Tiene nombre
// para que se distinga de un `.catch(() => {})` de los que sí esconden fallos.
function yaSeReportoEnSuTurno() {}

async function procesar(client, slug, kora, chatId, userText) {
  const key = `${slug}::${chatId}`;
  // Un turno por chat a la vez. Si ya hay uno vivo, éste espera a que termine en
  // vez de correr en paralelo y pisarle el historial.
  const anterior = enCurso.get(key);
  const turno = (anterior ? anterior.catch(yaSeReportoEnSuTurno) : Promise.resolve()).then(() =>
    procesarTurno(client, slug, kora, chatId, userText),
  );
  enCurso.set(key, turno);
  try {
    await turno;
  } finally {
    // Sólo lo borra el ÚLTIMO de la cola: si no, un turno que termina mientras
    // otro espera dejaría al siguiente sin candado.
    if (enCurso.get(key) === turno) enCurso.delete(key);
  }
}

async function procesarTurno(client, slug, kora, chatId, userText) {
  const key = `${slug}::${chatId}`;
  ultimaActividad.set(key, Date.now());
  const hotel = { slug, nombre: kora.nombre, whatsapp: kora.whatsapp };

  const chat = await client.getChatById(chatId).catch(() => null);
  // Los dos `.catch` del indicador de "escribiendo…" son cosméticos: si fallan,
  // el huésped ve la respuesta igual. Se registran en warn (no error) para que
  // un fallo masivo se note en Railway, pero no ensucian el log normal.
  if (chat) chat.sendStateTyping().catch((e) => console.warn(`[${slug}] sendStateTyping:`, e && e.message));

  const conv = chatId.split("@")[0]; // teléfono → métrica sin doble conteo

  // Si no hay historial en memoria, se intenta recuperar el de Kora antes de
  // contestar. Pasa después de cada despliegue y tras la purga de 6 h: sin esto,
  // Camila saludaba de cero a alguien que llevaba media reserva hecha.
  let history = historiales.get(key);
  if (!history) {
    history = await kora.historial({ conv });
    if (history.length) {
      console.log(`[${slug}] historial de ${conv} recuperado (${history.length} mensajes)`);
    }
    historiales.set(key, history);
  }

  // EL HUÉSPED NUNCA SE QUEDA EN SILENCIO.
  //
  // Si la llamada al modelo reventaba —sobrecarga de la API, corte de red, cuota
  // agotada— el error subía hasta un `console.error` y ahí moría. El mensaje del
  // huésped ya se había sacado de la cola, así que tampoco se reintentaba. Y
  // como el "escribiendo…" se apaga DESPUÉS de la llamada, se quedaba encendido
  // hasta que WhatsApp lo tiraba solo: el huésped veía "Camila está
  // escribiendo…", esperaba, y no llegaba nada. Es peor que un error — parece
  // que lo están ignorando a propósito.
  let reply = "";
  let nuevo = history;
  try {
    ({ reply, history: nuevo } = await handleTurn({ hotel, kora, history, userText, conv }));
  } catch (e) {
    console.error(`[${slug}] el turno de ${conv} falló:`, e && e.message);
    if (chat) chat.clearState().catch(() => {});
    // La misma frase honesta que ya se usa cuando no se puede leer el cerebro:
    // no promete nada y deja una salida humana si el hotel tiene WhatsApp.
    const tel = (kora.whatsapp || "").trim();
    const disculpa = tel
      ? `Perdón, se me complicó responderte. Escríbele al hotel al ${tel} y te atienden enseguida.`
      : "Perdón, se me complicó responderte. ¿Me escribes de nuevo en un minuto?";
    botEnvioAt.set(key, Date.now());
    await client
      .sendMessage(chatId, disculpa)
      .catch((err) => console.error(`[${slug}] tampoco pude disculparme:`, err && err.message));
    return; // el historial NO se guarda: el turno no llegó a existir
  }
  historiales.set(key, nuevo);

  if (chat) chat.clearState().catch((e) => console.warn(`[${slug}] clearState:`, e && e.message));

  const salida = (reply || "").trim();
  if (!salida) return;
  botEnvioAt.set(key, Date.now());
  ultimoEnvioBot.set(key, salida);
  await client.sendMessage(chatId, salida);

  // Guarda el turno (mensaje del huésped + respuesta) para analizarlo después.
  // Fire-and-forget: no esperamos ni dejamos que un fallo afecte la conversación.
  // Pero "no esperar" NO es "no enterarse": callaba el fallo, y la pantalla de
  // conversaciones del hotelero se habría quedado vacía sin que nadie supiera
  // por qué.
  kora
    .logConversacion({
      conv,
      turnos: [
        { rol: "user", texto: userText },
        { rol: "assistant", texto: salida },
      ],
    })
    .catch((e) => console.error(`[${slug}] no se guardó la conversación de ${conv}:`, e && e.message));
}

// ── Servidor de estado/QR + health (Railway hace healthcheck a /health) ──
function servidorEstado() {
  createServer((req, res) => {
    if (req.url === "/health") {
      // UN HEALTHCHECK QUE MIRA LOS HOTELES.
      //
      // Antes respondía "ok" siempre, sin mirar ninguno: bastaba con que el
      // proceso de Node estuviera vivo. O sea que el reinicio automático de
      // Railway —la red de seguridad que el resto del código daba por hecha
      // ("si no, Railway reinicia el proceso")— no se disparaba nunca, ni con
      // todas las sesiones de WhatsApp caídas. El servicio se veía sano
      // mientras ningún huésped recibía respuesta.
      //
      // Con hoteles en la flota, "sano" es que al menos uno esté atendiendo. La
      // flota vacía sí es 200: es el estado legítimo de un despliegue nuevo o de
      // un momento sin hoteles elegibles, y tumbar el servicio por eso lo
      // dejaría reiniciándose en bucle sin arreglar nada.
      const hoteles = [...estado.values()];
      const listos = hoteles.filter((h) => h.status === "ready").length;
      const sano = hoteles.length === 0 || listos > 0;
      res.writeHead(sano ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: sano, hoteles: hoteles.length, listos }));
      return;
    }

    // El candado va ANTES del router: todo lo que no sea /health exige el secreto
    // de flota. Antes vivía dentro de la rama /estado, así que cualquier otra URL
    // (incluida la raíz) caía en la página HTML del final y servía el QR de
    // vinculación de WhatsApp de cada hotel sin pedir nada. El runtime es público
    // por diseño —Vercel le pega desde fuera— y el subdominio de Railway aparece
    // en los registros de certificados, así que no conocerlo no era protección.
    const auth = req.headers["authorization"] || "";
    if (!FLEET_SECRET || auth !== `Bearer ${FLEET_SECRET}`) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "no-autorizado" }));
      return;
    }

    // API JSON para que el panel de Kora muestre el QR/estado de un hotel.
    // GET /estado            → { hotels: [{ slug, nombre, status, qr }] }
    // GET /estado?slug=xxx   → { slug, nombre, status, qr } (o 404)
    if (req.url && req.url.startsWith("/estado")) {
      const url = new URL(req.url, "http://localhost");
      const slug = url.searchParams.get("slug");
      // El QR (dataURL) solo se expone cuando de verdad hay uno que escanear.
      // `err` viaja SÓLO cuando el arranque falló. Sin esto, un hotel cuyo
      // `client.initialize()` reventaba se quedaba en `status:"error"` y el
      // motivo moría en los logs de Railway: el panel decía "estamos preparando
      // tu conexión" y nadie —ni el hotelero ni Kora— sabía qué había pasado.
      // Pasó con un alta real el 31 ago 2026 y costó media hora de logs
      // averiguarlo. Este endpoint ya exige el secreto de flota, así que el
      // detalle no queda expuesto a nadie más.
      const publico = (h) => ({
        slug: h.slug,
        nombre: h.nombre,
        status: h.status,
        qr: h.status === "qr" ? h.qr : null,
        ...(h.status === "error" && h.err ? { err: String(h.err).slice(0, 300) } : {}),
      });
      res.writeHead(200, { "content-type": "application/json" });
      if (slug) {
        const h = estado.get(slug);
        res.end(JSON.stringify(h ? publico(h) : { slug, status: "desconocido", qr: null }));
      } else {
        res.end(JSON.stringify({ hotels: [...estado.values()].map(publico) }));
      }
      return;
    }
    // Aquí vivía una página HTML que listaba toda la flota —nombre y slug de cada
    // hotel— e incrustaba el QR de vinculación de WhatsApp como imagen. Está
    // borrada, no sólo protegida: ese QR es la credencial de emparejamiento, y
    // quien lo escaneara quedaba como dispositivo enlazado del número del hotel,
    // leyendo y contestando a sus huéspedes. Nadie la consumía: el panel de Kora
    // habla con /estado?slug=… (bot-status y bot-qr) y Railway sólo necesita
    // /health. Sin página no hay superficie que proteger.
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "no-encontrado" }));
  }).listen(PORT, () => console.log(`[camila] estado/health en :${PORT}`));
}

// Apaga y limpia por completo a un hotel que salió del fleet (prueba vencida sin
// pago, bot apagado, despublicado). Cierra su sesión de WhatsApp (destroy, NO
// logout: no desvincula el dispositivo, solo deja de atender) y borra su estado.
//
// La carpeta de sesión en disco NO se borra, a propósito: desde aquí no se
// distingue "el hotel se dio de baja" de "se le venció la prueba", y borrarla en
// el segundo caso obligaría a re-escanear el QR el día que pague. El plan pedía
// borrarla "cuando la salida es definitiva", pero esa distinción no existe en la
// información que tiene el runtime.
//
// Y ya no hace falta para lo que importaba: el riesgo era que un hotel NUEVO
// heredara la sesión de uno viejo al reutilizarse el slug. Ahora las sesiones se
// llaman por el uuid del hotel, que no se reutiliza nunca. Lo que queda en disco
// es basura, no una puerta abierta.
async function pararHotel(slug) {
  const { client } = clientes.get(slug) ?? {};
  clientes.delete(slug);
  estado.delete(slug);
  // Limpia el estado por-chat de ese hotel (claves `${slug}::chatId`).
  for (const mapa of [historiales, pendientes, pausados, botEnvioAt, ultimoEnvioBot, acusesNoTexto, ultimaActividad, enCurso]) {
    for (const k of [...mapa.keys()]) {
      if (!k.startsWith(`${slug}::`)) continue;
      const v = mapa.get(k);
      if (v && v.timer) clearTimeout(v.timer); // debounce pendiente
      mapa.delete(k);
    }
  }
  if (client) {
    try {
      await client.destroy();
    } catch (e) {
      console.error(`[${slug}] error al detener:`, e && e.message);
    }
  }
  console.log(`[camila] − ${slug} apagado (fuera del fleet).`);
}

// Re-consulta el fleet y ajusta los hoteles vivos: arranca los nuevos, apaga los
// que salieron. Es lo que hace que un hotel NUEVO conecte en su prueba y uno con
// la prueba VENCIDA (sin pago) se bloquee, sin reiniciar el runtime a mano.
let sincronizando = false;
async function sincronizarFleet() {
  if (sincronizando) return;
  sincronizando = true;
  try {
    const { ok, hotels } = await loadFleet();
    // CLAVE: si no se pudo leer el fleet (red/5xx), NO apagamos nada — un hipo
    // transitorio jamás debe tumbar a los bots vivos. Reintentamos al próximo ciclo.
    if (!ok) {
      console.warn("[camila] no pude leer el fleet; conservo los hoteles actuales.");
      return;
    }
    const enFleet = new Map(hotels.map((h) => [h.slug, h]));
    // Arrancar los que están en el fleet y aún no corren.
    for (const hotel of hotels) {
      const st = estado.get(hotel.slug);

      // UN ARRANQUE FALLIDO NO PUEDE SER DEFINITIVO.
      //
      // `client.initialize()` puede reventar por cosas pasajeras —Chromium sin
      // memoria porque otro hotel estaba arrancando a la vez, la red, un lock
      // suelto—. Cuando pasaba, el slug se quedaba en `clientes`, así que la
      // pasada siguiente caía en el `else` de abajo y sólo le refrescaba el
      // token: NADIE volvía a intentar levantarlo. El hotel quedaba muerto hasta
      // que alguien reiniciara el servicio entero, y su dueño veía «estamos
      // preparando tu conexión» indefinidamente. Le pasó a un alta real el 31 de
      // agosto de 2026.
      // `disconnected` y `auth_failure` cuentan igual que `error`.
      //
      // El reintento sólo miraba `error`, que es el fallo de `initialize()`. Pero
      // un hotel también se cae DESPUÉS de estar arriba: WhatsApp tira la sesión,
      // o alguien desvincula el dispositivo desde el teléfono. En esos dos casos
      // el slug seguía en `clientes`, así que cada pasada del fleet caía en el
      // `else` de abajo y se limitaba a refrescarle el token: nadie lo volvía a
      // levantar nunca. El hotel quedaba mudo hasta que una persona reiniciara el
      // servicio entero, y su dueño veía en el panel un mensaje de "preparando".
      //
      // El comentario de `client.on("disconnected")` prometía dos redes de
      // seguridad —que la librería reconecta sola, y que "si no, Railway
      // reinicia el proceso"— y la segunda no existía: `/health` respondía `ok`
      // sin mirar un solo hotel, así que Railway nunca reiniciaba nada. Aquí se
      // arregla la primera; el `/health` honesto, más abajo.
      const CAIDO = new Set(["error", "disconnected", "auth_failure"]);
      if (st && CAIDO.has(st.status) && clientes.has(hotel.slug)) {
        const intentos = (st.intentos || 0) + 1;
        if (intentos <= MAX_REINTENTOS_ARRANQUE) {
          console.warn(
            `[camila] ↻ reintentando ${hotel.slug} (intento ${intentos}/${MAX_REINTENTOS_ARRANQUE}): ${st.err || "sin motivo"}`,
          );
          await pararHotel(hotel.slug);
          clientes.set(hotel.slug, arrancarHotel(hotel));
          const nuevo = estado.get(hotel.slug);
          if (nuevo) nuevo.intentos = intentos;
        } else if (!st.avisado) {
          // Se deja de reintentar, pero NO en silencio: a partir de aquí hace
          // falta una persona, y el panel ya se lo dice al hotelero.
          st.avisado = true;
          console.error(
            `[camila] ✖ ${hotel.slug} lleva ${intentos - 1} arranques fallidos; se deja de reintentar. Último error: ${st.err}`,
          );
        }
        continue;
      }

      if (!clientes.has(hotel.slug)) {
        console.log(`[camila] + arrancando ${hotel.slug}`);
        clientes.set(hotel.slug, arrancarHotel(hotel));
        // ESCALONAR EL ARRANQUE. Cada hotel levanta su propio Chromium (250-400
        // MB), y este bucle los lanzaba TODOS en el mismo tick. El comentario de
        // aquí arriba ya identifica esa estampida como causa de los arranques
        // fallidos ("Chromium sin memoria porque otro hotel estaba arrancando a
        // la vez") — y los reintentos la repetían igual, así que el remedio
        // reproducía la enfermedad. Unos segundos entre uno y otro no retrasan
        // nada que a un hotelero le importe.
        await esperar(ARRANQUE_ESCALON_MS);
      } else {
        // Ya corre: se le refrescan los datos por si el token se rotó (o
        // cambió el nombre o el idioma del hotel). Sin este `else`, un bot
        // arrancado no volvía a mirar su token nunca más.
        clientes.get(hotel.slug).kora.actualizar(hotel);
      }
    }
    // Apagar los que corren pero ya NO están en el fleet.
    for (const slug of [...clientes.keys()]) {
      if (!enFleet.has(slug)) await pararHotel(slug);
    }
    purgarChatsInactivos();
  } catch (e) {
    console.error("[camila] error sincronizando el fleet:", e && e.message);
  } finally {
    sincronizando = false;
  }
}

async function main() {
  servidorEstado();
  await sincronizarFleet();
  if (!clientes.size) {
    console.warn(
      `[camila] la flota está vacía por ahora; re-consulto cada ${Math.round(
        FLEET_POLL_MS / 60000,
      )} min (revisa BOT_FLEET_SECRET / KORA_FLEET si nunca aparece nadie).`,
    );
  }
  // Re-poll periódico: hoteles nuevos entran en su prueba, vencidos se bloquean.
  setInterval(() => {
    sincronizarFleet().catch((e) => console.error("[camila] re-poll:", e && e.message));
  }, FLEET_POLL_MS);
}

main().catch((e) => {
  console.error("[camila] fallo al arrancar:", e);
  process.exit(1);
});
