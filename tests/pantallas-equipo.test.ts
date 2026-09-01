// Qué pestañas ve cada persona del equipo, y qué le concede cada pestaña.
//
// LA REGLA que vigilan estos casos (decisión de Manolo, 1 sep 2026): **el
// puesto es una PLANTILLA, no un techo.** Quien administra el hotel elige sin
// bloqueos, y por eso lo que hay que garantizar aquí ya no es "nadie sube de su
// rol" sino dos cosas más finas:
//
//   1. Marcar una pestaña la abre ENTERA: concede todos los permisos que esa
//      pantalla necesita. Media concesión —la pantalla abre y su API contesta
//      403— se ve como que el panel se descompuso.
//   2. Quitar una pestaña esconde la pantalla, pero NO le retira a alguien lo
//      que su puesto le da en otra parte.
//
// Y lo que NO se puede dar con una casilla: bajarse el fichero completo de
// huéspedes y borrar el hotel. No son pantallas de este panel.
import { describe, it, expect } from "vitest";
import {
  PANTALLAS,
  pantallasDelRol,
  pantallasPermitidas,
  permisosDe,
  verPantalla,
  motivoCierre,
  sanearPantallas,
  type PantallaId,
} from "@/lib/panel/pantallas";
import { puede, PERMISOS, type Permiso } from "@/lib/panel/permisos";
import type { RolHotel } from "@/lib/tenant";

const ROLES: RolHotel[] = ["dueno", "encargada", "recepcion", "limpieza", "cocina"];
const TODAS = PANTALLAS.map((p) => p.id);

describe("marcar una pestaña la abre ENTERA", () => {
  it("cada pantalla concede todos los permisos que necesita", () => {
    for (const p of PANTALLAS) {
      // Una camarista con SÓLO esa pestaña marcada tiene que poder usarla.
      const permisos = permisosDe("limpieza", [p.id]);
      for (const necesario of p.permisos) {
        expect(permisos.has(necesario), `${p.id} necesita ${necesario}`).toBe(true);
      }
      expect(verPantalla("limpieza", [p.id], p.id)).toBe(true);
    }
  });

  it("una camarista con 'Ingresos' marcado la puede abrir y leer", () => {
    const elegidas: PantallaId[] = ["operaciones", "ingresos"];
    expect(verPantalla("limpieza", elegidas, "ingresos")).toBe(true);
    expect(permisosDe("limpieza", elegidas).has("ingresos:ver")).toBe(true);
    expect(motivoCierre("limpieza", elegidas, "ingresos")).toBe(null);
  });

  it("una recepcionista con 'Camila' marcado puede entrenarla", () => {
    const elegidas: PantallaId[] = ["reservas", "camila"];
    const permisos = permisosDe("recepcion", elegidas);
    expect(permisos.has("bot:leer")).toBe(true);
    expect(permisos.has("bot:entrenar")).toBe(true);
  });
});

describe("quitar una pestaña esconde la pantalla, no desarma el puesto", () => {
  it("a recepción sin 'Cotizaciones' le queda lo demás de su puesto", () => {
    const elegidas: PantallaId[] = ["reservas", "calendario", "clientes", "operaciones"];
    expect(verPantalla("recepcion", elegidas, "cotizaciones")).toBe(false);
    // Su puesto sigue mandando fuera de la pantalla escondida.
    const permisos = permisosDe("recepcion", elegidas);
    expect(permisos.has("reservas:escribir")).toBe(true);
    expect(permisos.has("clientes:leer")).toBe(true);
  });

  it("el aviso distingue 'te la escondieron' de 'no es de tu puesto'", () => {
    const elegidas: PantallaId[] = ["operaciones"];
    expect(motivoCierre("limpieza", elegidas, "reservas")).toBe("escondida"); // sí es de Limpieza
    expect(motivoCierre("limpieza", elegidas, "pagos")).toBe("puesto"); // nunca lo fue
    expect(motivoCierre("limpieza", elegidas, "operaciones")).toBe(null);
  });
});

describe("lo que NINGUNA casilla puede conceder", () => {
  const INTOCABLES: Permiso[] = ["datos:exportar", "hotel:eliminar"];

  it("bajarse los datos y borrar el hotel siguen siendo del dueño", () => {
    for (const rol of ROLES.filter((r) => r !== "dueno")) {
      const conTodo = permisosDe(rol, TODAS); // se marcan TODAS las pestañas
      for (const p of INTOCABLES) {
        expect(conTodo.has(p), `${rol} con todo marcado no debe tener ${p}`).toBe(false);
      }
    }
  });

  it("ninguna entrada del catálogo los declara", () => {
    for (const p of PANTALLAS) {
      for (const permiso of p.permisos) {
        expect(INTOCABLES).not.toContain(permiso);
      }
    }
  });
});

describe("el puesto sigue siendo la plantilla", () => {
  it("sin elegir nada, cada quien ve lo de siempre", () => {
    const ve = pantallasPermitidas("limpieza", null);
    expect(ve.has("operaciones")).toBe(true);
    expect(ve.has("reservas")).toBe(true);
    expect(ve.has("ingresos")).toBe(false);
    expect(ve.has("pagos")).toBe(false);
  });

  it("la plantilla de cada rol coincide con la matriz de permisos", () => {
    for (const rol of ROLES) {
      for (const id of pantallasDelRol(rol)) {
        const p = PANTALLAS.find((x) => x.id === id)!;
        expect(puede(rol, p.permisos[0]), `${rol} → ${id}`).toBe(true);
      }
    }
  });

  it("los permisos de su puesto nunca se pierden", () => {
    for (const rol of ROLES) {
      const permisos = permisosDe(rol, ["operaciones"]);
      for (const p of Object.keys(PERMISOS) as Permiso[]) {
        if (puede(rol, p)) expect(permisos.has(p), `${rol} perdió ${p}`).toBe(true);
      }
    }
  });
});

describe("al dueño no se le recorta nunca", () => {
  it("ve las 13 pantallas aunque se guarde una selección mínima", () => {
    const ve = pantallasPermitidas("dueno", ["operaciones"]);
    expect(ve.size).toBe(PANTALLAS.length);
    expect(ve.has("equipo")).toBe(true);
    expect(ve.has("pagos")).toBe(true);
  });

  it("guardar pantallas de un dueño se ignora: queda en null", () => {
    expect(sanearPantallas("dueno", ["operaciones"])).toEqual({ ok: true, pantallas: null });
  });

  it("conserva todos sus permisos", () => {
    const permisos = permisosDe("dueno", ["operaciones"]);
    for (const p of Object.keys(PERMISOS) as Permiso[]) expect(permisos.has(p)).toBe(true);
  });
});

describe("sanear lo que llega del panel", () => {
  it("descarta ids inventados pero CONSERVA las de otro puesto", () => {
    // Ésta es la diferencia con el diseño anterior: "ingresos" ya no se recorta.
    expect(sanearPantallas("limpieza", ["operaciones", "ingresos", "no-existe"])).toEqual({
      ok: true,
      pantallas: ["ingresos", "operaciones"], // en el orden del catálogo
    });
  });

  it("dejar a alguien sin ninguna pestaña se rechaza", () => {
    // Un panel vacío no se lee como "no te toca": se lee como "se descompuso",
    // y quien recibe la llamada es el hotelero.
    expect(sanearPantallas("limpieza", [])).toEqual({ ok: false, error: "sin-pantallas" });
    expect(sanearPantallas("limpieza", ["no-existe"])).toEqual({
      ok: false,
      error: "sin-pantallas",
    });
  });

  it("marcar justo la plantilla equivale a null: una sola forma de decir lo mismo", () => {
    expect(sanearPantallas("recepcion", pantallasDelRol("recepcion"))).toEqual({
      ok: true,
      pantallas: null,
    });
  });

  it("null se queda en null (las filas de antes de la columna no cambian)", () => {
    expect(sanearPantallas("recepcion", null)).toEqual({ ok: true, pantallas: null });
    expect(sanearPantallas("recepcion", undefined)).toEqual({ ok: true, pantallas: null });
  });

  it("guarda siempre en el orden del catálogo", () => {
    const a = sanearPantallas("limpieza", ["ingresos", "operaciones"]);
    const b = sanearPantallas("limpieza", ["operaciones", "ingresos"]);
    expect(a).toEqual(b);
  });
});

describe("el catálogo está sano", () => {
  it("no hay ids repetidos", () => {
    expect(new Set(TODAS).size).toBe(TODAS.length);
  });

  it("cada pantalla declara al menos un permiso, y todos existen en la matriz", () => {
    for (const p of PANTALLAS) {
      expect(p.permisos.length, p.id).toBeGreaterThan(0);
      for (const permiso of p.permisos) expect(PERMISOS[permiso], `${p.id} → ${permiso}`).toBeDefined();
    }
  });

  it("las tres pantallas delicadas traen su aviso escrito", () => {
    // Se pueden dar, pero no a ciegas: son la cuenta de banco, el WhatsApp del
    // hotel y la pantalla que deja darse a uno mismo cualquier puesto.
    for (const id of ["camila", "pagos", "equipo"] as PantallaId[]) {
      expect(PANTALLAS.find((p) => p.id === id)?.aviso, id).toBeTruthy();
    }
  });

  it("con TODAS marcadas se llega a todo lo que da el puesto de encargada", () => {
    // Red contra una pantalla que se quede sin declarar un permiso suyo: si algo
    // que la encargada puede hacer no lo concede ninguna pestaña, es que hay una
    // pantalla incompleta en el catálogo.
    const conTodo = permisosDe("limpieza", TODAS);
    for (const p of Object.keys(PERMISOS) as Permiso[]) {
      if (puede("encargada", p)) expect(conTodo.has(p), `ninguna pestaña concede ${p}`).toBe(true);
    }
  });
});
