// Las temporadas de tarifa: lo que hace que un hotel cobre distinto en Semana
// Santa que en martes de septiembre. Y lo que, mal puesto, le regala el año.
//
// 🔴 EL DEFECTO QUE ESTO CIERRA. Hasta el 2 sep 2026 una temporada de PRECIO
// FIJO ponía el MISMO número a todas las habitaciones, y el único piso que
// existía era CERO pesos. Un hotelero que teclea "150" pensando en su cuarto
// más barato vendía también las suites de $1,900 a $150, en la semana de mayor
// demanda del año, por el motor y por WhatsApp, sin que nada se lo dijera. Un
// porcentaje de −90 % pasaba igual de fácil.
//
// Antes de esta tanda no existía NI UN test de `parseTemporadas`,
// `temporadasDe`, `nightOpts` ni `seasonMinNoches`. La parte del producto que
// decide cuánto se cobra estaba sin red.
//
// TZ=UTC lo pone `npm test`: `getRoomNightPrice` usa `.getDay()`, que es hora
// local. Ver la cabecera de `tests/engine.test.ts`.
import { describe, it, expect } from "vitest";
import {
  getRoomNightPrice,
  applyAdjustment,
  ajusteDeTemporada,
  PISO_TARIFA_PCT,
  type BookingRoom,
  type Temporada,
} from "@/lib/booking/engine";
import { temporadasDe, nightOpts } from "@/lib/booking/rooms";

const SUITE: BookingRoom = {
  id: 1,
  name: "Suite Jungla",
  price: 1900,
  priceTiers: { 2: 1900, 4: 2400 },
  maxGuests: 4,
  cantidad: 1,
  unidades: ["Suite Jungla"],
};

const CABANA: BookingRoom = {
  id: 2,
  name: "Cabaña",
  price: 600,
  priceTiers: {},
  maxGuests: 2,
  cantidad: 1,
  unidades: ["Cabaña"],
};

/** Un hotel tal y como llega del jsonb, para probar el saneado. */
function hotelCon(temporadas: unknown) {
  return { extras: { temporadas }, config: {} } as never;
}

const SEMANA_SANTA = { desde: "2027-04-08", hasta: "2027-04-25" };

describe("el piso de tarifa: el accidente ya no es posible", () => {
  it("EL CASO REAL: $150 fijos en una suite de $1,900 no se venden a $150", () => {
    const t: Temporada = {
      id: "ss", nombre: "Semana Santa", ...SEMANA_SANTA,
      ajuste: { tipo: "fijo", valor: 150 },
    };
    const precio = getRoomNightPrice(SUITE, 2, "2027-04-10", { temporadas: [t] });
    expect(precio).toBeGreaterThan(150);
    expect(precio).toBe(Math.round((1900 * PISO_TARIFA_PCT) / 100)); // $475
  });

  it("un −90 % tampoco baja del piso", () => {
    expect(applyAdjustment(1900, { tipo: "porcentaje", valor: -90 })).toBe(475);
  });

  it("una promoción agresiva de verdad SÍ pasa: el piso no es el aviso", () => {
    // −50 % (un 2x1) y −70 % (liquidación de temporada baja) están por encima
    // del piso y tienen que funcionar. Si esto se cae, el piso está mal puesto
    // y le estamos prohibiendo al hotelero hacer su trabajo.
    expect(applyAdjustment(1900, { tipo: "porcentaje", valor: -50 })).toBe(950);
    expect(applyAdjustment(1900, { tipo: "porcentaje", valor: -70 })).toBe(570);
  });

  it("subir precios no se toca: el piso sólo mira hacia abajo", () => {
    expect(applyAdjustment(1900, { tipo: "porcentaje", valor: 40 })).toBe(2660);
    expect(applyAdjustment(1900, { tipo: "fijo", valor: 3500 })).toBe(3500);
  });

  it("un cuarto sin precio base no inventa un piso", () => {
    expect(applyAdjustment(0, { tipo: "fijo", valor: 0 })).toBe(0);
    expect(applyAdjustment(0, { tipo: "porcentaje", valor: -50 })).toBe(0);
  });

  it("el piso se calcula sobre el ESCALÓN que toca, no sobre `price`", () => {
    // 4 huéspedes pagan $2,400, así que su piso es mayor que el de 2.
    const t: Temporada = {
      id: "ss", nombre: "Semana Santa", ...SEMANA_SANTA,
      ajuste: { tipo: "fijo", valor: 1 },
    };
    expect(getRoomNightPrice(SUITE, 4, "2027-04-10", { temporadas: [t] })).toBe(600);
    expect(getRoomNightPrice(SUITE, 2, "2027-04-10", { temporadas: [t] })).toBe(475);
  });
});

describe("precio de temporada por tipo de habitación", () => {
  const PORTIPO: Temporada = {
    id: "ss", nombre: "Semana Santa", ...SEMANA_SANTA,
    ajuste: { tipo: "fijo", valor: 150 },     // el respaldo viejo
    // Indexado por NOMBRE, no por id: el id es el índice en el jsonb, así que
    // borrar un cuarto le pasaría el precio al de al lado sin avisar.
    porTipo: {
      "Suite Jungla": { tipo: "fijo", valor: 3500 },
      "Cabaña": { tipo: "fijo", valor: 1200 },
    },
  };

  it("cada cuarto cobra LO SUYO, no el mismo número para todos", () => {
    expect(getRoomNightPrice(SUITE, 2, "2027-04-10", { temporadas: [PORTIPO] })).toBe(3500);
    expect(getRoomNightPrice(CABANA, 2, "2027-04-10", { temporadas: [PORTIPO] })).toBe(1200);
  });

  it("un cuarto SIN entrada propia cae al respaldo global", () => {
    const otro: BookingRoom = { ...CABANA, id: 9, name: "Otro", price: 800 };
    // 150 está por debajo del piso de 800 (=200), así que sale el piso: el
    // respaldo global sigue existiendo pero no puede regalar nada.
    expect(getRoomNightPrice(otro, 2, "2027-04-10", { temporadas: [PORTIPO] })).toBe(200);
  });

  it("una temporada VIEJA (sin porTipo) sigue funcionando igual", () => {
    // Es lo que hace que el despliegue no rompa a los hoteles que ya tienen
    // temporadas guardadas. Si esto se cae, el día del deploy se caen todos.
    const vieja: Temporada = {
      id: "x", nombre: "Alta", ...SEMANA_SANTA,
      ajuste: { tipo: "porcentaje", valor: 40 },
    };
    expect(getRoomNightPrice(SUITE, 2, "2027-04-10", { temporadas: [vieja] })).toBe(2660);
    expect(getRoomNightPrice(CABANA, 2, "2027-04-10", { temporadas: [vieja] })).toBe(840);
  });

  it("`ajusteDeTemporada` resuelve por nombre y cae al global si no lo hay", () => {
    expect(ajusteDeTemporada(PORTIPO, SUITE)).toEqual({ tipo: "fijo", valor: 3500 });
    expect(ajusteDeTemporada(PORTIPO, CABANA)).toEqual({ tipo: "fijo", valor: 1200 });
    expect(ajusteDeTemporada(PORTIPO, { id: 9, name: "Otro" })).toEqual({ tipo: "fijo", valor: 150 });
  });

  it("REORDENAR los cuartos NO le pasa el precio al de al lado", () => {
    // El fallo que evita indexar por nombre: `hotelRooms` da `id = índice + 1`,
    // así que borrar el primer cuarto convertía al segundo en el id 1. Con
    // claves por id, la suite habría heredado el precio de la cabaña en
    // silencio. Aquí se les cambian los ids y cada uno mantiene lo suyo.
    const suiteMovida = { ...SUITE, id: 7 };
    const cabanaMovida = { ...CABANA, id: 1 };
    expect(ajusteDeTemporada(PORTIPO, suiteMovida)).toEqual({ tipo: "fijo", valor: 3500 });
    expect(ajusteDeTemporada(PORTIPO, cabanaMovida)).toEqual({ tipo: "fijo", valor: 1200 });
  });

  it("con precios por cuarto, un cuarto NUEVO conserva su precio normal", () => {
    // El respaldo global de una temporada de precio fijo se guarda como 0 %, no
    // como $0. Si fuera $0, cualquier habitación creada DESPUÉS de la temporada
    // caería al piso del motor —un 75 % de descuento— sin que nadie lo pidiera.
    // Un 0 % la deja en su tarifa, que es el único respaldo que no cuesta dinero.
    const conRespaldoSeguro: Temporada = {
      id: "ss", nombre: "Semana Santa", ...SEMANA_SANTA,
      ajuste: { tipo: "porcentaje", valor: 0 },
      porTipo: { "Suite Jungla": { tipo: "fijo", valor: 3500 } },
    };
    const nuevo: BookingRoom = { ...CABANA, id: 5, name: "Cuarto nuevo", price: 1000, priceTiers: {} };
    expect(getRoomNightPrice(SUITE, 2, "2027-04-10", { temporadas: [conRespaldoSeguro] })).toBe(3500);
    expect(getRoomNightPrice(nuevo, 2, "2027-04-10", { temporadas: [conRespaldoSeguro] })).toBe(1000);
  });

  it("fuera de las fechas de la temporada no aplica nada", () => {
    expect(getRoomNightPrice(SUITE, 2, "2027-05-01", { temporadas: [PORTIPO] })).toBe(1900);
  });
});

describe("el saneado del jsonb (que es por donde entra lo raro)", () => {
  it("lee una temporada bien formada con su porTipo", () => {
    const t = temporadasDe(hotelCon([
      { id: "a", nombre: "Alta", ...SEMANA_SANTA,
        ajuste: { tipo: "fijo", valor: 900 },
        porTipo: { "Suite Jungla": { tipo: "fijo", valor: 3500 } } },
    ]));
    expect(t).toHaveLength(1);
    expect(t[0].porTipo).toEqual({ "Suite Jungla": { tipo: "fijo", valor: 3500 } });
  });

  it("una entrada rota de porTipo se descarta SOLA, sin tirar la temporada", () => {
    // Quedarse sin temporada es peor que quedarse sin el precio especial de un
    // cuarto: lo primero descuadra el hotel entero.
    const t = temporadasDe(hotelCon([
      { id: "a", nombre: "Alta", ...SEMANA_SANTA,
        ajuste: { tipo: "porcentaje", valor: 20 },
        porTipo: {
          "Suite Jungla": { tipo: "fijo", valor: 3500 },
          "Cabaña": { tipo: "gratis", valor: 0 },      // tipo inventado
          "Otro": { tipo: "fijo", valor: "mucho" },    // valor no numérico
        } },
    ]));
    expect(t).toHaveLength(1);
    expect(Object.keys(t[0].porTipo ?? {})).toEqual(["Suite Jungla"]);
  });

  it("un porTipo que no es un objeto se ignora sin reventar", () => {
    for (const basura of [[], "sí", 42, null]) {
      const t = temporadasDe(hotelCon([
        { id: "a", nombre: "Alta", ...SEMANA_SANTA,
          ajuste: { tipo: "porcentaje", valor: 20 }, porTipo: basura },
      ]));
      expect(t).toHaveLength(1);
      expect(t[0].porTipo).toBeUndefined();
    }
  });

  it("las fechas al revés o mal formadas descartan la temporada entera", () => {
    expect(temporadasDe(hotelCon([
      { id: "a", nombre: "X", desde: "2027-04-25", hasta: "2027-04-08",
        ajuste: { tipo: "fijo", valor: 900 } },
    ]))).toEqual([]);
    expect(temporadasDe(hotelCon([
      { id: "a", nombre: "X", desde: "25/04/2027", hasta: "2027-04-08",
        ajuste: { tipo: "fijo", valor: 900 } },
    ]))).toEqual([]);
  });

  it("`nightOpts` entrega las temporadas ya saneadas al motor", () => {
    const opts = nightOpts(hotelCon([
      { id: "a", nombre: "Alta", ...SEMANA_SANTA,
        ajuste: { tipo: "fijo", valor: 1 },
        porTipo: { "Suite Jungla": { tipo: "fijo", valor: 3500 } } },
    ]));
    expect(getRoomNightPrice(SUITE, 2, "2027-04-10", opts)).toBe(3500);
    // Y el respaldo de $1 sigue sin poder regalar la cabaña: sale su piso.
    expect(getRoomNightPrice(CABANA, 2, "2027-04-10", opts)).toBe(150);
  });
});

describe("solape de temporadas: gana la primera de la lista", () => {
  it("una temporada vieja y ancha puede secuestrar otra, y hay que saberlo", () => {
    // No es un fallo que se arregle en el motor —solapar puede ser
    // intencional— pero SÍ hay que dejarlo probado: la regla es el orden de la
    // lista, no la fecha más específica ni la más reciente. El editor avisa.
    const ancha: Temporada = {
      id: "baja", nombre: "Temporada baja", desde: "2027-01-01", hasta: "2027-12-31",
      ajuste: { tipo: "porcentaje", valor: -40 },
    };
    const navidad: Temporada = {
      id: "nav", nombre: "Navidad", desde: "2027-12-20", hasta: "2027-12-31",
      ajuste: { tipo: "porcentaje", valor: 80 },
    };
    expect(getRoomNightPrice(SUITE, 2, "2027-12-24", { temporadas: [ancha, navidad] })).toBe(1140);
    expect(getRoomNightPrice(SUITE, 2, "2027-12-24", { temporadas: [navidad, ancha] })).toBe(3420);
  });
});
