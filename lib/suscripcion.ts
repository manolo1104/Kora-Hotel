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

// Días de gracia con pago vencido: cubre los reintentos de cobro de Stripe
// (~3 semanas). Después de eso, sin pago no hay acceso — aunque el estado en
// Stripe se quede en "unpaid" en vez de "canceled" (depende de configuración
// del dashboard, no del código).
const GRACIA_PAGO_VENCIDO_DIAS = 21;

/**
 * Un plan cuenta como activo si está pagado, es cortesía (cuentas dadas de
 * alta a mano), o tiene un pago vencido RECIENTE (gracia acotada mientras
 * Stripe reintenta el cobro).
 */
export function tienePlanActivo(s: Suscripcion | null): boolean {
  if (!s) return false;
  if (s.estado === "activa" || s.estado === "cortesia") return true;
  if (s.estado === "pago_vencido") {
    // Sin periodo_fin legible somos permisivos (no castigar a un cliente por
    // un dato faltante); con él, la gracia termina 21 días después.
    if (!s.periodo_fin) return true;
    const fin = new Date(s.periodo_fin).getTime();
    if (Number.isNaN(fin)) return true;
    return Date.now() <= fin + GRACIA_PAGO_VENCIDO_DIAS * 86_400_000;
  }
  return false;
}

/** Plan activo del dueño de un hotel (para la mini-página pública). */
export async function ownerTienePlanActivo(ownerId: string): Promise<boolean> {
  return tienePlanActivo(await getSuscripcion(ownerId));
}
