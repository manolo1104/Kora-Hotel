// Resuelve el hotel activo para las rutas /api/admin/* del panel operativo.
// El slug llega por la cookie kora_active_slug (la fija el middleware en
// /panel/[slug]); la pertenencia SIEMPRE se verifica contra hotel_members con la
// sesión del usuario. Si la cookie se manipula a otro hotel, getHotelMember
// devuelve null (no es miembro) → la ruta responde 401. SOLO servidor.

import { cookies } from "next/headers";
import { getHotelMember, type TenantContext } from "@/lib/tenant";
import { bloqueoDelHotel } from "@/lib/suscripcion";

export async function getActiveHotel(): Promise<TenantContext | null> {
  const slug = (await cookies()).get("kora_active_slug")?.value;
  if (!slug) return null;
  const ctx = await getHotelMember(slug);
  if (!ctx) return null;

  // Cuenta bloqueada por Kora → se comporta como si no hubiera hotel activo, y
  // todas las rutas /api/admin/* responden 401 solas. Cierra la puerta de atrás:
  // sin esto, el dueño de una cuenta bloqueada seguiría pudiendo editar reservas
  // o mandar correos llamando a la API directo, aunque no viera el panel.
  if (bloqueoDelHotel(ctx.hotel.extras as Record<string, unknown> | null)) return null;

  return ctx;
}
