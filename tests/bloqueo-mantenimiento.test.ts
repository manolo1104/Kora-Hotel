// Cerrar un cuarto por mantenimiento.
//
// Hasta el 2 sep 2026 no se podía: para cerrar una cabaña con una gotera el
// hotelero creaba una RESERVA FALSA, que ensucia la ocupación, el ADR y el CRM
// para siempre. Bloquear existía, pero de una noche por clic —diez clics para
// una gotera de diez días— y sin poder decir por qué.
//
// La mitad ya estaba hecha y nadie la usaba: `blocks.status` admitía
// 'MANTENIMIENTO' desde el principio y las once superficies que leen
// disponibilidad ya lo respetaban. Lo que faltaba era la puerta.
//
// Estas pruebas cubren las dos cosas que se pueden romper en silencio:
//   1. El convenio half-open. Un off-by-one aquí cierra una noche de más (una
//      venta perdida) o una de menos (un huésped en un cuarto roto).
//   2. Que MANTENIMIENTO siga contando como ocupación en TODAS las superficies.
//      Si alguien añade un filtro `status = 'RESERVADO'` en cualquiera de
//      ellas, el cuarto roto se vuelve a vender sin que nadie se entere.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { tramosDeCierre, nochesDeTramo, ESTADOS_CIERRE } from "@/lib/booking/cierres";

const raiz = join(__dirname, "..");
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Las fechas tal y como las devuelve /api/admin/disponibilidad. */
function dias(desde: string, n: number, status: string): Record<string, string> {
  const out: Record<string, string> = {};
  const d = new Date(`${desde}T00:00:00`);
  for (let i = 0; i < n; i++) {
    out[d.toISOString().slice(0, 10)] = status;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

describe("los días sueltos se unen en tramos", () => {
  it("tres noches seguidas son UN tramo, y `hasta` es el día de liberación", () => {
    const t = tramosDeCierre(dias("2026-09-10", 3, "MANTENIMIENTO"));
    expect(t).toEqual([
      { desde: "2026-09-10", hasta: "2026-09-13", status: "MANTENIMIENTO" },
    ]);
    // 10, 11 y 12 cerradas; la noche del 13 se vende. Mismo convenio que el
    // checkout de una reserva.
    expect(nochesDeTramo(t[0])).toBe(3);
  });

  it("un hueco en medio son DOS tramos: la noche libre se vende", () => {
    const t = tramosDeCierre({
      "2026-09-10": "BLOQUEADO",
      // el 11 no está: está a la venta
      "2026-09-12": "BLOQUEADO",
    });
    expect(t).toHaveLength(2);
    expect(t[0].hasta).toBe("2026-09-11");
    expect(t[1].desde).toBe("2026-09-12");
  });

  it("cambiar de estado corta el tramo aunque los días sean seguidos", () => {
    const t = tramosDeCierre({
      "2026-09-10": "BLOQUEADO",
      "2026-09-11": "MANTENIMIENTO",
    });
    expect(t.map((x) => x.status)).toEqual(["BLOQUEADO", "MANTENIMIENTO"]);
  });

  it("las reservas y los apartados NO son cierres: no se pintan como tales", () => {
    const t = tramosDeCierre({
      "2026-09-10": "RESERVADO",
      "2026-09-11": "OTA",
      "2026-09-12": "HOLD",
    });
    expect(t).toEqual([]);
  });

  it("el orden de las claves no importa (un objeto no está ordenado)", () => {
    const t = tramosDeCierre({
      "2026-09-12": "MANTENIMIENTO",
      "2026-09-10": "MANTENIMIENTO",
      "2026-09-11": "MANTENIMIENTO",
    });
    expect(t).toHaveLength(1);
    expect(nochesDeTramo(t[0])).toBe(3);
  });

  it("cruza el cambio de mes sin descuadrarse", () => {
    const t = tramosDeCierre(dias("2026-09-29", 4, "BLOQUEADO"));
    expect(t).toEqual([{ desde: "2026-09-29", hasta: "2026-10-03", status: "BLOQUEADO" }]);
  });

  it("sin cierres, no hay tramos", () => {
    expect(tramosDeCierre({})).toEqual([]);
  });
});

describe("MANTENIMIENTO cierra la venta en todas las superficies", () => {
  it("`getOccupiedRoomNames` no filtra por status: cualquier bloque vivo ocupa", () => {
    // Es lo que hace que un cuarto en mantenimiento desaparezca del motor, de
    // Camila y de la caja sin tocar ninguno de los tres. Si alguien añade aquí
    // un `.eq("status", …)` o un `.in("status", […])`, el cuarto roto se vuelve
    // a vender: por eso se vigila la AUSENCIA del filtro.
    const src = leer("lib/db/availability.ts");
    const fn = src.slice(
      src.indexOf("export async function getOccupiedRoomNames"),
      src.indexOf("export async function checkAvailability"),
    );
    expect(fn.length).toBeGreaterThan(200); // el corte encontró la función
    expect(fn).not.toMatch(/\.(eq|in)\(\s*["']status["']/);
  });

  it("el calendario del panel enseña los dos cierres", () => {
    const src = leer("app/api/admin/disponibilidad/route.ts");
    for (const st of ESTADOS_CIERRE) expect(src).toContain(st);
    // Y el DELETE tiene que saber quitar los dos, o «desbloqueé y sigue
    // cerrado» — el fallo que el hotelero no reporta, sólo deja de confiar.
    expect(src).toMatch(/\.in\("status", \["BLOQUEADO", "MANTENIMIENTO"\]\)/);
  });

  it("el feed iCal de salida publica los dos como ocupados", () => {
    const src = leer("app/api/h/[slug]/ical/[roomId]/route.ts");
    for (const st of ESTADOS_CIERRE) expect(src).toContain(st);
  });

  it("`unblockRooms` sabe quitar el mantenimiento, no sólo el bloqueo manual", () => {
    const src = leer("lib/db/admin.ts");
    const fn = src.slice(
      src.indexOf("export async function unblockRooms"),
      src.indexOf("export async function unblockById"),
    );
    expect(fn.length).toBeGreaterThan(200);
    expect(fn).not.toMatch(/\.eq\("status", "BLOQUEADO"\)/);
    expect(fn).toMatch(/MANTENIMIENTO/);
  });
});

describe("marcar el mapa de cuartos no basta para dejar de vender", () => {
  it("`setRoomStatus` no toca `blocks`, y eso queda dicho donde se usa", () => {
    // `room_statuses` es un estado PUNTUAL (un cuarto, un estado, sin fechas):
    // sirve para la camarista, no para el inventario. Marcar MANTENIMIENTO ahí
    // pinta el cuarto de rojo y lo sigue vendiendo. Mientras siga siendo así,
    // el mapa tiene que decírselo al hotelero.
    const admin = leer("lib/db/admin.ts");
    const fn = admin.slice(admin.indexOf("export async function setRoomStatus"));
    expect(fn.slice(0, 800)).not.toContain('from("blocks")');

    const mapa = leer("components/admin/RoomMap.tsx");
    expect(mapa).toMatch(/sigue a la venta|se sigue vendiendo|no deja de vender/i);
  });
});
