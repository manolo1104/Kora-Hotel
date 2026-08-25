#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Guardia mecánico contra el error de "tipos contra unidades".
//
//  Kora guarda la ocupación en `blocks` con una fila por CUARTO FÍSICO
//  ("Cabaña", "Cabaña 2", "Cabaña 3"). Preguntar por el TIPO ("Cabaña") hace que
//  todas las unidades salvo la primera se descarten en silencio: el calendario
//  cierra días con cuartos libres, Camila dice que no hay lugar y el feed de las
//  OTAs publica una cabaña como si fueran tres.
//
//  No fue un bug de lógica: fue la MISMA llamada equivocada repetida en cinco
//  sitios. Este script no es un test —el repo no tiene ninguno— sino un guardia
//  de 3 reglas que falla si alguien vuelve a mezclarlas.
//
//      node scripts/check-inventario.mjs      → salida 0 si todo bien, 1 si no
//
//  Córrelo antes de cualquier commit que toque disponibilidad. Es un guardia, no
//  un juez: si da un falso positivo, se ajusta la regla.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DIRS = ["app", "lib", "components"];
const EXT = /\.(ts|tsx)$/;

function archivos(dir) {
  const out = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entradas) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (EXT.test(e)) out.push(p);
  }
  return out;
}

const fallos = [];
function marcar(regla, archivo, linea, texto) {
  fallos.push({ regla, archivo: relative(RAIZ, archivo), linea, texto: texto.trim() });
}

// Los dos únicos archivos autorizados a escribir ocupación a mano. Todo lo demás
// debe pasar por los RPC atómicos: si no, hay un hueco entre "leí que estaba
// libre" y "lo aparté" por el que se cuela una sobreventa.
const ESCRITORES_OK = ["lib/db/availability.ts", "lib/db/admin.ts"];

// Escrituras a `blocks` que YA se sabe que están fuera de sitio y que los pasos
// 3.8-3.14 del plan van a encauzar por los RPC atómicos. Se avisan pero no
// hacen fallar el guardia: si no, sería inútil hasta terminar la etapa entera.
// Esta lista sólo puede ENCOGER. Al vaciarse, se borra junto con este bloque.
const PENDIENTES = new Map([
  ["app/api/admin/disponibilidad/route.ts", "paso 3.14 — bloquear/desbloquear noches sin hueco"],
  ["app/api/h/webhooks/stripe/route.ts", "paso 3.9 — resync de ocupación al cancelar"],
  ["lib/db/portal.ts", "paso 3.9 — cancelación desde el portal del huésped"],
]);
const avisos = [];

for (const dir of DIRS) {
  for (const archivo of archivos(join(RAIZ, dir))) {
    const rel = relative(RAIZ, archivo);
    const lineas = readFileSync(archivo, "utf8").split("\n");

    lineas.forEach((l, i) => {
      const n = i + 1;
      const sinComentario = l.replace(/\/\/.*$/, "");

      // Regla 1 — nunca consultar disponibilidad con nombres de TIPO.
      if (/checkAvailability\s*\(/.test(sinComentario) && /tipoNamesOf|roomNamesOf/.test(sinComentario)) {
        marcar("1: checkAvailability con nombres de TIPO", archivo, n, l);
      }
      if (/getFullyBookedDates\s*\(/.test(sinComentario) && /tipoNamesOf|roomNamesOf|\.length/.test(sinComentario)) {
        marcar("3: getFullyBookedDates sin totalUnits()/unitNamesOf()", archivo, n, l);
      }

      // Regla 2 — sólo dos archivos escriben en `blocks`.
      if (!ESCRITORES_OK.includes(rel)) {
        if (/from\(["'`]blocks["'`]\)/.test(sinComentario)) {
          const bloque = lineas.slice(i, i + 4).join(" ");
          if (/\.(insert|upsert|delete|update)\s*\(/.test(bloque)) {
            if (PENDIENTES.has(rel)) avisos.push(`${rel}:${n} — ${PENDIENTES.get(rel)}`);
            else marcar("2: escribe en `blocks` fuera de lib/db", archivo, n, l);
          }
        }
      }
    });

    // Regla 3 (segunda mitad) — la llamada puede venir partida en varias líneas.
    const texto = readFileSync(archivo, "utf8");
    // `await ` o `= ` delante: si no, se estaría marcando la propia declaración
    // `export async function getFullyBookedDates(` como si fuera una llamada.
    const m = texto.match(/(?:await|=)\s+getFullyBookedDates\s*\(([\s\S]{0,220}?)\)\s*;/);
    if (m && !/totalUnits\s*\(/.test(m[1])) {
      const n = texto.slice(0, m.index).split("\n").length;
      marcar("3: getFullyBookedDates sin totalUnits()", archivo, n, m[0].split("\n")[0]);
    }
  }
}

// `roomNamesOf` ya no existe: se llama `tipoNamesOf`. Si reaparece, alguien
// revivió el nombre viejo (y con él, su comentario equivocado).
for (const dir of DIRS) {
  for (const archivo of archivos(join(RAIZ, dir))) {
    readFileSync(archivo, "utf8")
      .split("\n")
      .forEach((l, i) => {
        if (/\broomNamesOf\b/.test(l.replace(/\/\/.*$/, "").replace(/\*.*$/, ""))) {
          marcar("0: volvió `roomNamesOf` (ahora es `tipoNamesOf`)", archivo, i + 1, l);
        }
      });
  }
}

if (avisos.length > 0) {
  console.warn(`⚠️  ${avisos.length} escritura(s) a \`blocks\` pendientes de encauzar (ya previstas):`);
  for (const a of avisos) console.warn(`     ${a}`);
  console.warn("");
}

if (fallos.length === 0) {
  console.log("✅ inventario: tipos y unidades no están mezclados.");
  process.exit(0);
}

console.error(`🔴 inventario: ${fallos.length} problema(s).\n`);
for (const f of fallos) {
  console.error(`  [regla ${f.regla}]`);
  console.error(`    ${f.archivo}:${f.linea}`);
  console.error(`    ${f.texto}\n`);
}
console.error("Recordatorio: `blocks` guarda una fila por CUARTO FÍSICO.");
console.error("  inventario → unitNamesOf() / totalUnits()");
console.error("  disponibilidad → freeUnitsByType()");
console.error("  tipoNamesOf() es SÓLO para listas en pantalla.");
process.exit(1);
