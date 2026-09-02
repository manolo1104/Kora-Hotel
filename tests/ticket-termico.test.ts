// El ticket de rollo térmico.
//
// POR QUÉ EXISTE: el hotelero que paga imprime en una térmica de mostrador y
// pidió dos cosas — "un formato de ticket más pequeño" y "que se pueda imprimir
// directamente desde el sistema, sin descargarlo, guardarlo, abrirlo y
// posteriormente mandarlo a imprimir". Lo que rompe un ticket no se ve en un
// diff: se ve cuando sale cortado del rollo, o cuando no sale.

import { describe, it, expect } from "vitest";
import { buildTicketDoc, buildReservaDoc } from "@/lib/docs/documento-branded";
import type { BookingBrand } from "@/lib/email/booking-branded";
import type { ReservaDocData } from "@/lib/docs/documento-branded";

const marca: BookingBrand = {
  nombre: "Hotel Paraíso Encantado",
  ubicacion: "Xilitla, SLP",
  email: "hola@paraiso.mx",
  telefono: "4891007679",
  color: "#1B4332",
  logo: "",
  whatsapp: "524891007679",
} as BookingBrand;

const datos: ReservaDocData = {
  folio: "KO-2026-B5RQ",
  fecha_reserva: "1 sep 2026",
  cliente_nombre: "Manuel Gonzales",
  cliente_email: "manuel@ejemplo.mx",
  cliente_telefono: "4491234567",
  habitacion: "Suite Jungla",
  huespedes: "2",
  noches: "1",
  entrada_dia: "1",
  entrada_detalle: "Mar · Sep 2026 · desde 3:00 PM",
  salida_dia: "2",
  salida_detalle: "Mié · Sep 2026 · antes 12:00 PM",
  conceptos: [],
  total_estancia: "$1,900.00",
  moneda: "MXN",
  anticipo_pagado: "$1,900.00",
  restante: "$0.00",
  metodo_pago: "Efectivo",
  fecha_pago: "1 sep 2026",
};

describe("el papel", () => {
  it("sale a 58 mm por defecto, que es la impresora chica de mostrador", () => {
    const html = buildTicketDoc(marca, datos);
    expect(html).toContain("@page { size: 58mm auto; margin: 0; }");
    expect(html).toContain(".ticket { width: 58mm;");
  });

  it("sale a 80 mm cuando el hotel tiene la grande", () => {
    const html = buildTicketDoc(marca, datos, { ancho: "80mm" });
    expect(html).toContain("@page { size: 80mm auto; margin: 0; }");
  });

  it("el alto es AUTO: el rollo no tiene páginas, y fijarlo lo cortaría", () => {
    expect(buildTicketDoc(marca, datos)).toMatch(/@page \{ size: \d+mm auto;/);
  });

  it("margen CERO: el driver ya reserva el suyo y sumar los dos parte el ticket", () => {
    expect(buildTicketDoc(marca, datos)).toMatch(/@page \{[^}]*margin: 0;/);
  });
});

describe("lo que una térmica no puede imprimir", () => {
  it("no lleva NINGÚN color: imprime por calor, no con tinta", () => {
    const html = buildTicketDoc(marca, datos);
    const estilos = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
    // El bloque `@media screen` es la vista previa en el panel: nunca llega al
    // papel, así que sus grises no cuentan. Lo que se imprime es lo de fuera.
    const paraPapel = estilos.slice(0, estilos.indexOf("@media screen"));
    const colores = [...new Set(paraPapel.match(/#[0-9a-fA-F]{3,6}/g) ?? [])];
    expect(colores, `el ticket lleva color: ${colores.join(", ")}`)
      .toEqual(expect.arrayContaining([]));
    expect(colores.every((c) => /^#(000|fff|000000|ffffff)$/i.test(c))).toBe(true);
  });

  it("no lleva el verde de marca aunque el hotel tenga color propio", () => {
    // El comprobante carta SÍ se retinta; el ticket no, porque en térmica
    // cualquier color acaba en un gris sucio.
    const html = buildTicketDoc({ ...marca, color: "#7A0030" }, datos);
    expect(html).not.toContain("#7A0030");
  });

  it("no pide fuentes externas: si la web font no carga, se mueve todo", () => {
    expect(buildTicketDoc(marca, datos)).not.toContain("fonts.googleapis");
  });
});

describe("imprimir de un clic", () => {
  it("con forPrint trae dentro su propio window.print()", () => {
    // Es lo que hace que el botón sea UN clic: no hay que descargar ni abrir.
    expect(buildTicketDoc(marca, datos, { forPrint: true })).toContain("window.print()");
  });

  it("sin forPrint NO se imprime solo (para poder verlo antes)", () => {
    expect(buildTicketDoc(marca, datos)).not.toContain("window.print()");
  });
});

describe("los datos", () => {
  it("no deja ni una variable de plantilla sin resolver", () => {
    // Un `{{ restante }}` crudo en el papel que se le da al huésped.
    expect(buildTicketDoc(marca, datos).match(/\{\{[^}]+\}\}/g)).toBeNull();
  });

  it("lleva lo que recepción necesita: folio, huésped, cuarto, fechas y saldo", () => {
    const html = buildTicketDoc(marca, datos);
    for (const dato of ["KO-2026-B5RQ", "Manuel Gonzales", "Suite Jungla", "$1,900.00", "$0.00"]) {
      expect(html).toContain(dato);
    }
  });

  it("usa EXACTAMENTE los mismos datos que el comprobante carta", () => {
    // Si un día divergen, el papel del mostrador y el PDF del correo dirían
    // cosas distintas de la misma reserva.
    const carta = buildReservaDoc(marca, datos);
    for (const dato of [datos.folio, datos.cliente_nombre, datos.habitacion, datos.total_estancia]) {
      expect(carta).toContain(dato);
      expect(buildTicketDoc(marca, datos)).toContain(dato);
    }
  });
});
