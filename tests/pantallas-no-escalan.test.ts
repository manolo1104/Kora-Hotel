// La dirección que faltaba: una pantalla NO puede dar más de lo que el puesto
// permite.
//
// `tests/pantallas-equipo.test.ts` sólo prueba «⊇»: que marcar una pestaña
// conceda TODOS sus permisos. Nadie probaba «⊆» — que no conceda de más — y por
// ahí se coló el defecto: `permisosDe` vuelca la lista entera de cada pantalla
// visible, y `pantallasDelRol` sólo compara el PRIMER permiso de esa lista
// contra la matriz. Cualquier pantalla cuyo abridor sea más permisivo que el
// resto de su lista escalaba sola, sin que nadie marcara una casilla:
//
//   · limpieza y cocina veían el IMPORTE de cada reserva (`reservas:dinero`) y
//     podían CANCELARLAS — literalmente la queja del hotel de Nealtican citada
//     en lib/panel/permisos.ts, que es la que motivó todo este sistema.
//   · recepción podía cancelar reservas, que lib/db/equipo.ts:38 promete que no.
//   · la encargada recibía el QR de WhatsApp y la CLABE que Camila le dicta a
//     los huéspedes, los dos marcados SOLO_DUENO.
//
// Estas dos pruebas se derivan de `PERMISOS`, no de una lista escrita a mano:
// un permiso nuevo queda cubierto el día que se añade.
import { describe, it, expect } from "vitest";
import { PERMISOS, puede, type Permiso } from "@/lib/panel/permisos";
import { PANTALLAS, pantallasDelRol, permisosDe } from "@/lib/panel/pantallas";
import type { RolHotel } from "@/lib/tenant";

const ROLES: RolHotel[] = ["encargada", "recepcion", "limpieza", "cocina"];
const TODOS_LOS_PERMISOS = Object.keys(PERMISOS) as Permiso[];

/** Un permiso es del dueño cuando la matriz no se lo da a nadie más. */
const esDelDueno = (p: Permiso) => PERMISOS[p].length === 1 && PERMISOS[p][0] === "dueno";

describe("el puesto manda: la plantilla no concede nada de más", () => {
  // `elegidas === null` es el caso por defecto Y el de todas las filas de
  // empleados anteriores al 1 sep 2026. Si escala aquí, escala para casi todos.
  for (const rol of ROLES) {
    it(`${rol} sin casillas tocadas no gana ni un permiso fuera de su puesto`, () => {
      const efectivos = permisosDe(rol, null);
      const deMas = [...efectivos].filter((p) => !puede(rol, p));
      expect(deMas).toEqual([]);
    });
  }
});

describe("lo que es del dueño no se entrega marcando una casilla", () => {
  it("con TODAS las pantallas marcadas, nadie recibe un permiso de dueño", () => {
    const todas = PANTALLAS.map((p) => p.id);
    for (const rol of ROLES) {
      const efectivos = permisosDe(rol, todas);
      const dueno = [...efectivos].filter(esDelDueno);
      expect(dueno, `${rol} recibió permisos de dueño`).toEqual([]);
    }
  });

  // El caso concreto que abrió esto: quien escanee ese QR queda como dispositivo
  // enlazado del WhatsApp del hotel, y la CLABE es a dónde le llega el dinero de
  // las transferencias.
  it("el QR de WhatsApp y la CLABE siguen siendo sólo del dueño", () => {
    for (const rol of ROLES) {
      const efectivos = permisosDe(rol, ["camila"]);
      expect(efectivos.has("bot:vincular"), `${rol} obtuvo el QR`).toBe(false);
      expect(efectivos.has("bot:configurar"), `${rol} obtuvo la CLABE`).toBe(false);
    }
  });

  it("el dueño no pierde nada: los sigue teniendo todos", () => {
    const suyos = permisosDe("dueno", null);
    for (const p of TODOS_LOS_PERMISOS) expect(suyos.has(p), p).toBe(true);
  });
});

describe("la feature sigue viva: una pantalla EXTRA sí abre lo suyo", () => {
  // El sentido de las casillas es dar acceso a algo que el puesto no trae. Eso
  // tiene que seguir funcionando, o el arreglo habría matado la función.
  it("marcarle Ingresos a recepción le da ingresos:ver, que su puesto no trae", () => {
    expect(puede("recepcion", "ingresos:ver")).toBe(false);
    expect(permisosDe("recepcion", ["reservas", "ingresos"]).has("ingresos:ver")).toBe(true);
  });

  it("una pantalla extra abre TODO lo suyo, menos lo que es del dueño", () => {
    for (const pantalla of PANTALLAS) {
      for (const rol of ROLES) {
        if (pantallasDelRol(rol).includes(pantalla.id)) continue; // ésa ya la trae su puesto
        const efectivos = permisosDe(rol, [pantalla.id]);
        const deberia = pantalla.permisos.filter((p) => !esDelDueno(p));
        for (const p of deberia) {
          expect(efectivos.has(p), `${rol} + ${pantalla.id} → falta ${p}`).toBe(true);
        }
      }
    }
  });
});
