#!/usr/bin/env node
// Guardián de la matriz de permisos (Etapa 5, paso 5.6).
//
// La parte cara de poner permisos no fue teclear 57 líneas: fue DECIDIR los 57
// permisos. Lo que hace que ese trabajo no se pudra es este script: sin él, la
// ruta 46 que alguien escriba dentro de tres meses volverá a no mirar el rol y
// nadie se enterará hasta que un empleado cancele una reserva que no debía.
//
// Sale 1 si encuentra una ruta del panel sin guardián.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Rutas EXENTAS, cada una con su razón por escrito. Esta lista sólo puede
// encoger: si crece, es que alguien se está saltando la matriz.
const EXENTAS = new Map([
  [
    "app/api/panel/tour-visto/route.ts",
    "es una preferencia de UI del propio usuario (¿ya vio el tour?), no toca datos del hotel",
  ],
  [
    "app/api/cron/ical-sync/route.ts",
    "es un cron: se autentica con CRON_SECRET y no hay sesión de usuario que tenga rol",
  ],
]);

const archivos = execSync(
  'grep -rl "getActiveHotel\\|getHotelMember" app/api --include="route.ts" || true',
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean)
  .sort();

const sinGuardian = [];
const exentasVistas = new Set();

for (const f of archivos) {
  if (EXENTAS.has(f)) {
    exentasVistas.add(f);
    continue;
  }
  const src = readFileSync(f, "utf8");
  if (!src.includes("negar(")) sinGuardian.push(f);
}

// Una exención que ya no aplica es basura que tapa el siguiente hallazgo.
const exentasMuertas = [...EXENTAS.keys()].filter((f) => !exentasVistas.has(f));

if (exentasMuertas.length) {
  console.log("⚠️  exenciones que ya no corresponden a ninguna ruta (bórralas):");
  for (const f of exentasMuertas) console.log(`     ${f}`);
}

if (sinGuardian.length) {
  console.error(`\n🔴 ${sinGuardian.length} ruta(s) del panel sin comprobación de permiso:\n`);
  for (const f of sinGuardian) console.error(`     ${f}`);
  console.error(
    "\n   Añade `const no = negar(ctx, \"<permiso>\"); if (no) return no;` justo después\n" +
      "   del `if (!ctx) return 401`, con un permiso de lib/panel/permisos.ts.\n" +
      "   Si de verdad no lleva permiso, anótala en EXENTAS de este script CON SU RAZÓN.\n",
  );
  process.exit(1);
}

console.log(
  `✅ permisos: las ${archivos.length - EXENTAS.size} rutas del panel comprueban el rol ` +
    `(${EXENTAS.size} exentas, con razón escrita).`,
);
