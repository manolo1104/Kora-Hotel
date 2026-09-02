// Qué día es HOY para el hotel, en un solo sitio.
//
// EL PROBLEMA QUE RESUELVE: cada pantalla calculaba "hoy" por su cuenta y no
// todas de la misma forma. La lista de Reservas usaba la zona de México, pero el
// mapa de cuartos (`app/api/admin/room-status/route.ts`) y los Insights
// (`lib/admin/insights.ts`) usaban `new Date().toISOString()`, que es UTC.
//
// México va UTC-6, así que DE LAS 18:00 A LA MEDIANOCHE hora local el servidor
// ya está en el día siguiente: el mapa marcaba como ocupados los cuartos de las
// llegadas de mañana y sacaba a los de hoy, mientras la lista de Reservas seguía
// enseñando el día correcto. Dos pantallas del mismo panel contradiciéndose cada
// tarde, todas las tardes. Es el síntoma que el Hotel Nealtican reportó como
// "algunas veces en las reservas no se agregan correctamente los números de
// check-in y check-out".
//
// La regla, escrita una vez: NINGUNA pantalla calcula "hoy" por su cuenta.
// Toda comparación contra `bookings.checkin` / `bookings.checkout` —que son
// `date`, no `timestamptz`, o sea días de calendario del hotel— pasa por aquí.

/** Zona del hotel. Hoy es fija; el día que Kora salga del huso de México, se lee del hotel. */
export const ZONA_HOTEL = "America/Mexico_City";

/**
 * Hoy en la zona del hotel, como `YYYY-MM-DD`.
 *
 * Se compara directo (con `<`, `<=`, `===`) contra `bookings.checkin` y
 * `bookings.checkout`, que llegan de Postgres en ese mismo formato.
 *
 * `en-CA` da `YYYY-MM-DD` sin tener que reordenar partes a mano.
 */
export function hoyHotel(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HOTEL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** Un día de calendario desplazado `n` días, sin salirse del formato `YYYY-MM-DD`. */
export function sumarDias(fecha: string, n: number): string {
  const d = new Date(fecha + "T12:00:00Z"); // mediodía: inmune a horario de verano
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}
