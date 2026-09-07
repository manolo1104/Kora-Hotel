// El correo que ESCRIBE el hotelero, a mano, desde la ficha de un cliente.
//
// Hasta hoy la ficha del huésped sólo sabía mandar una cosa: la «oferta
// personalizada» que redacta la IA. Para confirmar una llegada, pedir el
// anticipo o mandar una cotización, el hotelero abría Gmail — y ese correo salía
// sin la marca de su hotel y sin quedar registrado en ningún lado.
//
// Este archivo es la ENVOLTURA. El texto lo pone quien escribe (o una de las
// plantillas de `plantillas-hotelero.ts`); aquí sólo se decide cómo se ve, y se
// decide con las piezas de `lib/email/design.ts` y con ninguna otra cosa: es la
// regla del sistema de correos unificado, y el motivo por el que los 29 correos
// de Kora se parecen entre sí.
//
// TODO lo que entra se escapa. El asunto y los párrafos los teclea una persona
// del hotel y acaban dentro del correo de un huésped: en un multi-tenant eso es
// entrada no confiable aunque venga «de casa». Las piezas de `design.ts` que
// aceptan HTML crudo (`titulo`, `parrafo`, `saludo`, `caja`, `boton`) se llaman
// SIEMPRE con el texto ya pasado por `esc()`.

import {
  doc,
  cabecera,
  titulo as tituloPieza,
  saludo,
  parrafo,
  boton,
  tablaDatos,
  caja,
  contacto,
  pieHotel,
  respiro,
  esc,
  type Lang,
} from "@/lib/email/design";
import type { HotelBrand } from "@/lib/email-sequences";

export interface CorreoHoteleroArgs {
  hotel: HotelBrand;
  /** Nombre del huésped, tal como está en el CRM. */
  huesped: string;
  titulo: string;
  /** Párrafos en texto plano. Se escapan y se pintan en orden. */
  parrafos: string[];
  /** Filas etiqueta → valor (fechas, habitación, importes). Opcional. */
  datos?: { k: string; v: string }[];
  /** Nota destacada al final del cuerpo (política de cancelación, avisos). */
  nota?: string;
  /** Botón. La URL la arma SIEMPRE el servidor, nunca el cuerpo de la petición. */
  cta?: { texto: string; url: string };
  lang?: Lang;
}

/** El primer nombre, que es como escribe una persona. */
export function primerNombreHuesped(n: string, en = false): string {
  return (n || "").trim().split(/\s+/)[0] || (en ? "there" : "hola");
}

/**
 * El preheader es el texto gris que Gmail enseña junto al asunto. Sin uno
 * propio, Gmail se inventa el principio del cuerpo — que aquí empieza por
 * «Hola, Ana» y no dice nada. Se toma el primer párrafo, recortado.
 */
function preheaderDe(parrafos: string[]): string {
  const p = (parrafos.find((x) => x.trim()) ?? "").replace(/\s+/g, " ").trim();
  return p.length > 140 ? `${p.slice(0, 137)}…` : p;
}

export function buildCorreoHotelero(a: CorreoHoteleroArgs): string {
  const en = a.lang === "en";
  const nombreHotel = a.hotel.nombre || "el hotel";
  const parrafos = a.parrafos.map((p) => p.trim()).filter(Boolean);
  const [intro, ...resto] = parrafos;

  const inner =
    cabecera({ nombre: nombreHotel, eyebrow: en ? "A message for you" : "Un mensaje para ti" }) +
    tituloPieza(esc(a.titulo)) +
    saludo(en ? "Hi" : "Hola", primerNombreHuesped(a.huesped, en), esc(intro ?? "")) +
    resto.map((p) => parrafo(esc(p))).join("") +
    tablaDatos((a.datos ?? []).filter((d) => d.k && d.v).map((d) => ({ k: d.k, v: esc(d.v) }))) +
    (a.nota ? caja(esc(a.nota)) : "") +
    (a.cta ? boton(a.cta.url, esc(a.cta.texto)) : "") +
    respiro +
    contacto({ telefono: a.hotel.telefono, email: a.hotel.email, whatsapp: a.hotel.whatsapp }) +
    pieHotel({ nombre: nombreHotel, ubicacion: a.hotel.ubicacion });

  return doc(a.titulo, preheaderDe(parrafos), inner, en ? "en" : "es");
}
