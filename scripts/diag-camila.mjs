// Por qué Camila está caída en un hotel. SOLO LECTURA: no arregla, no reinicia,
// no escribe. Dice cuál de las cuatro causas posibles es, y qué hacer con cada una.
//
//   node --env-file=.env.local scripts/diag-camila.mjs hotel-nealtican
//   node --env-file=.env.local scripts/diag-camila.mjs          (todos los hoteles)
//
// Lo corre Manolo: el agente tiene bloqueada la lectura de .env.local y de la
// base de producción (ver ref_no_consultar_bd_produccion).

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUNTIME = process.env.CAMILA_RUNTIME_URL;
const SECRET = process.env.BOT_FLEET_SECRET;
const slugPedido = process.argv[2];

if (!URL || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

/** Qué significa cada estado que emite el servidor de Camila, y qué hacer. */
const ESTADOS = {
  ready: ["🟢", "conectada y contestando", "nada que hacer"],
  qr: ["🟡", "esperando que alguien escanee su QR", "Panel → Camila → paso 6 «Conectar», y escanear con el WhatsApp del hotel"],
  "sin-vincular": ["🟡", "nunca se ha vinculado", "igual que arriba: escanear el QR"],
  starting: ["⏳", "arrancando", "esperar unos minutos y volver a mirar"],
  disconnected: [
    "🔴",
    "se desconectó del teléfono",
    "Casi siempre es que alguien la quitó en WhatsApp → Dispositivos vinculados, o que el teléfono del hotel lleva mucho apagado. Se arregla volviendo a escanear el QR desde el panel del hotel.",
  ],
  auth_failure: [
    "🔴",
    "WhatsApp rechazó la sesión guardada",
    "Hay que volver a escanear el QR: la sesión vieja ya no sirve.",
  ],
  error: [
    "🔴",
    "el servidor no pudo levantarla",
    "Es del lado de Kora (Railway), no del hotel: mirar los registros de Railway. Suele ser memoria o Chromium. El propio servidor reintenta unas veces antes de rendirse.",
  ],
  desconocido: ["⚪", "el servidor no sabe nada de este hotel", "no está en la flota: revisa acceso, bot_enabled y publicado"],
};

async function estadoDelRuntime() {
  if (!RUNTIME || !SECRET) {
    console.log("⚠️  Sin CAMILA_RUNTIME_URL o BOT_FLEET_SECRET en .env.local: no puedo preguntarle al servidor de Camila.\n");
    return null;
  }
  try {
    const res = await fetch(`${RUNTIME.replace(/\/$/, "")}/estado`, {
      headers: { Authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.log(`⚠️  El servidor de Camila contestó ${res.status}. Si es 401, el secreto no coincide; si es 502/503, el servicio está caído en Railway.\n`);
      return null;
    }
    const json = await res.json();
    const mapa = new Map();
    for (const h of json.hotels ?? []) mapa.set(h.slug, h);
    return mapa;
  } catch (e) {
    console.log(`🔴 No se pudo hablar con el servidor de Camila: ${e.message}`);
    console.log("   Eso, por sí solo, ya explica que TODOS los hoteles aparezcan caídos: el servicio de Railway no está respondiendo.\n");
    return null;
  }
}

const runtime = await estadoDelRuntime();

const { data: hoteles, error } = await db
  .from("hoteles")
  .select("id, slug, nombre, publicado, config, extras, owner_id, created_at, whatsapp")
  .order("created_at");
if (error) {
  console.error("No se pudieron leer los hoteles:", error.message);
  process.exit(1);
}

const lista = slugPedido ? hoteles.filter((h) => h.slug === slugPedido) : hoteles;
if (slugPedido && lista.length === 0) {
  console.error(`No existe el hotel «${slugPedido}».`);
  process.exit(1);
}

for (const h of lista) {
  const cfg = h.config ?? {};
  const extras = h.extras ?? {};
  const st = runtime?.get(h.slug);
  const estado = st?.status ?? (runtime ? "desconocido" : "sin dato");
  const [icono, que, quehacer] = ESTADOS[estado] ?? ["⚪", estado, "—"];

  console.log(`\n══ ${h.nombre} (${h.slug})`);
  console.log(`   Camila: ${icono} ${estado} — ${que}`);
  if (st?.err) console.log(`   Motivo que reporta el servidor: ${st.err}`);
  if (st?.intentos) console.log(`   Reintentos de arranque: ${st.intentos}`);

  // Las cuatro cosas que dejan a un hotel FUERA de la flota. Si alguna falla,
  // el servidor ni siquiera intenta levantar a Camila.
  const bot = cfg.bot_enabled;
  console.log("   Requisitos para estar en la flota:");
  console.log(`     · Publicado: ${h.publicado === true ? "sí" : "NO 🔴"}`);
  console.log(`     · Bot encendido: ${bot === false ? "NO 🔴 (alguien lo pausó en el panel)" : "sí"}`);
  console.log(`     · WhatsApp del hotel: ${h.whatsapp ? h.whatsapp : "FALTA 🔴 (sin número no hay a qué vincular)"}`);
  if (extras.bloqueo?.activo) console.log("     · 🔴 CUENTA BLOQUEADA por Kora");
  if (extras.demo === true) console.log("     · ⚪ es hotel DEMO: a propósito no conecta WhatsApp");

  // Acceso: sin plan ni prueba vigente, el fleet lo saca aunque todo lo demás esté bien.
  const { data: sub } = await db
    .from("suscripciones")
    .select("estado, periodo_fin, cancela_al_final")
    .eq("user_id", h.owner_id)
    .maybeSingle();
  const alta = h.created_at ? new Date(h.created_at) : null;
  // Los hoteles dados de alta antes del 6 sep 2026 conservan 30 días de prueba.
  const dias = alta && alta < new Date("2026-09-06T00:00:00-06:00") ? 30 : 14;
  const fin = alta ? new Date(alta.getTime() + dias * 86_400_000) : null;
  const quedan = fin ? Math.ceil((fin - Date.now()) / 86_400_000) : null;
  console.log(
    `     · Acceso: ${
      sub?.estado
        ? `suscripción «${sub.estado}»${sub.cancela_al_final ? " (cancela al final del periodo)" : ""}`
        : fin
          ? `sin suscripción · prueba de ${dias} días ${quedan > 0 ? `vigente, quedan ${quedan}` : `VENCIDA hace ${-quedan} día(s) 🔴`}`
          : "sin dato"
    }`,
  );

  // Saldo: sólo calla a Camila si el bloqueo está encendido (hoy, apagado).
  const { data: saldo } = await db
    .from("saldo_bot")
    .select("mensajes")
    .eq("hotel_id", h.id)
    .maybeSingle();
  console.log(`     · Saldo de mensajes: ${saldo ? saldo.mensajes : "sin fila (no se le bloquea nunca)"}`);

  // EL TOKEN. Es el requisito que no se ve en ninguna pantalla y el único que
  // puede dejar a un hotel fuera de la flota teniéndolo TODO lo demás en orden:
  // `app/api/bots/fleet` se salta al hotel cuyo token no puede leer ni generar.
  // Y el síntoma es exactamente el que se vio el 21 sep 2026 con Nealtican: el
  // panel lo levanta al pedir el QR y la pasada siguiente lo apaga «fuera del
  // fleet», una y otra vez.
  const { data: tok, error: errTok } = await db
    .from("hotel_bot_tokens")
    .select("hotel_id, created_at")
    .eq("hotel_id", h.id)
    .maybeSingle();
  console.log(
    `     · Token del bot: ${
      errTok
        ? `NO SE PUDO LEER 🔴 (${errTok.message}) — si la tabla no existe, falta correr sql/kora-bot-tokens-paso1.sql`
        : tok
          ? `sí (creado ${String(tok.created_at).slice(0, 10)})`
          : "NO TIENE 🔴 — la flota lo salta; se genera solo en la siguiente pasada salvo que la escritura esté fallando"
    }`,
  );

  // El veredicto: ¿lo incluiría la flota AHORA MISMO?
  const fuera = [];
  if (extras.demo === true) fuera.push("es demo");
  if (h.publicado !== true) fuera.push("no está publicado");
  if (bot === false) fuera.push("el bot está pausado");
  if (extras.bloqueo?.activo) fuera.push("la cuenta está bloqueada");
  if (!sub?.estado && quedan !== null && quedan <= 0) fuera.push("la prueba venció y no hay plan");
  if (!errTok && !tok) fuera.push("no tiene token del bot");
  console.log(
    fuera.length
      ? `   ⛔ LA FLOTA LO EXCLUYE por: ${fuera.join(", ")}`
      : "   ✅ La flota SÍ debería incluirlo: si el servidor dice «fuera del fleet», el problema es al leer su token o su acceso en ese momento (mira la bandeja de alertas del CRM).",
  );

  if (icono === "🔴") console.log(`\n   👉 QUÉ HACER: ${quehacer}`);
}

console.log(
  "\nNota: el servidor relee la flota cada ~5 minutos, así que un cambio (publicar, encender el bot, escanear el QR) tarda eso en notarse.\n",
);
