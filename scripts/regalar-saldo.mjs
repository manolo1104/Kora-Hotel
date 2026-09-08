// Regala saldo de arranque del bot de WhatsApp a los hoteles YA REGISTRADOS.
//
// SE CORRE UNA VEZ, Y ANTES DE ENCENDER EL BLOQUEO. Los hoteles que ya existen
// nunca han recargado nada: si `SALDO_BLOQUEO=1` se enciende antes de esto,
// todos se quedan mudos el mismo día.
//
//   1. Correr `sql/kora-saldo-bot.sql` en Supabase.
//   2. Este script (primero el ensayo, luego `--enviar`).
//   3. Desplegar el código con SALDO_BLOQUEO sin poner.
//   4. Verificar en producción.
//   5. Encender SALDO_BLOQUEO=1.
//
// ── ESTÁ MONTADO PARA QUE SEA DIFÍCIL EQUIVOCARSE ────────────────────────────
//
// · POR DEFECTO NO ESCRIBE NADA. Sin `--enviar` sólo dice a quién le tocaría.
// · NO PUEDE REGALAR DOS VECES. El `ref` (`regalo-<etiqueta>`) tiene índice
//   único en `saldo_movimientos`: correrlo diez veces regala una. Eso es a
//   propósito — es la red que permite volver a correrlo si se cortó a medias.
// · Se salta a quien ya tenga saldo, para no inflarle la cuenta a un hotel que
//   ya recargó. Con `--todos` no se salta a nadie: es lo que hace falta para la
//   RECARGA DE SEGURIDAD de antes de encender el bloqueo (ver abajo).
//
// Uso:
//   node scripts/regalar-saldo.mjs                 (ensayo: sólo cuenta)
//   node scripts/regalar-saldo.mjs --enviar        (aplica)
//   node scripts/regalar-saldo.mjs --enviar --mensajes 500 --etiqueta disculpa-sep
//   node scripts/regalar-saldo.mjs --enviar --todos --etiqueta antes-del-bloqueo
//
// ── LA RECARGA DE SEGURIDAD, Y POR QUÉ NO ES OPCIONAL ────────────────────────
//
// Mientras el prepago está en «próximamente» el saldo BAJA pero no se corta a
// nadie. Eso significa que el día que se encienda `SALDO_BLOQUEO=1`, cualquier
// hotel que ya se haya gastado sus 300 mensajes se queda mudo EN ESE INSTANTE,
// sin aviso previo y sin haber podido recargar.
//
// Por eso, ANTES de encender el bloqueo:
//
//     node scripts/regalar-saldo.mjs --enviar --todos --etiqueta antes-del-bloqueo
//
// El `--todos` le suma a todos, incluidos los que ya tienen saldo, y la etiqueta
// nueva hace que se aplique una sola vez.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Lee .env.local si está, para no tener que exportar nada a mano.
for (const archivo of [".env.local", ".env"]) {
  try {
    for (const linea of readFileSync(archivo, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no está: se usan las variables del entorno */
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!URL || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const args = process.argv.slice(2);
const enviar = args.includes("--enviar");
const todos = args.includes("--todos");
const valor = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};
const MENSAJES = Number(valor("mensajes", "300"));
const ETIQUETA = valor("etiqueta", "arranque-2026-09");

if (!Number.isInteger(MENSAJES) || MENSAJES < 1) {
  console.error(`--mensajes tiene que ser un entero positivo (llegó "${MENSAJES}").`);
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const { data: hoteles, error } = await db.from("hoteles").select("id, slug, nombre").order("created_at");
if (error) {
  console.error("No se pudieron leer los hoteles:", error.message);
  process.exit(1);
}

const { data: saldos, error: e2 } = await db.from("saldo_bot").select("hotel_id, mensajes");
if (e2) {
  console.error("No se pudo leer el saldo (¿corriste sql/kora-saldo-bot.sql?):", e2.message);
  process.exit(1);
}
const yaTiene = new Map((saldos ?? []).map((s) => [s.hotel_id, s.mensajes]));

console.log(
  `\n${enviar ? "REGALANDO" : "ENSAYO (no escribe nada)"} · ${MENSAJES} mensajes · ` +
    `ref "regalo-${ETIQUETA}"${todos ? " · A TODOS (incluidos los que ya tienen saldo)" : ""}\n`,
);

let aplicados = 0;
let saltados = 0;
let repetidos = 0;

for (const h of hoteles ?? []) {
  const saldo = yaTiene.get(h.id);
  if (!todos && typeof saldo === "number" && saldo > 0) {
    console.log(`  · ${h.slug.padEnd(28)} ya tiene ${saldo} mensajes — se salta`);
    saltados += 1;
    continue;
  }
  if (!enviar) {
    console.log(`  + ${h.slug.padEnd(28)} ${saldo ?? 0} → ${(saldo ?? 0) + MENSAJES}`);
    aplicados += 1;
    continue;
  }
  const { data, error: e3 } = await db.rpc("saldo_acreditar", {
    p_hotel_id: h.id,
    p_mensajes: MENSAJES,
    p_ref: `regalo-${ETIQUETA}`,
    p_tipo: "regalo",
  });
  if (e3) {
    console.error(`  ✗ ${h.slug.padEnd(28)} ${e3.message}`);
    continue;
  }
  if (data === -1) {
    // El `ref` ya estaba: este hotel ya recibió ESTE regalo en una corrida
    // anterior. No es un error, es la red de idempotencia haciendo su trabajo.
    console.log(`  = ${h.slug.padEnd(28)} ya se le había regalado`);
    repetidos += 1;
    continue;
  }
  console.log(`  ✓ ${h.slug.padEnd(28)} ${saldo ?? 0} → ${data}`);
  aplicados += 1;
}

console.log(
  `\n${enviar ? "Aplicados" : "Se aplicarían"}: ${aplicados} · ya tenían saldo: ${saltados} · repetidos: ${repetidos}`,
);
// Se repiten los MISMOS argumentos para que la línea se pueda copiar tal cual:
// sin esto, un ensayo con `--todos` sugería un envío SIN `--todos`, que es otra
// operación distinta.
if (!enviar) {
  console.log(`\nPara aplicarlo de verdad:  node scripts/regalar-saldo.mjs --enviar ${args.filter((a) => a !== "--enviar").join(" ")}\n`);
}
