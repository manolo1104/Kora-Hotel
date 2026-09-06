// Bajar la prueba de 30 a 14 días SIN quitarle días a quien ya estaba dentro.
//
// El riesgo no es el número: es que la fecha de fin no se guarda en ninguna
// parte. Se recalcula desde el alta cada vez que alguien la consulta, así que
// cambiar la constante a secas reescribe el pasado — un hotel de 20 días pasaba
// de 10 restantes a −6, o sea VENCIDO de un día para otro, con el motor de
// reservas pausado y Camila apagada sin avisar a nadie.
//
// El patrón ya estaba inventado en este mismo archivo (`LANZAMIENTO_PRUEBA`,
// «nadie amanece pausado por un cambio de reglas retroactivo»); aquí se aplica
// otra vez y se fija con pruebas.
import { describe, it, expect } from "vitest";
import { pruebaDelHotel, PRUEBA_DIAS } from "@/lib/suscripcion";

const DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const ahora = () => Date.now();

// Antes del corte (2026-09-06): reglas viejas, 30 días.
const ANTES = Date.parse("2026-08-20T12:00:00-06:00");
// Después del corte: reglas nuevas, 14 días.
const DESPUES = Date.parse("2026-09-20T12:00:00-06:00");

describe("quien ya estaba dentro conserva sus 30 días", () => {
  it("un hotel de antes del cambio termina a los 30, no a los 14", () => {
    const p = pruebaDelHotel({ created_at: iso(ANTES) });
    expect(p).not.toBeNull();
    expect(p!.fin.getTime()).toBe(ANTES + 30 * DIA);
  });

  // El caso que se quería evitar: con 14 días a secas, un hotel de 20 días de
  // antigüedad amanecía vencido.
  it("un hotel con 20 días de antigüedad NO amanece vencido", () => {
    const p = pruebaDelHotel({ created_at: iso(ahora() - 20 * DIA) });
    expect(p!.vencida).toBe(false);
    expect(p!.diasRestantes).toBeGreaterThan(0);
  });

  it("y si de verdad ya pasaron sus 30, sí está vencida", () => {
    const p = pruebaDelHotel({ created_at: iso(ahora() - 40 * DIA) });
    expect(p!.vencida).toBe(true);
    expect(p!.diasRestantes).toBe(0);
  });
});

describe("quien se da de alta desde el cambio tiene 14", () => {
  it("la constante pública dice 14, que es el número de la web", () => {
    expect(PRUEBA_DIAS).toBe(14);
  });

  it("un hotel nuevo termina a los 14 días de su alta", () => {
    const p = pruebaDelHotel({ created_at: iso(DESPUES) });
    expect(p!.fin.getTime()).toBe(DESPUES + 14 * DIA);
  });
});

describe("lo que no cambia", () => {
  it("el hotel de demostración sigue sin caducar nunca", () => {
    expect(pruebaDelHotel({ created_at: iso(ANTES), extras: { demo: true } })).toBeNull();
  });

  // Sembrar el ancla tarde no puede quitarle días a nadie: se toma la fecha más
  // antigua de las dos.
  it("manda la fecha más antigua entre el alta del hotel y la del dueño", () => {
    const p = pruebaDelHotel({ created_at: iso(DESPUES) }, iso(ANTES));
    expect(p!.fin.getTime()).toBe(ANTES + 30 * DIA);
  });

  it("un hotel anterior al lanzamiento de la prueba sigue contando desde el lanzamiento", () => {
    const p = pruebaDelHotel({ created_at: "2026-01-01T00:00:00Z" });
    expect(p!.fin.getTime()).toBe(Date.parse("2026-07-10T00:00:00-06:00") + 30 * DIA);
  });
});
