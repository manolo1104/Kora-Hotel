#!/usr/bin/env node
// Guion de regresión del AISLAMIENTO (Etapa 5, paso 5.15).
//
//   node scripts/verificar-aislamiento.mjs                  # contra localhost:3000
//   node scripts/verificar-aislamiento.mjs https://kora-hotel.com
//
// ── Por qué NO hace lo que pedía el plan ────────────────────────────────────
// El plan diseñó un guion que inicia sesión con dos usuarios de prueba, crea
// reservas y CAMBIA ROLES en `hotel_members` para probar los 403. Eso exige
// escribir en la base y, por eso mismo, el propio plan obliga a abortar si la
// URL es la de producción.
//
// Kora tiene UNA sola Supabase, y es la de producción. Ese guion nunca se
// podría correr: sería un archivo verde que nadie ejecuta, que es peor que no
// tenerlo. Así que este comprueba lo que se puede comprobar SIEMPRE, sin
// credenciales y sin escribir un solo byte:
//
//   · toda ruta del panel exige sesión (una que olvide `getActiveHotel()`
//     aparecería aquí como 200 y con datos dentro);
//   · el 401 no filtra nada (ni nombres de hotel, ni correos, ni tablas);
//   · ningún mensaje crudo de Postgres sale al navegador.
//
// Lo autenticado —que la pestaña manda sobre la cookie, y que cada rol sólo
// puede lo suyo— vive en `tests/` (`npm test`) y en `npm run check:permisos`.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");

// Descubre las rutas del panel leyendo el árbol de archivos: así, una ruta nueva
// entra en la prueba sola. Los segmentos dinámicos se rellenan con un valor
// inventado — lo que se comprueba es el 401, que va ANTES de mirar el id.
function rutasDelPanel(dir = "app/api", acc = []) {
  for (const entrada of readdirSync(dir)) {
    const p = path.join(dir, entrada);
    if (statSync(p).isDirectory()) rutasDelPanel(p, acc);
    else if (entrada === "route.ts") {
      const url = "/" + path.dirname(p).replace(/^app\//, "").replace(/\[[^\]]+\]/g, "prueba-aislamiento");
      if (/^\/api\/(admin|panel)\//.test(url)) acc.push(url);
    }
  }
  return acc;
}

// Palabras que NUNCA deben aparecer en la respuesta a alguien sin sesión.
const FUGAS = [
  { patron: /"(email|telefono|whatsapp)"\s*:/i, que: "datos de contacto" },
  { patron: /\b(relation|column|constraint|duplicate key|violates)\b/i, que: "error crudo de Postgres" },
  { patron: /supabase\.co|service_role|sk_live|whsec_/i, que: "credencial o URL interna" },
  { patron: /"hotel_id"\s*:/i, que: "id de hotel" },
];

const rutas = [...new Set(rutasDelPanel())].sort();
let fallos = 0;

console.log(`\nAislamiento contra ${BASE} — ${rutas.length} rutas del panel, SIN sesión\n`);

for (const ruta of rutas) {
  for (const metodo of ["GET", "POST"]) {
    let res, cuerpo;
    try {
      res = await fetch(BASE + ruta, {
        method: metodo,
        headers: { "content-type": "application/json" },
        body: metodo === "POST" ? "{}" : undefined,
        // A propósito: ni cabecera de hotel ni Referer. Es el caso de alguien
        // que pega la URL directo, que es exactamente el que hay que aguantar.
        referrerPolicy: "no-referrer",
      });
      cuerpo = await res.text();
    } catch (e) {
      console.error(`  ❌ ${metodo} ${ruta} — no respondió: ${e.message}`);
      fallos++;
      continue;
    }

    // 405 = ese método no existe en la ruta; es correcto y no dice nada de más.
    if (res.status === 405 || res.status === 404) continue;

    if (res.status !== 401 && res.status !== 403) {
      console.error(`  ❌ ${metodo} ${ruta} → ${res.status} (debería ser 401/403 sin sesión)`);
      console.error(`       ${cuerpo.slice(0, 120)}`);
      fallos++;
      continue;
    }
    const fuga = FUGAS.find((f) => f.patron.test(cuerpo));
    if (fuga) {
      console.error(`  ❌ ${metodo} ${ruta} → ${res.status} pero el cuerpo filtra ${fuga.que}`);
      console.error(`       ${cuerpo.slice(0, 160)}`);
      fallos++;
    }
  }
}

if (fallos) {
  console.error(`\n🔴 ${fallos} problema(s) de aislamiento.\n`);
  process.exit(1);
}
console.log(`✅ aislamiento: las ${rutas.length} rutas del panel exigen sesión y no filtran nada.\n`);
