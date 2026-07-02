// Resuelve el hotel activo para las rutas /api/admin/* del panel operativo.
// El slug llega por la cookie kora_active_slug (la fija el middleware en
// /panel/[slug]); la pertenencia SIEMPRE se verifica contra hotel_members con la
// sesión del usuario. Si la cookie se manipula a otro hotel, getHotelMember
// devuelve null (no es miembro) → la ruta responde 401. SOLO servidor.

import { cookies } from "next/headers";
import { getHotelMember, type TenantContext } from "@/lib/tenant";

export async function getActiveHotel(): Promise<TenantContext | null> {
  const slug = (await cookies()).get("kora_active_slug")?.value;
  if (!slug) return null;
  return getHotelMember(slug);
}
