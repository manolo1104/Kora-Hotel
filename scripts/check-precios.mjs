#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Guardia mecánico contra "calcular el precio por mi cuenta".
//
//  Kora tiene UN motor de precios (`lib/booking/engine.ts`) que sabe de
//  temporadas, recargo de fin de semana, descuento entre semana y escalones por
//  número de huéspedes. Todo lo que cobra dinero debería pasar por ahí.
//
//  El 2 sep 2026 se encontró que NO era así, y no en un rincón: el modal de
//  reserva manual del panel —el que usa el hotelero todos los días— hacía
//  `precioBase × noches`. Dar de alta a mano una reserva de Semana Santa
//  cobraba tarifa de temporada baja, y el total viajaba al servidor, que lo
//  aceptaba tal cual. El hotelero no tenía forma de notarlo: el número salía
//  del propio sistema.
//
//  Este guardia no es un test: es un chivato de 2 reglas que falla si alguien
//  vuelve a multiplicar un precio por noches fuera del motor.
//
//      node scripts/check-precios.mjs      → salida 0 si todo bien, 1 si no
//
//  Si da un falso positivo, se ajusta la regla o se añade la excepción CON LA
//  RAZÓN ESCRITA — nunca se borra la regla.
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

// El motor es el único que puede hacer estas cuentas: es su trabajo.
const MOTOR = ["lib/booking/engine.ts", "lib/booking/rooms.ts"];

// Excepciones con su razón. Sólo pueden ENCOGER.
const EXENTOS = new Map([
  // El "desde $" de la página pública y de la mini-página: es un precio de
  // referencia SIN FECHA, así que no hay temporada que aplicar. Es correcto que
  // no pase por el motor.
  ["app/h/[slug]/page.tsx", "precio «desde», sin fecha"],
  ["components/mini/MiniRender.tsx", "precio «desde», sin fecha"],
  // Las cotizaciones llevan precios tecleados a mano por el hotelero: son una
  // oferta suya, no una tarifa del motor.
  ["lib/admin/cotizaciones-catalogo.ts", "precios de cotización, escritos a mano"],
  // Las calculadoras públicas de marketing no cotizan el hotel de nadie.
  ["components/herramientas/CalculadoraTarifa.tsx", "calculadora de marketing"],
  ["components/herramientas/CalculadoraPuntoEquilibrio.tsx", "calculadora de marketing"],
  ["components/herramientas/DescuentoMaximo.tsx", "calculadora de marketing"],
  ["components/landing/CalculadoraROI.tsx", "calculadora de marketing"],
  ["components/herramientas/Cotizacion.tsx", "calculadora pública, no cotiza el hotel de nadie"],
]);

// Excepción POR LÍNEA, no por archivo. Eximir un archivo entero deja ciego al
// guardia ahí para siempre: el modal de reserva tiene dos casos legítimos y no
// pueden costar la vigilancia del resto del archivo.
//
// ⚠️ LA MARCA VA EN LA MISMA LÍNEA, no en las anteriores. El primer intento la
// buscaba en las 6 líneas previas y eso abrió un agujero real: una razón escrita
// para una línea eximía también a la de al lado. Se comprobó metiendo el defecto
// otra vez —`getRoomBasePrice(...) * n` en el camino bueno— y el guardia no lo
// vio. Con la marca en la propia línea, cada excepción responde sólo por sí
// misma. (Se mira la línea ENTERA, con su comentario: por eso no vale `src`.)
const MARCA = /TARIFA-A-MANO:/;

for (const dir of DIRS) {
  for (const archivo of archivos(join(RAIZ, dir))) {
    const rel = relative(RAIZ, archivo);
    if (MOTOR.includes(rel) || EXENTOS.has(rel)) continue;
    const lineas = readFileSync(archivo, "utf8").split("\n");

    lineas.forEach((l, i) => {
      const n = i + 1;
      // Fuera comentarios: documentar el defecto arreglado no puede reabrirlo.
      const src = l.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");

      // Regla 1 — multiplicar un precio por noches a mano. Es exactamente la
      // forma que tenía el defecto del modal de reserva manual.
      if (
        (/(precio|price|tarifa)\w*\s*\*\s*\w*(noches|nights|n\b)/i.test(src) ||
          /\w*(noches|nights)\s*\*\s*(precio|price|tarifa)/i.test(src)) &&
        !MARCA.test(l)
      ) {
        marcar("1: precio × noches fuera del motor (usa calcRoomStayTotal)", archivo, n, l);
      }

      // Regla 2 — la BASE metida en una multiplicación. Es la forma exacta que
      // tenía el defecto (`getRoomBasePrice(room, huespedes) * noches`) y la que
      // la regla 1 no veía, porque a su izquierda hay un paréntesis y no la
      // palabra "precio". Los usos legítimos de la base —el "desde $" de Camila,
      // la tarifa normal del calendario, la comparación del diagnóstico— NO
      // multiplican nunca.
      if (/getRoomBasePrice\s*\([^)]*\)\s*\*/.test(src) && !MARCA.test(l)) {
        marcar("2: la tarifa base multiplicada (ignora temporadas; usa calcRoomStayTotal)", archivo, n, l);
      }

      // Regla 3 — `getRoomBasePrice` en algo que SÍ tiene fecha. El precio base
      // ignora las temporadas: sólo vale para un "desde" sin fecha.
      if (
        /getRoomBasePrice\s*\(/.test(src) &&
        /checkin|checkout|fecha|date|dateStr/i.test(src) &&
        !MARCA.test(l)
      ) {
        marcar("3: getRoomBasePrice con una fecha a la vista (usa getRoomNightPrice)", archivo, n, l);
      }
    });
  }
}

if (fallos.length > 0) {
  console.error(`\n🔴 precios: ${fallos.length} sitio(s) calculan tarifa fuera del motor.\n`);
  for (const f of fallos) {
    console.error(`   ${f.archivo}:${f.linea}`);
    console.error(`     regla ${f.regla}`);
    console.error(`     ${f.texto.slice(0, 120)}`);
  }
  console.error(
    "\n   El motor (lib/booking/engine.ts) sabe de temporadas, recargo de fin de\n" +
      "   semana y escalones por huéspedes. Calcular por fuera cobra la tarifa\n" +
      "   equivocada sin que nadie lo note. Si el caso es legítimo (un «desde»\n" +
      "   sin fecha), añádelo a EXENTOS con su razón escrita.\n",
  );
  process.exit(1);
}

console.log("✅ precios: nadie calcula tarifas fuera del motor.");
