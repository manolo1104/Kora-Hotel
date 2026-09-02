// En qué punto de su estancia está una reserva HOY: por llegar, en casa, salió.
//
// EL PROBLEMA QUE RESUELVE: esto vivía dentro de `ReservasClient.tsx` como una
// función local, y los contadores de la vista "Hoy" —en el mismo archivo, tres
// pantallas más abajo— lo volvían a calcular con filtros escritos a mano. No
// coincidían: una reserva con check-out hecho sumaba en "Check-out hoy" mientras
// su fila decía "Salió", y una estancia que entraba y salía el mismo día se
// contaba dos veces en el badge. Además, viviendo dentro de un componente, no
// había forma de probarlo.
//
// La regla: el chip de la fila y el número de la tarjeta salen de la MISMA
// llamada. Si un día no coinciden, es un bug de esta función, no de dos.

import { reservaCuenta } from "@/lib/booking/estado-reserva";

export type EstadoOperativo =
  | "CHECK_IN_HOY"
  | "CHECK_OUT_HOY"
  | "EN_CASA"
  | "PROXIMA"
  | "COMPLETADA"
  | "CANCELADA"
  | "REEMBOLSADA"
  | "NO_SHOW"
  | "SALIO";

/** Lo mínimo que hace falta saber de una reserva para situarla. */
export interface ReservaSituable {
  estado: string;
  checkin: string;
  checkout: string;
  /** Cuándo llegó de verdad ("" si nadie lo registró). */
  checkinReal: string;
  /** Cuándo salió de verdad ("" si sigue dentro). */
  checkoutReal: string;
}

/**
 * @param hoy día del hotel en formato `YYYY-MM-DD` (usa `hoyHotel()` de
 *            `lib/fecha-hotel.ts`; NUNCA `toISOString()`, que es UTC).
 */
export function estadoOperativo(b: ReservaSituable, hoy: string): EstadoOperativo {
  if (b.estado === "CANCELADA") return "CANCELADA";
  // Una reembolsada NO es una reserva viva: se colapsaba en "CONFIRMADA" y salía
  // como "Próxima" o "En Casa", con su dinero sumado (K-42).
  if (b.estado === "REEMBOLSADA") return "REEMBOLSADA";

  // ── Lo AFIRMADO manda sobre lo deducido ──────────────────────────────────
  // La salida registrada: un huésped puede irse antes de su fecha y hasta que
  // alguien lo registre el cuarto sigue apareciendo ocupado.
  if (b.checkoutReal) return "SALIO";
  // La llegada registrada. POR QUÉ: "En Casa" se deducía de `checkin < hoy`
  // ESTRICTO, así que una estancia de UNA noche pasaba de "Check-in hoy" a
  // "Check-out hoy" y nunca aparecía en casa. El hotelero lo dijo tal cual:
  // "esta información aparece principalmente cuando el huésped tiene una
  // estancia de varios días". Ahora, en cuanto recepción pulsa "Ya llegó", está
  // en casa — dure una noche o diez, y siga o no dentro de sus fechas (el que se
  // queda de más también cuenta, que es justo cuando más importa saberlo).
  if (b.checkinReal) return "EN_CASA";

  // ── Y debajo, la cascada de fechas de siempre, intacta ────────────────────
  // El hotel que nunca pulse los botones ve exactamente lo que veía antes.
  const ci = b.checkin;
  const co = b.checkout;
  if (!ci) return "PROXIMA";
  if (ci === hoy) return "CHECK_IN_HOY";
  if (co === hoy) return "CHECK_OUT_HOY";
  if (ci < hoy && co > hoy) return "EN_CASA";
  if (co < hoy) return "COMPLETADA";
  return "PROXIMA";

  // NOTA sobre NO_SHOW: existe en el tipo y en las etiquetas, pero ningún camino
  // lo devuelve y NO se puede deducir. "Fechas pasadas sin llegada registrada"
  // describe también TODA la historia de un hotel que no use el botón: derivarlo
  // repintaría su pasado entero como "No Show". Si se quiere, pide su propio
  // botón ("No llegó"), no una inferencia.
}

/**
 * Los tres números de la vista "Hoy". Cada reserva cae en UN solo cubo, así que
 * la suma de los tres es el badge sin contar a nadie dos veces.
 */
export function contadoresDeHoy(
  reservas: readonly ReservaSituable[],
  hoy: string,
): { checkIn: number; enCasa: number; checkOut: number; total: number } {
  const c = { checkIn: 0, enCasa: 0, checkOut: 0, total: 0 };
  for (const b of reservas) {
    if (!reservaCuenta(b.estado)) continue;
    const ops = estadoOperativo(b, hoy);
    if (ops === "CHECK_IN_HOY") c.checkIn++;
    else if (ops === "EN_CASA") c.enCasa++;
    else if (ops === "CHECK_OUT_HOY") c.checkOut++;
  }
  c.total = c.checkIn + c.enCasa + c.checkOut;
  return c;
}

/**
 * ¿Esta reserva ocupa su cuarto AHORA?
 *
 * Vive junto a `estadoOperativo` porque es la misma pregunta desde el otro lado,
 * y tenerla en dos sitios es lo que hacía que el mapa de cuartos y la lista de
 * reservas se contradijeran sobre el mismo cuarto y el mismo momento.
 *
 * El orden importa: lo AFIRMADO manda sobre lo deducido de las fechas.
 * - Salió → libre, aunque su fecha de salida sea dentro de tres días.
 * - Llegó → ocupado, aunque el calendario diga otra cosa. Esto es lo que hace
 *   posible el walk-in (entra hoy sin reserva previa) y lo que mantiene ocupado
 *   al huésped que se queda una noche de más.
 * - Ni una cosa ni la otra → las fechas, como siempre.
 */
export function ocupaElCuarto(b: ReservaSituable, hoy: string): boolean {
  if (!reservaCuenta(b.estado)) return false;
  if (b.checkoutReal) return false;
  if (b.checkinReal) return true;
  if (!b.checkin || !b.checkout) return false;
  return b.checkin <= hoy && b.checkout > hoy;
}

export type EstadoCuarto = "DISPONIBLE" | "OCUPADA" | "MANTENIMIENTO" | "LIMPIEZA";

/**
 * Qué estado enseña el mapa para un cuarto: el guardado, o OCUPADA.
 *
 * La distinción que resuelve, y que costó un bug en producción de pruebas:
 *
 * - Ocupación DERIVADA (las fechas dicen que hoy entra alguien): NO pisa
 *   MANTENIMIENTO ni LIMPIEZA. El calendario no sabe si el huésped llegó, y una
 *   reserva de hoy no debe borrar el aviso de la camarista a las 00:01.
 * - Ocupación AFIRMADA (alguien pulsó "Ya llegó"): pisa TODO. Una persona que
 *   está delante del cuarto dice que hay alguien dentro; eso manda sobre una
 *   marca de limpieza que puede llevar días ahí. Enseñar "Limpieza pendiente" en
 *   un cuarto con gente dentro es esconder a una persona.
 *
 * Se DERIVA en cada carga, no se escribe. La primera versión escribía OCUPADA en
 * `room_statuses` al hacer check-in, y eso (a) pisaba el estado anterior del
 * cuarto y lo perdía para siempre, y (b) al deshacer la llegada dejaba el cuarto
 * OCUPADA sin nadie dentro.
 */
export function estadoDelCuarto(
  guardado: EstadoCuarto,
  ocupacion: { llegoYa: boolean } | null,
): EstadoCuarto {
  if (!ocupacion) return guardado;
  if (ocupacion.llegoYa) return "OCUPADA";
  if (guardado === "MANTENIMIENTO" || guardado === "LIMPIEZA") return guardado;
  return "OCUPADA";
}
