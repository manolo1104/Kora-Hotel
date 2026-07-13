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
import { rmSync } from "node:fs";
import { loadFleet } from "./fleet.js";
import { KoraHotel } from "./kora.js";
import { handleTurn } from "./brain.js";

const DATA_PATH = process.env.WWEBJS_DATA_PATH || "./.wwebjs_auth";
const PORT = Number(process.env.PORT || 3001);
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

function arrancarHotel(hotel) {
  const slug = hotel.slug;
  const kora = new KoraHotel(hotel);
  estado.set(slug, { slug, nombre: hotel.nombre, status: "starting", qr: null, err: null });
  limpiarLocks(slug);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: slug, dataPath: DATA_PATH }),
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

  // Detecta "toma humana": si alguien del hotel responde a mano desde el
  // teléfono, pausamos el bot en ese chat 1 hora. (Los envíos del propio bot se
  // ignoran vía la ventana botEnvioAt.)
  // APAGADO por defecto: con el formato @lid, whatsapp-web.js reporta mal
  // `fromMe` en mensajes entrantes y esto pausaba el chat sin razón, silenciando
  // a Camila. Se activa con CAMILA_HUMAN_TAKEOVER=1 cuando la detección sea fiable.
  client.on("message_create", (msg) => {
    if (process.env.CAMILA_HUMAN_TAKEOVER !== "1") return;
    if (!msg.fromMe) return;
    const chatId = msg.to;
    if (!chatId || chatId.endsWith("@g.us") || chatId.endsWith("@broadcast")) return;
    // Evita pausar por mensajes VIEJOS que WhatsApp reproduce al sincronizar
    // cuando se vincula el dispositivo (si no, arranca en pausa sin razón).
    if (msg.timestamp && Date.now() / 1000 - msg.timestamp > 120) return;
    const key = `${slug}::${chatId}`;
    const reciénBot = Date.now() - (botEnvioAt.get(key) || 0) < 4000;
    if (reciénBot) return; // fue el bot, no un humano
    pausados.set(key, Date.now() + HUMAN_TAKEOVER_MS);
    console.log(`[${slug}] toma humana en ${chatId} — bot en pausa 1 h.`);
  });

  client.initialize().catch((e) => {
    console.error(`[${slug}] no se pudo inicializar:`, e && e.message);
    const st = estado.get(slug);
    if (st) {
      st.status = "error";
      st.err = String(e && e.message);
    }
  });

  return client;
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
  if (msg.type !== "chat") return; // solo texto por ahora
  const texto = (msg.body || "").trim();
  if (!texto) return;

  const key = `${slug}::${chatId}`;

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

async function procesar(client, slug, kora, chatId, userText) {
  const key = `${slug}::${chatId}`;
  const hotel = { slug, nombre: kora.nombre };

  const chat = await client.getChatById(chatId).catch(() => null);
  if (chat) chat.sendStateTyping().catch(() => {});

  const history = historiales.get(key) || [];
  const conv = chatId.split("@")[0]; // teléfono → métrica sin doble conteo

  const { reply, history: nuevo } = await handleTurn({ hotel, kora, history, userText, conv });
  historiales.set(key, nuevo);

  if (chat) chat.clearState().catch(() => {});

  const salida = (reply || "").trim();
  if (!salida) return;
  botEnvioAt.set(key, Date.now());
  await client.sendMessage(chatId, salida);
}

// ── Servidor de estado/QR + health (Railway hace healthcheck a /health) ──
function servidorEstado() {
  createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    const filas = [...estado.values()]
      .map((h) => {
        const badge =
          h.status === "ready"
            ? "🟢 conectada"
            : h.status === "qr"
              ? "🟡 escanea el QR"
              : `🔴 ${h.status}${h.err ? ` — ${h.err}` : ""}`;
        const qrImg = h.status === "qr" && h.qr ? `<div><img src="${h.qr}" width="240" alt="QR"/></div>` : "";
        return `<section style="margin:16px 0;padding:16px;border:1px solid #ddd;border-radius:12px">
          <strong>${h.nombre}</strong> <code>${h.slug}</code><br/>${badge}${qrImg}
        </section>`;
      })
      .join("");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><meta charset="utf-8"><title>Camila · estado</title>` +
        `<body style="font-family:system-ui;max-width:520px;margin:24px auto;padding:0 16px">` +
        `<h1>Camila 🌿</h1><p>${estado.size} hotel(es) en la flota.</p>${filas || "<p>Sin hoteles.</p>"}</body>`,
    );
  }).listen(PORT, () => console.log(`[camila] estado/health en :${PORT}`));
}

async function main() {
  servidorEstado();
  const fleet = await loadFleet();
  if (!fleet.length) {
    console.warn("[camila] la flota está vacía. Revisa BOT_FLEET_SECRET / KORA_FLEET.");
    return;
  }
  console.log(`[camila] arrancando ${fleet.length} hotel(es): ${fleet.map((h) => h.slug).join(", ")}`);
  for (const hotel of fleet) arrancarHotel(hotel);
}

main().catch((e) => {
  console.error("[camila] fallo al arrancar:", e);
  process.exit(1);
});
