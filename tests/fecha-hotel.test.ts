// El día del hotel, y el defecto que arregla.
//
// EL DEFECTO REAL: la lista de Reservas calculaba "hoy" en zona de México, pero
// el mapa de cuartos y los Insights usaban `new Date().toISOString()`, que es
// UTC. México va UTC-6, así que DE LAS 18:00 A LA MEDIANOCHE hora local el
// servidor ya estaba en el día siguiente: el mapa marcaba ocupados los cuartos
// de las llegadas de MAÑANA y sacaba a los de hoy, mientras la lista seguía
// enseñando el día correcto. Dos pantallas del mismo panel contradiciéndose cada
// tarde. Es el síntoma que el hotelero reportó como "algunas veces en las
// reservas no se agregan correctamente los números de check-in y check-out".
//
// OJO: la suite corre con TZ=UTC (ver package.json), así que si esto se hiciera
// con `toISOString()` fallaría aquí exactamente igual que en Vercel, que también
// corre en UTC.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { hoyHotel, sumarDias, ZONA_HOTEL } from "@/lib/fecha-hotel";

describe("hoyHotel", () => {
  it("🔴 EL DEFECTO: a las 19:00 de México, UTC ya dice mañana", () => {
    // 2 sep 2026, 19:00 en México = 3 sep 01:00 UTC.
    const tarde = new Date("2026-09-03T01:00:00Z");
    expect(tarde.toISOString().split("T")[0]).toBe("2026-09-03"); // lo que veía el mapa
    expect(hoyHotel(tarde)).toBe("2026-09-02"); // lo que veía la lista, y lo correcto
  });

  it("a las 23:59 de México sigue siendo hoy", () => {
    expect(hoyHotel(new Date("2026-09-03T05:59:00Z"))).toBe("2026-09-02");
  });

  it("a las 00:01 de México ya es el día nuevo", () => {
    expect(hoyHotel(new Date("2026-09-03T06:01:00Z"))).toBe("2026-09-03");
  });

  it("por la mañana UTC y México coinciden (por eso el defecto sólo salía de tarde)", () => {
    const manana = new Date("2026-09-02T15:00:00Z"); // 09:00 en México
    expect(hoyHotel(manana)).toBe(manana.toISOString().split("T")[0]);
  });

  it("devuelve siempre YYYY-MM-DD, que es como llegan checkin/checkout de Postgres", () => {
    expect(hoyHotel()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("la zona está declarada y es la del hotel", () => {
    expect(ZONA_HOTEL).toBe("America/Mexico_City");
  });
});

describe("sumarDias", () => {
  it("suma y resta sin salirse del formato", () => {
    expect(sumarDias("2026-09-02", 1)).toBe("2026-09-03");
    expect(sumarDias("2026-09-02", -2)).toBe("2026-08-31");
  });
  it("cruza fin de mes y de año", () => {
    expect(sumarDias("2026-08-31", 1)).toBe("2026-09-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("cruza el cambio de horario de verano sin perder un día", () => {
    // El ancla es el mediodía UTC justamente para esto.
    expect(sumarDias("2026-10-24", 1)).toBe("2026-10-25");
    expect(sumarDias("2026-04-04", 1)).toBe("2026-04-05");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EL GUARDIÁN. Nadie vuelve a calcular "hoy" con toISOString() en el panel: es
// exactamente el atajo que hacía que dos pantallas dijeran días distintos.
// ─────────────────────────────────────────────────────────────────────────────

/** Usos legítimos, con su razón escrita. */
const PERMITIDOS = new Map<string, string>([
  // Formatea un día YA construido (las barras del forecast salen de sumar días
  // a partir de `hoyHotel()`), no averigua qué día es hoy.
  ["lib/admin/insights.ts", "formatea una fecha ya calculada, no obtiene 'hoy'"],
  // Son los extremos de la ventana visible del Gantt, no "hoy": su línea de hoy
  // ya sale de hoyHotel().
  ["app/panel/[slug]/(operativo)/calendario/GanttView.tsx", "extremos del rango visible, no 'hoy'"],
]);

/** `new Date().toISOString()` / `now.toISOString()` → el atajo que rompía. */
const PATRON = /\b(new Date\(\)|now)\s*\.toISOString\(\)/;

function archivosDeCodigo(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivosDeCodigo(p, salida);
    else if (/\.(ts|tsx)$/.test(e)) salida.push(p);
  }
  return salida;
}

describe("nadie calcula 'hoy' en UTC dentro del panel", () => {
  it("ninguna pantalla del panel usa el atajo", () => {
    const raiz = process.cwd();
    const culpables: string[] = [];
    for (const dir of ["app/panel", "app/api/admin", "lib/admin", "components/admin"]) {
      for (const abs of archivosDeCodigo(join(raiz, dir))) {
        const rel = abs.slice(raiz.length + 1);
        if (PERMITIDOS.has(rel)) continue;
        for (const [i, linea] of readFileSync(abs, "utf8").split("\n").entries()) {
          if (/^\s*(\/\/|\*|\/\*)/.test(linea)) continue; // los comentarios pueden nombrarlo
          // Guardar una MARCA DE TIEMPO en ISO está bien (es un instante, no un
          // día del calendario). Lo que rompe es recortarla a YYYY-MM-DD.
          if (PATRON.test(linea) && /split\(["']T["']\)/.test(linea)) {
            culpables.push(`${rel}:${i + 1}`);
          }
        }
      }
    }
    expect(culpables, `usa hoyHotel() en vez de toISOString():\n${culpables.join("\n")}`).toEqual([]);
  });

  it("los permitidos siguen existiendo (la lista sólo puede encoger)", () => {
    for (const [rel] of PERMITIDOS) {
      expect(() => readFileSync(join(process.cwd(), rel), "utf8")).not.toThrow();
    }
  });
});
