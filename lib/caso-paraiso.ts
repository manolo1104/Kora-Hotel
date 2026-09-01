// Fuente ÚNICA de las cifras del caso Hotel Paraíso Encantado.
//
// Por qué existe este archivo: las mismas cifras estaban escritas a mano en la
// página del caso, en la landing, en el pie, en el blog y en la secuencia de
// correos. El 31 de agosto de 2026 se midió el resultado: la landing publicaba
// "≈$30,000 que se queda en el hotel" y el caso "$8,400 MXN/mes" — la misma
// afirmación con dos números distintos, a un scroll de distancia. Antes de eso,
// el 27 de agosto, tres superficies habían publicado 75%→53% cuando el dato
// real era 40%→25%.
//
// La regla: ninguna superficie escribe una cifra del caso a mano. Se importa de
// aquí. Si un número cambia, cambia en un solo sitio y el sitio entero queda
// congruente por construcción.

import { PRECIO_DESDE, IMPLEMENTACION_HORAS } from "@/lib/oferta";

export { IMPLEMENTACION_HORAS };

// ─── Identidad del hotel ──────────────────────────────────────────────────────
export const CASO = {
  hotel: "Hotel Paraíso Encantado",
  ciudad: "Xilitla, San Luis Potosí",
  tipo: "Hotel boutique de naturaleza",
  habitaciones: 15,
  duenoNombre: "Manolo Covarrubias",
  // No es un cliente: es el hotel del fundador de Kora. El caso se cuenta en
  // primera persona porque fingir voz de agencia ("Manolo nos describió sus
  // problemas") sobre tu propio hotel se lee falso y desperdicia lo único que
  // ningún competidor puede copiar: que quien hizo el software lo opera.
  esDelFundador: true,
} as const;

// ─── Lo medido ────────────────────────────────────────────────────────────────

/**
 * Dependencia de OTAs, antes y después de tres meses con Kora.
 * VERIFICADO por Manolo el 27 ago 2026. Es el único dato de resultado propio
 * que tiene Kora, y el que sostiene la promesa entera del producto.
 */
export const OTA_ANTES = 40;
export const OTA_DESPUES = 25;

/** El complemento: qué parte de las reservas entra por canal directo. */
export const DIRECTO_ANTES = 100 - OTA_ANTES; // 60
export const DIRECTO_DESPUES = 100 - OTA_DESPUES; // 75

/** Cuánto tardó en pasar. */
export const MESES = 3;

/** Comisión promedio que cobraban las OTAs por reserva, en el mix del hotel. */
export const COMISION_OTA = 18;

/**
 * Comisión de OTA que el hotel dejó de pagar, al mes.
 *
 * ⚠️ NO SE RECALCULA sin los ingresos reales del hotel. Se publica desde julio
 * de 2026 y Manolo confirmó el 31 ago 2026 que se queda como está. Cubre TODA
 * la reserva que dejó de pasar por una OTA — no sólo la que entra por el motor
 * de Kora, también la que se cierra por WhatsApp o por teléfono. Por eso es
 * mayor que el 18% de `DIRECTO_MOTOR_TRIMESTRE / MESES`: ese número es sólo la
 * parte que pasa por el motor.
 */
export const AHORRO_MENSUAL = 8_400;

/** Reservas directas cobradas POR EL MOTOR de Kora en los primeros 3 meses. */
export const DIRECTO_MOTOR_TRIMESTRE = 120_000;

/** Tiempo de respuesta en WhatsApp, antes y después de Camila. */
export const RESPUESTA_ANTES = "4+ horas";
export const RESPUESTA_DESPUES = "menos de 30 segundos";

/** Crecimiento del volumen de reservas directas contra el mismo periodo del año anterior. */
export const CRECIMIENTO_DIRECTAS = 40;

// ─── Derivados ────────────────────────────────────────────────────────────────
// Nada de esto se escribe a mano en ninguna superficie: se calcula aquí.

/** Puntos porcentuales que bajó la dependencia de OTAs. 40 → 25 = 15 puntos. */
export const OTA_PUNTOS_MENOS = OTA_ANTES - OTA_DESPUES;

/** Ahorro acumulado en los tres meses que dura el caso. */
export const AHORRO_TRIMESTRE = AHORRO_MENSUAL * MESES;

/** Ahorro anualizado. */
export const AHORRO_ANUAL = AHORRO_MENSUAL * 12;

/** Lo que cuesta Kora al año. Sale de `lib/oferta.ts`, la fuente del precio. */
export const COSTO_KORA_ANUAL = PRECIO_DESDE * 12;

/** Ahorro neto anual: lo que se queda en el hotel después de pagar Kora. */
export const AHORRO_NETO_ANUAL = AHORRO_ANUAL - COSTO_KORA_ANUAL;

/** Cuántas veces se paga Kora con lo que el hotel deja de dar en comisiones. */
export const VECES_SE_PAGA = Math.floor(AHORRO_ANUAL / COSTO_KORA_ANUAL);

// ─── Formato ──────────────────────────────────────────────────────────────────

/** `$8,400` — pesos mexicanos con separador de miles, sin decimales. */
export const mxn = (n: number): string => `$${n.toLocaleString("es-MX")}`;

/** `$8,400 MXN` */
export const mxnLargo = (n: number): string => `${mxn(n)} MXN`;
