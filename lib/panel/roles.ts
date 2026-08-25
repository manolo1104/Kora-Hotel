// Control de ROL en las rutas del panel.
//
// `getActiveHotel()` y `requireHotelMember()` sólo comprueban MEMBRESÍA: los
// cinco roles la pasan por igual (dueno, encargada, recepcion, limpieza, cocina;
// ver `RolHotel` en lib/tenant.ts). Para leer o escribir cosas que mueven dinero
// o credenciales eso no basta, y varias rutas del panel se quedaron sólo con la
// membresía. El repo ya sabía hacerlo bien en un sitio —agent-token exige
// `dueno`— pero era el único; esto lo vuelve un helper para no volver a olvidarlo.
import { NextResponse } from "next/server";
import type { RolHotel } from "@/lib/tenant";

/** Roles que pueden tocar dinero, credenciales y vinculación de dispositivos. */
export const SOLO_DUENO: readonly RolHotel[] = ["dueno"];
/** Roles con mando operativo (para lo sensible pero no financiero). */
export const MANDO: readonly RolHotel[] = ["dueno", "encargada"];

/**
 * Devuelve una Response 403 si el rol no está permitido, o null si sí lo está.
 *
 *   const noPuede = requireRol(ctx, SOLO_DUENO, "Solo el dueño puede…");
 *   if (noPuede) return noPuede;
 */
export function requireRol(
  ctx: { rol: RolHotel },
  permitidos: readonly RolHotel[],
  mensaje: string,
): NextResponse | null {
  if (permitidos.includes(ctx.rol)) return null;
  return NextResponse.json({ error: mensaje }, { status: 403 });
}
