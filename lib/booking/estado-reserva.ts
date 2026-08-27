// El estado de una reserva, en un solo sitio y sin importar nada — para que lo
// puedan usar igual el servidor y los componentes del navegador.
//
// EL PROBLEMA QUE RESUELVE (K-42): `bookings.estado` admite 'REEMBOLSADA' desde
// `sql/kora-pagos-fase3.sql`, y el webhook de Stripe la escribe cuando entra un
// `charge.refunded`. Pero `mapBooking` la colapsaba en "CONFIRMADA" y el tipo
// `AdminBooking` ni la listaba, así que TODO el panel la trataba como una
// reserva viva: una reserva de $4,000 devuelta seguía contando como facturación
// del mes, entraba en los KPIs y en el CFDI, ocupaba su cuarto en el calendario,
// y al huésped reembolsado le seguían llegando los correos de "te esperamos
// mañana".
//
// La regla, escrita una vez: cancelada y reembolsada NO cuentan. Ni como dinero,
// ni como ocupación, ni como motivo para escribirle a nadie.

export type EstadoReserva = "CONFIRMADA" | "MANUAL" | "CANCELADA" | "REEMBOLSADA";

/** Estados en los que la reserva ya no vale: no hay dinero ni cuarto ocupado. */
export const ESTADOS_SIN_VALOR: readonly string[] = ["CANCELADA", "REEMBOLSADA"];

/**
 * ¿Esta reserva sigue contando? Úsalo SIEMPRE en vez de `estado !== "CANCELADA"`:
 * ese atajo es el que dejaba pasar las reembolsadas.
 */
export function reservaCuenta(estado: string | null | undefined): boolean {
  return !ESTADOS_SIN_VALOR.includes(estado ?? "");
}
