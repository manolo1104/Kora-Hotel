// Que ninguna pantalla del panel vuelva a pintar texto de superficie OSCURA
// sobre el panel claro.
//
// LA HISTORIA: el primer hotelero que usó Kora en serio tuvo que instalar una
// extensión de modo oscuro para poder trabajar — "el fondo es blanco y las
// letras son blancas y uno no sabe qué está haciendo". Aquello se arregló en el
// resto del panel, pero el mapa de cuartos se quedó fuera: venía del panel de
// Paraíso, que era oscuro, y traía TODO su texto en crema fijo
// `rgba(250, 248, 245, X)` más los colores 400 de Tailwind. Sobre el panel claro
// de Kora los nombres de los cuartos eran blanco sobre verde pálido: ~1.2:1,
// contra el 4.5:1 que hace falta para leer. El mismo cliente lo reportó otra vez.
//
// La regla: el color de texto sale de los tokens del tema (`--ink`, `--clay`,
// `--chip-*-text`), que ya voltean con el tema oscuro. Nunca de un valor fijo
// pensado para un fondo concreto.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** El crema de superficie oscura, y los tonos 400 de Tailwind como TEXTO. */
const CREMA_OSCURO = /rgba\(\s*250,\s*248,\s*245/;

/**
 * Cremas y grises escritos a mano donde debería ir `var(--line)`.
 *
 * No cambian con el tema, así que sobre la tarjeta oscura del panel quedan como
 * bordes encendidos: medido en producción, el borde de un campo del modal de
 * reservas daba **10.5:1** contra su fondo, cuando una línea divisoria debería
 * andar por 1.5-3:1. Por eso el formulario parecía una rejilla de cajas.
 */
const LINEA_FIJA = /(border[^:]*|background[^:]*)\s*:[^;]*#(e4ddd3|d4cec7|c9b99a|f0ebe3|e5e7eb)\b/i;
const BLANCO_TRANSLUCIDO = /(color|border[^:]*)\s*:\s*rgba\(\s*255,\s*255,\s*255/;

/** Ficheros del panel que se pintan sobre el fondo claro del shell. */
function cssDelPanel(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) cssDelPanel(p, salida);
    else if (e.endsWith(".module.css")) salida.push(p);
  }
  return salida;
}

/**
 * Excepciones con su razón. La lista sólo puede ENCOGER.
 * Una superficie deliberadamente oscura (la barra lateral verde) sí puede
 * llevar texto claro fijo: ahí el fondo no depende del tema.
 */
const PERMITIDOS = new Map<string, string>([
  ["components/admin/AdminSidebar.module.css", "la barra lateral es verde oscuro en los dos temas"],
]);

describe("ninguna pantalla del panel pinta texto de superficie oscura sobre el panel claro", () => {
  const raiz = process.cwd();
  const archivos = [
    ...cssDelPanel(join(raiz, "app/panel")),
    ...cssDelPanel(join(raiz, "components/admin")),
    ...cssDelPanel(join(raiz, "components/panel")),
  ];

  it("encuentra los CSS del panel (si esto da 0, el test no vigila nada)", () => {
    // Un chivato que no mira ningún archivo pasa siempre y no sirve de nada.
    expect(archivos.length).toBeGreaterThan(5);
  });

  it("nadie usa el crema fijo rgba(250,248,245,…) como color de texto", () => {
    const culpables: string[] = [];
    for (const abs of archivos) {
      const rel = abs.slice(raiz.length + 1);
      if (PERMITIDOS.has(rel)) continue;
      for (const [i, linea] of readFileSync(abs, "utf8").split("\n").entries()) {
        if (/^\s*(\/\*|\*)/.test(linea)) continue; // los comentarios pueden nombrarlo
        if (CREMA_OSCURO.test(linea)) culpables.push(`${rel}:${i + 1}`);
      }
    }
    expect(
      culpables,
      `usa var(--ink) / var(--clay) en vez del crema fijo:\n${culpables.join("\n")}`,
    ).toEqual([]);
  });

  it("nadie usa blanco translúcido como texto ni como línea (invisible sobre claro)", () => {
    const culpables: string[] = [];
    for (const abs of archivos) {
      const rel = abs.slice(raiz.length + 1);
      if (PERMITIDOS.has(rel)) continue;
      for (const [i, linea] of readFileSync(abs, "utf8").split("\n").entries()) {
        if (/^\s*(\/\*|\*)/.test(linea)) continue;
        if (BLANCO_TRANSLUCIDO.test(linea)) culpables.push(`${rel}:${i + 1}`);
      }
    }
    expect(
      culpables,
      `usa var(--line) / var(--ink) en vez de blanco translúcido:\n${culpables.join("\n")}`,
    ).toEqual([]);
  });

  it("nadie escribe a mano el color de una línea divisoria", () => {
    const culpables: string[] = [];
    for (const abs of archivos) {
      const rel = abs.slice(raiz.length + 1);
      if (PERMITIDOS.has(rel)) continue;
      for (const [i, linea] of readFileSync(abs, "utf8").split("\n").entries()) {
        if (/^\s*(\/\*|\*)/.test(linea)) continue;
        if (LINEA_FIJA.test(linea)) culpables.push(`${rel}:${i + 1}`);
      }
    }
    expect(
      culpables,
      `usa var(--line), que voltea con el tema:\n${culpables.join("\n")}`,
    ).toEqual([]);
  });

  it("el mapa de cuartos toma sus colores de estado de los tokens de chip, no de hex sueltos", () => {
    // Eran #4ade80 / #facc15 / #f87171 / #60a5fa: los tonos 400 de Tailwind,
    // pensados para fondo oscuro. Sobre el panel claro quedaban lavados.
    const tsx = readFileSync(join(raiz, "components/admin/RoomMap.tsx"), "utf8");
    const config = tsx.slice(tsx.indexOf("const STATUS_CONFIG"), tsx.indexOf("interface EditModal"));
    expect(config).not.toMatch(/#[0-9a-fA-F]{6}/);
    for (const par of ["chip-ok", "chip-aviso", "chip-mal", "chip-info"]) {
      expect(config).toContain(`var(--${par}-text)`);
      expect(config).toContain(`var(--${par}-bg)`);
    }
  });
});
