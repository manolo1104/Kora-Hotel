// Cierres de inventario: las noches en que una unidad NO se vende porque el
// hotelero la cerró, no porque alguien la reservara.
//
// Son dos cosas distintas y hasta el 2 sep 2026 el panel las trataba como una:
//
//   • BLOQUEADO     — "no la quiero vender" (la usa la familia, una boda, lo
//                     que sea). Es una decisión comercial.
//   • MANTENIMIENTO — "está rota". Es una decisión operativa, y es la que la
//                     camarista y el de mantenimiento necesitan ver.
//
// Las dos cierran la venta igual —el motor, Camila, la caja y el calendario ya
// las respetaban—, pero el hotelero necesita distinguirlas a los tres meses,
// cuando mire el mes de agosto y se pregunte por qué esa cabaña no facturó.
//
// SOLO lógica: sin red, sin base, sin React. Por eso se puede probar.

/** Los estados de `blocks` que son un cierre manual del hotelero. */
export const ESTADOS_CIERRE = ["BLOQUEADO", "MANTENIMIENTO"] as const;
export type EstadoCierre = (typeof ESTADOS_CIERRE)[number];

export interface TramoCierre {
  /** Primera noche cerrada (inclusive). */
  desde: string;
  /**
   * Día de LIBERACIÓN (exclusivo), igual que el checkout de una reserva: esa
   * noche vuelve a estar a la venta. Todo el motor usa este mismo convenio
   * half-open, y mezclarlos es como se cierra una noche de más o de menos.
   */
  hasta: string;
  status: EstadoCierre;
}

function esCierre(v: string | undefined): v is EstadoCierre {
  return (ESTADOS_CIERRE as readonly string[]).includes((v ?? "").toUpperCase());
}

function diaSiguiente(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * `/api/admin/disponibilidad` responde fecha a fecha; el Timeline pinta barras.
 * Esto une los días CONSECUTIVOS del mismo estado en tramos.
 *
 * Sin esto, un cuarto fuera de servicio era invisible en el Timeline: esa vista
 * sólo miraba `bookings`, así que el hotelero veía la fila vacía y creía que la
 * cabaña estaba libre — justo la confusión que le hace vender un cuarto roto.
 *
 * Dos días separados por un hueco son DOS tramos, no uno: si el 5 y el 7 están
 * cerrados pero el 6 no, el 6 se vende.
 */
export function tramosDeCierre(porFecha: Record<string, string>): TramoCierre[] {
  const fechas = Object.keys(porFecha)
    .filter((d) => esCierre(porFecha[d]))
    .sort();

  const tramos: TramoCierre[] = [];
  for (const f of fechas) {
    const status = porFecha[f].toUpperCase() as EstadoCierre;
    const ultimo = tramos[tramos.length - 1];
    // Se alarga el tramo anterior sólo si es el MISMO estado y empieza justo
    // donde el otro terminaba. Un cambio de estado corta el tramo aunque los
    // días sean seguidos: cerrado por gusto y roto no son lo mismo.
    if (ultimo && ultimo.status === status && ultimo.hasta === f) {
      ultimo.hasta = diaSiguiente(f);
    } else {
      tramos.push({ desde: f, hasta: diaSiguiente(f), status });
    }
  }
  return tramos;
}

/** Cuántas noches cubre un tramo half-open. */
export function nochesDeTramo(t: Pick<TramoCierre, "desde" | "hasta">): number {
  const a = new Date(`${t.desde}T00:00:00`).getTime();
  const b = new Date(`${t.hasta}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}
