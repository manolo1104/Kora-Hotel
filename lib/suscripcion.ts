import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import type { PlanClave } from "@/lib/oferta";

// Estado de suscripción de un usuario. SOLO servidor (usa la service-role key).

export type EstadoSuscripcion =
  | "activa"
  | "pago_vencido"
  | "cancelada"
  | "incompleta"
  | "cortesia";

export interface Suscripcion {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PlanClave | null;
  estado: EstadoSuscripcion;
  periodo_fin: string | null;
  cancela_al_final: boolean;
  avisos_dunning: number;
}

export async function getSuscripcion(userId: string): Promise<Suscripcion | null> {
  if (!adminEnvReady) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("suscripciones")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Suscripcion) ?? null;
}

/**
 * Un plan cuenta como activo si está pagado, es cortesía (fundadores dados de
 * alta a mano), o tiene un pago vencido reciente (gracia mientras Stripe
 * reintenta el cobro; si agota los reintentos, pasa a cancelada por webhook).
 */
export function tienePlanActivo(s: Suscripcion | null): boolean {
  if (!s) return false;
  return s.estado === "activa" || s.estado === "cortesia" || s.estado === "pago_vencido";
}

/** Plan activo del dueño de un hotel (para la mini-página pública). */
export async function ownerTienePlanActivo(ownerId: string): Promise<boolean> {
  return tienePlanActivo(await getSuscripcion(ownerId));
}
