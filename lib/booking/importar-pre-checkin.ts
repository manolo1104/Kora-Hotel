// Qué se trae del registro que llenó el huésped al formulario de la reserva.
//
// EL PROBLEMA: hay DOS versiones de los mismos datos. Los que capturó recepción
// al reservar, y los que escribió el propio huésped en su pre check-in. Pueden
// no coincidir: la reserva dice "Manuel Gonzales" y el huésped firma "Manuel
// Gonzales Ruiz"; o la reserva no tiene teléfono y el huésped sí lo puso.
//
// LA REGLA, decidida con el hotelero:
//   - Hueco vacío  → se rellena solo. No pisa nada, así que no hay nada que
//                    decidir y ahorra tecleo.
//   - Valor distinto → NO se pisa. Se avisa y decide recepción, que es quien
//                    tiene el documento del huésped delante.
//   - Igual        → ni se toca ni se avisa. Un aviso que no aporta nada es
//                    ruido, y el ruido enseña a ignorar los avisos que sí.
//
// Es una función PURA a propósito: la decisión de "qué se pisa y qué no" es lo
// único que puede perder datos de un huésped, y así se puede probar.

/** Los campos de la reserva que el registro puede completar. */
export type CampoImportable = "cliente" | "telefono" | "email";

/** Lo que el huésped escribió, en los tres campos que la reserva también tiene. */
export interface DatosDelHuesped {
  nombreCompleto?: string;
  telefono?: string;
  email?: string;
}

/** Lo que la reserva tiene ahora mismo. */
export type ValoresReserva = Record<CampoImportable, string>;

export interface Diferencia {
  campo: CampoImportable;
  /** Lo que hay en la reserva. */
  actual: string;
  /** Lo que escribió el huésped. */
  delHuesped: string;
}

export interface ResultadoImportar {
  /** Campos que estaban vacíos y se rellenan solos, con su valor. */
  rellenos: Partial<ValoresReserva>;
  /** Campos con valor distinto: se avisa, NO se pisa. */
  diferencias: Diferencia[];
}

/** Compara ignorando espacios de más y mayúsculas: "  ANA " y "Ana" son iguales. */
function mismoValor(a: string, b: string): boolean {
  return a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
}

export function importarDelHuesped(
  actual: ValoresReserva,
  huesped: DatosDelHuesped | null,
): ResultadoImportar {
  const vacio: ResultadoImportar = { rellenos: {}, diferencias: [] };
  if (!huesped) return vacio;

  const pares: [CampoImportable, string][] = [
    ["cliente", (huesped.nombreCompleto ?? "").trim()],
    ["telefono", (huesped.telefono ?? "").trim()],
    ["email", (huesped.email ?? "").trim()],
  ];

  const res: ResultadoImportar = { rellenos: {}, diferencias: [] };
  for (const [campo, delHuesped] of pares) {
    if (!delHuesped) continue; // el huésped no lo puso: no hay nada que traer
    const enReserva = (actual[campo] ?? "").trim();
    if (!enReserva) {
      res.rellenos[campo] = delHuesped;
    } else if (!mismoValor(enReserva, delHuesped)) {
      res.diferencias.push({ campo, actual: enReserva, delHuesped });
    }
  }
  return res;
}
