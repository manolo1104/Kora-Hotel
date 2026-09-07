// El correo que ESCRIBE el hotelero desde la ficha de un cliente.
//
// Lo que se prueba aquí no es que el HTML se vea bonito: es que el correo no
// pueda decir una cosa distinta de la que hace el sistema. Las tres formas de
// mentir que tiene son (a) un número inventado, (b) un hueco sin rellenar, y
// (c) el texto que teclea una persona del hotel escapándose a marcado dentro
// del correo de un huésped.
import { describe, it, expect } from "vitest";
import {
  PLANTILLAS,
  plantillaPorId,
  faltantes,
  ETIQUETA_CAMPO,
  type DatosCorreo,
} from "@/lib/email/plantillas-hotelero";
import { buildCorreoHotelero } from "@/lib/email/hotelero";
import { datosDeHuesped, reservasDeHuesped } from "@/lib/panel/correo-huesped";
import { calcDepositAmount } from "@/lib/booking";
import type { AdminBooking } from "@/lib/db/admin";
import type { HotelRow } from "@/lib/tenant";

const HOTEL = {
  id: "h1",
  slug: "hotel-de-ejemplo",
  nombre: "Hotel de Ejemplo",
  ubicacion: "Xilitla, SLP",
  descripcion: "",
  whatsapp: "5214811234567",
  habitaciones: [],
  guia: { checkin: "3:00 PM", checkout: "12:00 PM" },
  extras: {},
  config: {},
} as unknown as HotelRow;

function reserva(p: Partial<AdminBooking>): AdminBooking {
  return {
    id: "b",
    fecha: "2026-09-01",
    confirmacion: "KORA-1",
    cliente: "María Ejemplo",
    telefono: "4811234567",
    email: "maria@ejemplo.test",
    total: 9000,
    checkin: "2026-09-20",
    checkout: "2026-09-23",
    noches: 3,
    huespedes: 2,
    habitaciones: "Suite Jungla",
    notas: "",
    paymentId: "",
    estado: "CONFIRMADA",
    comoNosConocio: "",
    anticipo: 0,
    origen: "web",
    doc: {},
    lang: "es",
    checkoutReal: "",
    checkinReal: "",
    ...p,
  } as AdminBooking;
}

const HOY = "2026-09-06";

describe("de qué reserva habla el correo", () => {
  it("la próxima es la más cercana que aún no empieza, no la más reciente", () => {
    const d = datosDeHuesped({
      hotel: HOTEL,
      bookings: [
        reserva({ confirmacion: "LEJOS", checkin: "2026-12-01", checkout: "2026-12-03" }),
        reserva({ confirmacion: "CERCA", checkin: "2026-09-20", checkout: "2026-09-23" }),
      ],
      email: "maria@ejemplo.test",
      hoy: HOY,
    });
    expect(d.confirmacion).toBe("CERCA");
  });

  // Un correo que dice «tu llegada» a quien ya está durmiendo en el cuarto es
  // justo el detalle que hace que el hotelero deje de usar esto.
  it("una estancia EN CURSO no cuenta como próxima llegada", () => {
    const d = datosDeHuesped({
      hotel: HOTEL,
      bookings: [reserva({ checkin: "2026-09-04", checkout: "2026-09-09" })],
      email: "maria@ejemplo.test",
      hoy: HOY,
    });
    expect(d.checkin).toBeUndefined();
  });

  it("las canceladas y reembolsadas no existen para el correo", () => {
    const vivas = reservasDeHuesped(
      [
        reserva({ confirmacion: "A", estado: "CANCELADA" }),
        reserva({ confirmacion: "B", estado: "REEMBOLSADA" }),
        reserva({ confirmacion: "C", estado: "CONFIRMADA" }),
      ],
      "maria@ejemplo.test",
    );
    expect(vivas.map((r) => r.confirmacion)).toEqual(["C"]);
  });

  it("el correo del huésped se compara sin distinguir mayúsculas", () => {
    expect(reservasDeHuesped([reserva({ email: "Maria@Ejemplo.TEST" })], "maria@ejemplo.test")).toHaveLength(1);
  });

  it("un correo vacío no arrastra las reservas de nadie", () => {
    expect(reservasDeHuesped([reserva({ email: "" })], "")).toEqual([]);
  });
});

describe("las cifras salen del motor, no de aquí", () => {
  it("el anticipo por pagar es el que calcula calcDepositAmount", () => {
    const d = datosDeHuesped({
      hotel: HOTEL,
      bookings: [reserva({ total: 9000, noches: 3, anticipo: 0 })],
      email: "maria@ejemplo.test",
      hoy: HOY,
    });
    expect(d.anticipoPorPagar).toBe(calcDepositAmount(9000, 3, { pct: 50, minNights: 2 }));
  });

  it("si ya pagó el anticipo, no hay nada que recordarle", () => {
    const d = datosDeHuesped({
      hotel: HOTEL,
      bookings: [reserva({ total: 9000, anticipo: 4500 })],
      email: "maria@ejemplo.test",
      hoy: HOY,
    });
    expect(d.anticipoPorPagar).toBeUndefined();
    expect(d.anticipoPagado).toBe(4500);
    expect(d.pendiente).toBe(4500);
  });

  it("los horarios salen de la guía del hotel, no de un valor por defecto", () => {
    const sinGuia = datosDeHuesped({
      hotel: { ...HOTEL, guia: {} } as unknown as HotelRow,
      bookings: [reserva({})],
      email: "maria@ejemplo.test",
      hoy: HOY,
    });
    expect(sinGuia.checkinHora).toBeUndefined();
  });
});

describe("una plantilla sin datos no se manda", () => {
  it("«recordatorio de anticipo» se bloquea si ya está pagado", () => {
    const d: DatosCorreo = { hotelNombre: "H", huesped: "Ana", checkin: "2026-09-20" };
    const p = plantillaPorId("anticipo")!;
    expect(faltantes(p, d)).toContain("anticipoPorPagar");
  });

  it("«cómo llegar» se bloquea si el hotel no puso horarios", () => {
    const p = plantillaPorId("como_llegar")!;
    expect(faltantes(p, { hotelNombre: "H", huesped: "Ana" })).toEqual(["checkinHora", "checkoutHora"]);
  });

  it("«gracias» se bloquea si nunca se ha hospedado", () => {
    const p = plantillaPorId("gracias")!;
    expect(faltantes(p, { hotelNombre: "H", huesped: "Ana" })).toEqual(["ultimaEstancia"]);
  });

  // Una cotización es justo para quien TODAVÍA no tiene reserva: si exigiera
  // una, la plantilla sería inservible para lo único que sirve.
  it("«cotización» no exige nada", () => {
    expect(faltantes(plantillaPorId("cotizacion")!, { hotelNombre: "H", huesped: "Ana" })).toEqual([]);
  });

  it("todo campo exigido tiene su explicación en castellano", () => {
    for (const p of PLANTILLAS) {
      for (const campo of p.requiere) expect(ETIQUETA_CAMPO[campo]).toBeTruthy();
    }
  });

  it("ninguna plantilla deja un hueco {variable} sin resolver", () => {
    const d: DatosCorreo = {
      hotelNombre: "Hotel de Ejemplo",
      huesped: "María",
      checkin: "2026-09-20",
      checkout: "2026-09-23",
      habitacion: "Suite",
      total: 9000,
      anticipoPorPagar: 4500,
      checkinHora: "3:00 PM",
      checkoutHora: "12:00 PM",
      ultimaEstancia: "2026-07-01",
    };
    for (const p of PLANTILLAS) {
      const b = p.armar(d);
      const todo = [b.asunto, ...b.parrafos, ...(b.datos ?? []).map((x) => x.v)].join(" ");
      expect(todo).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(todo).not.toContain("undefined");
      expect(todo).not.toContain("NaN");
    }
  });

  it("una fila de datos vacía no se pinta (nada de «Habitación: —»)", () => {
    const b = plantillaPorId("gracias")!.armar({ hotelNombre: "H", huesped: "Ana", ultimaEstancia: "2026-07-01" });
    expect((b.datos ?? []).every((f) => f.v.trim() !== "")).toBe(true);
  });
});

describe("lo que teclea el hotel no se convierte en marcado", () => {
  const sucio = {
    hotel: {
      nombre: 'Hotel "Río" & Sol <b>MALO</b>',
      ubicacion: 'Xilitla "centro" & alrededores',
      email: "hola@ejemplo.test",
    },
    huesped: 'J&J <b>Pérez</b> "el bueno"',
    titulo: 'Tu llegada a "Río" & Sol <script>alert(1)</script>',
    parrafos: ['Te espero el <b>viernes</b> & el sábado, "sin falta".'],
    datos: [{ k: "Habitación", v: 'Suite "Jungla" & <i>Ceiba</i>' }],
    nota: 'Cancelación <b>gratis</b> & "sin cargo".',
  };

  it("ni una etiqueta del hotelero llega viva al correo", () => {
    const html = buildCorreoHotelero(sucio);
    expect(html).not.toContain("<b>MALO</b>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<i>Ceiba</i>");
    expect(html).toContain("&lt;b&gt;MALO&lt;/b&gt;");
  });

  // Un `&amp;amp;` VISIBLE delata que algo se escapó dos veces: la pieza de
  // design.ts ya escapaba y el llamador volvió a hacerlo.
  it("no hay doble escapado", () => {
    expect(buildCorreoHotelero(sucio)).not.toContain("&amp;amp;");
  });

  it("el botón sólo aparece cuando hay a dónde ir", () => {
    const sinCta = buildCorreoHotelero({ hotel: { nombre: "H" }, huesped: "Ana", titulo: "T", parrafos: ["x"] });
    expect(sinCta).not.toContain("border-radius:999px");
    const conCta = buildCorreoHotelero({
      hotel: { nombre: "H" },
      huesped: "Ana",
      titulo: "T",
      parrafos: ["x"],
      cta: { texto: "Ver mi reserva", url: "https://kora-hotel.com/reserva/consultar" },
    });
    expect(conCta).toContain("https://kora-hotel.com/reserva/consultar");
  });

  it("firma el hotel y Kora queda en el pie", () => {
    const html = buildCorreoHotelero({ hotel: { nombre: "Hotel Ejemplo" }, huesped: "Ana", titulo: "T", parrafos: ["x"] });
    expect(html).toContain("Hotel Ejemplo");
    expect(html).toContain("Enviado con");
  });

  it("el preheader lleva el primer párrafo, no «Hola, Ana»", () => {
    const html = buildCorreoHotelero({
      hotel: { nombre: "H" },
      huesped: "Ana Pérez",
      titulo: "T",
      parrafos: ["Ya está todo listo para tu llegada."],
    });
    expect(html).toContain("Ya está todo listo para tu llegada.");
    // Y saluda por el primer nombre, como escribe una persona.
    expect(html).toContain("Hola, Ana");
  });
});
