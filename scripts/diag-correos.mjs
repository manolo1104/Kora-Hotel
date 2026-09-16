// Diagnóstico de SOLO LECTURA de los correos de captación de Kora.
//
// Responde la pregunta de Manolo (15 sep 2026): «¿a los que se registran y a los
// que dejan su correo en la página les llegan bien los correos?».
//
// NO ESCRIBE NADA. No manda ningún correo. Sólo cuenta filas de la base de
// producción y dice quién se quedó sin recibir lo que le tocaba.
//
// Se corre desde la raíz del repo:
//     node --env-file=.env.local scripts/diag-correos.mjs
//
// Lo corre Manolo, no el agente: el clasificador de permisos bloquea a la IA
// cualquier guion que lea `.env.local` o toque la base de producción
// (ver ref_no_consultar_bd_produccion).

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Corre:  node --env-file=.env.local scripts/diag-correos.mjs",
  );
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const DIA = 86_400_000;
const hace = (dias) => new Date(Date.now() - dias * DIA).toISOString();
const fecha = (iso) => (iso ? String(iso).slice(0, 10) : "—");

/** Una consulta que nunca tumba el guion: devuelve [] y deja dicho el motivo. */
async function pedir(nombre, consulta) {
  const { data, error } = await consulta;
  if (error) {
    console.log(`   ⚠️  ${nombre}: ${error.message}`);
    return [];
  }
  return data ?? [];
}

function contarPor(filas, campo) {
  const m = new Map();
  for (const f of filas) {
    const k = f[campo] ?? "(sin dato)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function tabla(pares, sangria = "   ") {
  if (!pares.length) return `${sangria}(nada)`;
  const ancho = Math.max(...pares.map(([k]) => String(k).length));
  return pares.map(([k, v]) => `${sangria}${String(k).padEnd(ancho)}  ${v}`).join("\n");
}

console.log("\n══════════════════════════════════════════════════════════════");
console.log(" CORREOS DE CAPTACIÓN DE KORA — diagnóstico de solo lectura");
console.log(` Fecha: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
console.log("══════════════════════════════════════════════════════════════");

// ── 1. Quien deja su correo en la página (lista de la guía) ──────────────────
console.log("\n1. LISTA DE CORREO (quien deja su correo en la página)");

const suscriptores = await pedir(
  "suscriptores",
  db.from("suscriptores").select("id, email, origen, baja_at, created_at").order("created_at"),
);
const logSus = await pedir(
  "suscriptor_email_log",
  db.from("suscriptor_email_log").select("suscriptor_id, email_type, created_at"),
);

const activos = suscriptores.filter((s) => !s.baja_at);
console.log(`   Total: ${suscriptores.length}   ·   activos: ${activos.length}   ·   bajas: ${suscriptores.length - activos.length}`);
const nuevos30 = suscriptores.filter((s) => s.created_at >= hace(30));
console.log(`   Nuevos en 30 días: ${nuevos30.length}`);
console.log("   Por dónde entraron (30 días):");
console.log(tabla(contarPor(nuevos30, "origen")));
console.log("   Correos que salieron, por tipo:");
console.log(tabla(contarPor(logSus, "email_type")));

// El hueco que más duele no es el suscriptor MUDO, es el que recibió los toques
// 2, 5, 9 y 14 pero nunca el del día 0 — la guía que vino a pedir. Ese no se ve
// contando filas: hay que preguntar por el tipo que falta. (15 sep 2026: 3 de 7
// estaban así y este guion, mirando sólo «cero correos», no los señalaba.)
const guia0 = new Set(logSus.filter((l) => l.email_type === "guia_0").map((l) => l.suscriptor_id));
const sinGuia = activos.filter((s) => !guia0.has(s.id));
console.log(
  sinGuia.length
    ? `   🔴 ${sinGuia.length} suscriptores activos que NUNCA recibieron la guía (día 0):`
    : "   ✅ Todos los suscriptores activos recibieron la guía del día 0.",
);
for (const s of sinGuia.slice(0, 20))
  console.log(`      ${fecha(s.created_at)}  ${s.email}  (${s.origen ?? "sin origen"})`);
if (sinGuia.length > 20) console.log(`      … y ${sinGuia.length - 20} más`);

const conCorreo = new Set(logSus.map((l) => l.suscriptor_id));
const mudos = activos.filter((s) => !conCorreo.has(s.id) && s.created_at < hace(1));
console.log(
  mudos.length
    ? `   🔴 ${mudos.length} suscriptores activos (de más de un día) SIN NINGÚN correo registrado:`
    : "   ✅ Todos los suscriptores activos tienen al menos un correo registrado.",
);
for (const s of mudos.slice(0, 15)) console.log(`      ${fecha(s.created_at)}  ${s.email}  (${s.origen ?? "sin origen"})`);
if (mudos.length > 15) console.log(`      … y ${mudos.length - 15} más`);

// ── 2. Quien pide que lo contacten (leads) ───────────────────────────────────
console.log("\n2. LEADS (formulario de contacto y herramientas)");

const leads = await pedir(
  "crm_leads",
  db.from("crm_leads").select("id, hotel_nombre, email, origen, etapa, secuencia_pausada, created_at").order("created_at"),
);
const logLeads = await pedir(
  "lead_email_log",
  db.from("lead_email_log").select("lead_id, email_type, created_at"),
);

const leads30 = leads.filter((l) => l.created_at >= hace(30));
console.log(`   Total: ${leads.length}   ·   con correo: ${leads.filter((l) => l.email).length}   ·   nuevos en 30 días: ${leads30.length}`);
console.log("   Por dónde entraron (30 días):");
console.log(tabla(contarPor(leads30, "origen")));
console.log("   Correos que salieron, por tipo:");
console.log(tabla(contarPor(logLeads, "email_type")));

const leadsConCorreo = new Set(logLeads.map((l) => l.lead_id));
const leadsMudos = leads.filter(
  (l) => l.email && !leadsConCorreo.has(l.id) && l.created_at < hace(1) && !l.secuencia_pausada,
);
console.log(
  leadsMudos.length
    ? `   🔴 ${leadsMudos.length} leads con correo (de más de un día) SIN NINGÚN correo registrado:`
    : "   ✅ Todos los leads con correo tienen al menos un correo registrado.",
);
for (const l of leadsMudos.slice(0, 15))
  console.log(`      ${fecha(l.created_at)}  ${l.email}  ${l.hotel_nombre ?? ""} (${l.origen ?? "sin origen"}, etapa ${l.etapa})`);
if (leadsMudos.length > 15) console.log(`      … y ${leadsMudos.length - 15} más`);

// ── 3. Quien se registra (cuentas y hoteles) ─────────────────────────────────
console.log("\n3. REGISTROS (cuentas creadas en la web)");

let usuarios = [];
try {
  for (let pagina = 1; pagina <= 10; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) {
      console.log(`   ⚠️  cuentas: ${error.message}`);
      break;
    }
    const lote = data?.users ?? [];
    usuarios = usuarios.concat(lote);
    if (lote.length < 1000) break;
  }
} catch (e) {
  console.log(`   ⚠️  cuentas: ${e.message}`);
}

const hoteles = await pedir(
  "hoteles",
  db.from("hoteles").select("id, slug, nombre, owner_id, publicado, created_at, extras").order("created_at"),
);
const miembros = await pedir("hotel_members", db.from("hotel_members").select("user_id, rol"));

const duenos = new Set(hoteles.map((h) => h.owner_id).filter(Boolean));
const personal = new Set(miembros.map((m) => m.user_id).filter(Boolean));
const sinHotel = usuarios.filter((u) => !duenos.has(u.id) && !personal.has(u.id));

console.log(`   Cuentas: ${usuarios.length}   ·   hoteles: ${hoteles.length}   ·   cuentas SIN hotel: ${sinHotel.length}`);
const sinConfirmar = usuarios.filter((u) => !u.email_confirmed_at);
console.log(`   Cuentas que NUNCA confirmaron su correo: ${sinConfirmar.length}`);
for (const u of sinConfirmar.slice(0, 15)) console.log(`      ${fecha(u.created_at)}  ${u.email}`);
if (sinConfirmar.length > 15) console.log(`      … y ${sinConfirmar.length - 15} más`);

console.log("   Cuentas sin hotel (se registraron y no cargaron nada):");
for (const u of sinHotel.slice(0, 20))
  console.log(`      ${fecha(u.created_at)}  ${u.email}  ${u.email_confirmed_at ? "confirmó" : "🔴 sin confirmar"}`);
if (sinHotel.length > 20) console.log(`      … y ${sinHotel.length - 20} más`);

console.log("   Avisos de la prueba que ya salieron, por hotel (extras.prueba.avisos):");
const avisos = hoteles.map((h) => {
  const a = ((h.extras ?? {}).prueba ?? {}).avisos;
  return [`${h.slug} (alta ${fecha(h.created_at)})`, Array.isArray(a) ? a.join(", ") : a ? JSON.stringify(a) : "ninguno"];
});
console.log(tabla(avisos));

// ── 4. Bitácora de envíos del motor de reservas ──────────────────────────────
console.log("\n4. BITÁCORA DE ENVÍOS (email_log: correos del motor a huéspedes)");

// La columna de fecha de `email_log` se llama `enviado_at`, no `created_at`
// (sql/kora-multitenant-fase0.sql). Con `created_at` la consulta fallaba entera
// y el diagnóstico decía «0 filas», que es justo el falso cero que este guion
// existe para evitar.
const log = (
  await pedir(
    "email_log",
    db
      .from("email_log")
      .select("email_type, estado, intentos, ultimo_error, email_destino, enviado_at")
      .gte("enviado_at", hace(60)),
  )
).map((f) => ({ ...f, created_at: f.enviado_at }));
console.log(`   Filas en 60 días: ${log.length}`);
console.log("   Por estado:");
console.log(tabla(contarPor(log, "estado")));
console.log("   Por tipo:");
console.log(tabla(contarPor(log, "email_type")));
const fallidos = log.filter((f) => f.estado && f.estado !== "enviado");
if (fallidos.length) {
  console.log("   🔴 Últimos fallos:");
  for (const f of fallidos.slice(-10))
    console.log(`      ${fecha(f.created_at)}  ${f.email_type}  → ${f.email_destino ?? "?"}  (${f.intentos} intentos) ${f.ultimo_error ?? ""}`);
}

console.log("\n── Qué significan los 🔴 ────────────────────────────────────────");
console.log(" · Suscriptor o lead SIN ningún correo = la secuencia no arrancó para él.");
console.log(" · Cuenta sin confirmar = el correo de confirmación de Supabase no llegó o");
console.log("   no lo abrió; con el SMTP de fábrica el tope es de 2 correos por hora.");
console.log(" · email_log sólo cubre los correos del motor (huéspedes), no los de Kora");
console.log("   al hotelero: esos no tienen bitácora todavía.\n");
