// Una reserva REEMBOLSADA no cuenta: ni como dinero, ni como ocupación, ni como
// motivo para escribirle a nadie (K-42). El estado existía en la base y el
// webhook lo escribía, pero `mapBooking` lo colapsaba en "CONFIRMADA".
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { reservaCuenta, ESTADOS_SIN_VALOR } from "@/lib/booking/estado-reserva";

describe("reservaCuenta", () => {
  it("confirmada cuenta", () => expect(reservaCuenta("CONFIRMADA")).toBe(true));
  it("manual cuenta", () => expect(reservaCuenta("MANUAL")).toBe(true));
  it("cancelada NO cuenta", () => expect(reservaCuenta("CANCELADA")).toBe(false));
  it("reembolsada NO cuenta — el dinero se devolvió", () =>
    expect(reservaCuenta("REEMBOLSADA")).toBe(false));
  it("sin estado se asume viva (no castigar por un dato faltante)", () =>
    expect(reservaCuenta(null)).toBe(true));
  it("los dos estados sin valor están listados", () =>
    expect([...ESTADOS_SIN_VALOR].sort()).toEqual(["CANCELADA", "REEMBOLSADA"]));
});

// ─────────────────────────────────────────────────────────────────────────────
// EL GUARDIÁN. El atajo `estado !== "CANCELADA"` es exactamente el que dejaba
// pasar las reembolsadas, y estaba repetido en 13 archivos. Este test falla si
// alguien lo vuelve a escribir en cualquier parte del repo.
// ─────────────────────────────────────────────────────────────────────────────

/** Usos legítimos de comparar contra CANCELADA a secas, con su razón. */
const PERMITIDOS = new Map<string, string>([
  // Traduce el estado a la etiqueta de la lista: REEMBOLSADA tiene la suya.
  // (Vivía en ReservasClient.tsx; se extrajo a lib/ para poder probarlo y para
  // que los contadores de "Hoy" dejaran de reimplementarlo a mano.)
  ["lib/booking/estado-operativo.ts", "mapea cada estado a su propia etiqueta"],
  // Detecta la TRANSICIÓN a cancelada; no filtra reservas vivas.
  ["app/api/admin/reservas/[id]/route.ts", "detecta el cambio DE estado, no filtra"],
  // Es EL mapeador: traduce fila → DTO comparando estado por estado.
  ["lib/db/admin.ts", "mapBooking traduce cada estado a su DTO"],
]);

const PATRON = /estado\s*(!==|===)\s*['"]CANCELADA['"]/;

function archivosDeCodigo(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivosDeCodigo(p, salida);
    else if (/\.(ts|tsx)$/.test(e)) salida.push(p);
  }
  return salida;
}

describe("nadie vuelve a filtrar sólo por CANCELADA", () => {
  it("ningún archivo usa el atajo salvo los dos permitidos", () => {
    const raiz = process.cwd();
    const culpables: string[] = [];
    for (const dir of ["app", "lib", "components"]) {
      for (const abs of archivosDeCodigo(join(raiz, dir))) {
        const rel = abs.slice(raiz.length + 1);
        if (PERMITIDOS.has(rel)) continue;
        const texto = readFileSync(abs, "utf8");
        for (const [i, linea] of texto.split("\n").entries()) {
          // Los comentarios pueden nombrar el atajo para explicarlo.
          if (/^\s*(\/\/|\*|\/\*)/.test(linea)) continue;
          if (PATRON.test(linea)) culpables.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(culpables, `usa reservaCuenta() en vez del atajo:\n${culpables.join("\n")}`).toEqual([]);
  });

  // Que la lista de excepciones no se quede con nombres muertos.
  it("los permitidos siguen existiendo y siguen usando el atajo", () => {
    for (const [rel, razon] of PERMITIDOS) {
      const texto = readFileSync(join(process.cwd(), rel), "utf8");
      expect(PATRON.test(texto), `${rel} ya no usa el atajo: quítalo de la lista (${razon})`).toBe(true);
    }
  });
});
