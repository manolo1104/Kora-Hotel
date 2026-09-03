// Documentos branded (cotización / comprobante de reserva) por hotel. Toma la
// marca del hotel (bookingBrandFromHotel) + los datos del registro y rellena las
// plantillas del zip. Reemplaza al viejo buildBookingHtml (hardcodeado a
// Paraíso). Es PURO (sin deps de servidor) → corre también en el cliente para la
// vista previa en vivo del editor.

import type { BookingBrand } from "@/lib/email/booking-branded";
import { esColorOscuro } from "@/lib/email/design";
import { COLOR_DEFAULT } from "@/lib/mini";
import { COTIZACION_TPL, RESERVA_TPL, TICKET_TPL } from "./templates";
import { KORA_ICON_DATA_URI } from "./icon";
import { renderMustacheLite, type TemplateData } from "./render";

export interface DocConcepto {
  nombre: string;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  importe: string;
}

export interface CotizacionDocData {
  folio: string;
  fecha_emision: string;
  valida_hasta: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  habitacion: string;
  huespedes: string;
  noches: string;
  entrada_dia: string;
  entrada_detalle: string;
  salida_dia: string;
  salida_detalle: string;
  conceptos: DocConcepto[];
  subtotal: string;
  total: string;
  moneda: string;
  anticipo_pct: string;
  anticipo: string;
  saldo: string;
}

export interface ReservaDocData {
  folio: string;
  fecha_reserva: string;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string;
  habitacion: string;
  huespedes: string;
  noches: string;
  entrada_dia: string;
  entrada_detalle: string;
  salida_dia: string;
  salida_detalle: string;
  conceptos: DocConcepto[];
  total_estancia: string;
  moneda: string;
  anticipo_pagado: string;
  restante: string;
  metodo_pago: string;
  fecha_pago: string;
}

const TEMPLATE_GREEN = "#1B4332"; // color base de las plantillas


function brandVars(brand: BookingBrand): TemplateData {
  return {
    hotel_nombre: brand.nombre,
    hotel_ubicacion: brand.ubicacion || "",
    hotel_email: brand.email || "",
    hotel_telefono: brand.telefono || "",
    whatsapp: brand.whatsapp ? `+${brand.whatsapp}` : "",
    politica_cancelacion: brand.politicaCancelacion || "Consulta la política de cancelación con el hotel.",
  };
}

function finalize(rendered: string, brand: BookingBrand, forPrint?: boolean): string {
  // 1) Ícono del pie → data URI (documento auto-contenido).
  let html = rendered.split("kora-icono-K.png").join(KORA_ICON_DATA_URI);
  // 2) Tema por color del hotel: solo si definió un color propio y oscuro; si no,
  //    se conserva el verde de la plantilla (evita romper contraste).
  const color = brand.color || COLOR_DEFAULT;
  if (color.toLowerCase() !== TEMPLATE_GREEN.toLowerCase() && esColorOscuro(color)) {
    html = html.split(TEMPLATE_GREEN).join(color);
  }
  // 3) Auto-imprimir (para "Descargar PDF"): abre el diálogo de impresión.
  if (forPrint) {
    html = html.replace(
      "</body>",
      "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script></body>",
    );
  }
  return html;
}

export function buildCotizacionDoc(
  brand: BookingBrand,
  data: CotizacionDocData,
  opts: { forPrint?: boolean } = {},
): string {
  const vars: TemplateData = { ...brandVars(brand), ...data, conceptos: data.conceptos };
  return finalize(renderMustacheLite(COTIZACION_TPL, vars), brand, opts.forPrint);
}

/** Anchos de rollo que existen en el mercado. 58 es la de mostrador chico. */
export type AnchoTicket = "58mm" | "80mm";

/**
 * El mismo comprobante de reserva, en rollo térmico.
 *
 * Reutiliza `ReservaDocData` entero —o sea `assembleReserva`, los overrides
 * guardados en `bookings.doc` y todo lo demás—: lo único que cambia es la hoja.
 *
 * NO pasa por el retinte de marca de `finalize()` a propósito: una térmica no
 * tiene tinta, imprime por calor, y cualquier color acaba en un gris sucio. La
 * jerarquía se hace con tamaño y grosor. Sí se conserva el auto-imprimir, que es
 * justo lo que el hotelero pidió: un clic y sale, sin descargar nada.
 */
export function buildTicketDoc(
  brand: BookingBrand,
  data: ReservaDocData,
  opts: { forPrint?: boolean; ancho?: AnchoTicket } = {},
): string {
  const vars: TemplateData = {
    ...brandVars(brand),
    ...data,
    conceptos: data.conceptos,
    ancho: opts.ancho ?? "58mm",
  };
  let html = renderMustacheLite(TICKET_TPL, vars);
  if (opts.forPrint) {
    html = html.replace(
      "</body>",
      "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script></body>",
    );
  }
  return html;
}

export function buildReservaDoc(
  brand: BookingBrand,
  data: ReservaDocData,
  opts: { forPrint?: boolean } = {},
): string {
  const vars: TemplateData = { ...brandVars(brand), ...data, conceptos: data.conceptos };
  return finalize(renderMustacheLite(RESERVA_TPL, vars), brand, opts.forPrint);
}
