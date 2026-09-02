// La nota interna de un cuarto: la que escribe el sistema y la que escribe una
// persona, y cómo distinguirlas.
//
// POR QUÉ EXISTE: al elegir un estado en el mapa de cuartos, la nota se rellena
// sola — así la camarista no tiene que teclear "pendiente de limpieza" quince
// veces al día. Pero una nota puede llevar dentro algo que sólo sabe quien lo
// escribió ("el aire no enfría", "la ventana no cierra"), y eso NO se puede
// borrar por cambiar un desplegable: se perdería información de operación sin
// que nadie se entere.
//
// La regla: se reescribe si está vacía o si la nota que hay es EXACTAMENTE una
// de las que pone el sistema. Cualquier otra cosa es de una persona y no se toca.

import type { RoomStatusType } from "@/lib/db/admin";

/** Lo que el sistema escribe para cada estado. */
export const NOTA_POR_ESTADO: Record<RoomStatusType, string> = {
  DISPONIBLE: "Listo para recibir",
  OCUPADA: "Huésped en la habitación",
  LIMPIEZA: "Pendiente de limpieza",
  MANTENIMIENTO: "Fuera de servicio por mantenimiento",
};

/**
 * Las notas que pone el sistema, TODAS. Incluye las de estados anteriores y las
 * que escriben otras partes del código, porque el criterio no es "la de este
 * estado" sino "¿esto lo escribió una persona?".
 */
const AUTOMATICAS: readonly string[] = [
  ...Object.values(NOTA_POR_ESTADO),
  // La escribe el check-out (app/api/admin/reservas/[id]/checkout/route.ts).
  // Vive aquí para que el mapa la reconozca como automática y pueda pisarla.
  "Salida registrada — pendiente de limpieza",
];

/** La que deja el check-out al mandar un cuarto a limpieza. */
export const NOTA_SALIDA_REGISTRADA = "Salida registrada — pendiente de limpieza";

/** ¿Esta nota la escribió el sistema (y por tanto se puede reemplazar)? */
export function esNotaAutomatica(nota: string): boolean {
  const n = nota.trim();
  return n === "" || AUTOMATICAS.includes(n);
}

/**
 * Qué nota debe quedar al elegir `estado`.
 *
 * @param notaActual lo que hay escrito ahora mismo en el campo.
 * @returns la nota nueva, o `notaActual` intacta si la escribió una persona.
 */
export function notaAlCambiarEstado(estado: RoomStatusType, notaActual: string): string {
  return esNotaAutomatica(notaActual) ? NOTA_POR_ESTADO[estado] : notaActual;
}
