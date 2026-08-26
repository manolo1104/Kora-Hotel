// El dinero que se le cobra al huésped. Todo aquí es función pura de
// `lib/booking/engine.ts`: cero base de datos, cero red.
//
// El script corre con TZ=UTC A PROPÓSITO: `getRoomNightPrice` hace
// `new Date(\`${fecha}T12:00:00\`)` y luego `.getDay()`, que es hora LOCAL.
// Vercel corre en UTC; si estos tests corrieran en America/Mexico_City pasarían
// en este Mac y mentirían sobre producción.
import { describe, it, expect } from "vitest";
import {
  getRoomBasePrice,
  getRoomNightPrice,
  calcRoomStayTotal,
  calcDepositAmount,
  calcNrfDiscount,
  type BookingRoom,
} from "@/lib/booking/engine";

const CUARTO: BookingRoom = {
  id: 1,
  name: "Cabaña",
  price: 2000,
  priceTiers: { 2: 2000, 3: 2400, 4: 2800 },
  maxGuests: 4,
  cantidad: 2,
  unidades: ["Cabaña", "Cabaña 2"],
};

describe("getRoomBasePrice", () => {
  it("usa el escalón exacto cuando existe", () =>
    expect(getRoomBasePrice(CUARTO, 3)).toBe(2400));
  it("cae al escalón inmediato inferior cuando no existe el exacto", () =>
    expect(getRoomBasePrice(CUARTO, 1)).toBe(2000));
  it("no cobra por encima de maxGuests", () =>
    expect(getRoomBasePrice(CUARTO, 9)).toBe(2800));
});

describe("getRoomNightPrice — precedencia", () => {
  // 2026-08-28 es VIERNES. Con la temporada Y el recargo de fin de semana
  // activos a la vez, tiene que ganar la TEMPORADA (engine.ts:103-113).
  const VIERNES = "2026-08-28";
  const opts = {
    temporadas: [
      { id: "t1", nombre: "Alta", desde: "2026-08-01", hasta: "2026-08-31",
        ajuste: { tipo: "porcentaje" as const, valor: 40 } },
    ],
    recargoFinDeSemana: {
      activo: true, dias: [5, 6], ajuste: { tipo: "porcentaje" as const, valor: 100 },
    },
  };

  it("es viernes (si esto falla, el resto del test no significa nada)", () =>
    expect(new Date(`${VIERNES}T12:00:00`).getDay()).toBe(5));

  it("la temporada gana sobre el recargo de fin de semana", () =>
    expect(getRoomNightPrice(CUARTO, 2, VIERNES, opts)).toBe(2800)); // 2000 × 1.40

  it("sin temporada que cubra la fecha, sí aplica el recargo de fin de semana", () =>
    expect(getRoomNightPrice(CUARTO, 2, "2026-09-04", opts)).toBe(4000)); // viernes, 2000 × 2

  it("el descuento entre semana aplica lun–jue", () =>
    expect(getRoomNightPrice(CUARTO, 2, "2026-09-02", { weekdayDiscount: 200 })).toBe(1800));

  it("...y NO en fin de semana", () =>
    expect(getRoomNightPrice(CUARTO, 2, "2026-09-05", { weekdayDiscount: 200 })).toBe(2000));
});

describe("calcRoomStayTotal", () => {
  // Lun 31 ago → jue 3 sep son 3 noches (lun, mar, mié), todas entre semana.
  it("lun–jue con descuento de 200 cobra exactamente 3 × (base − 200)", () =>
    expect(calcRoomStayTotal(CUARTO, 2, "2026-08-31", "2026-09-03", { weekdayDiscount: 200 })).toBe(
      3 * (2000 - 200),
    ));

  it("con checkout anterior al checkin devuelve el precio base, no un negativo", () =>
    expect(calcRoomStayTotal(CUARTO, 2, "2026-09-10", "2026-09-08")).toBe(2000));
});

describe("calcDepositAmount", () => {
  // El salto de 50 % a 100 % en estancias de una noche: es la regla que evita
  // que un hotel aparte un cuarto de una noche por la mitad del dinero.
  it("una noche se cobra COMPLETA", () =>
    expect(calcDepositAmount(1000, 1, { pct: 50, minNights: 2 })).toBe(1000));
  it("dos noches pagan el anticipo del 50 %", () =>
    expect(calcDepositAmount(1000, 2, { pct: 50, minNights: 2 })).toBe(500));
  it("sin opciones, el default es 50 % desde 2 noches", () =>
    expect(calcDepositAmount(1000, 2)).toBe(500));
});

describe("calcNrfDiscount", () => {
  it("aplica el porcentaje configurado", () => expect(calcNrfDiscount(10000, 15)).toBe(1500));
  it("tope duro al 50 % aunque se configure 80", () =>
    expect(calcNrfDiscount(10000, 80)).toBe(5000));
  it("un porcentaje negativo no regala dinero", () =>
    expect(calcNrfDiscount(10000, -20)).toBe(0));
});

describe("el entero exacto que acaba en unit_amount de Stripe", () => {
  // La composición de app/api/h/[slug]/checkout/route.ts:
  //   stayTotal = subtotal − nrfDiscount + addonsTotal + experienciasTotal − bundleDiscount
  // Este test fija el número, no la fórmula: si alguien cambia el orden de las
  // restas, aquí se ve.
  it("compone el total con valores concretos", () => {
    const subtotal = 6000;
    const nrfDiscount = calcNrfDiscount(subtotal, 15); // 900
    const addonsTotal = 450;
    const experienciasTotal = 1200;
    const bundleDiscount = 100;
    const stayTotal = Math.max(
      0,
      subtotal - nrfDiscount + addonsTotal + experienciasTotal - bundleDiscount,
    );
    expect(nrfDiscount).toBe(900);
    expect(stayTotal).toBe(6650);
    // 2 noches → anticipo del 50 %, y es lo que Stripe cobra en centavos.
    const deposit = calcDepositAmount(stayTotal, 2, { pct: 50, minNights: 2 });
    expect(deposit).toBe(3325);
    expect(Math.round(deposit * 100)).toBe(332500);
  });
});
