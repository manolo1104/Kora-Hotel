// Estado de Stripe Connect por hotel (direct charges: el dinero entra DIRECTO
// a la cuenta del hotel; Kora no cobra comisión por reserva). La verdad vive en
// Stripe; aquí se cachea en hotel_stripe_accounts (la refresca el webhook
// account.updated y el panel de Pagos). SOLO servidor.

import type Stripe from "stripe";
import { leer, escribirMejorEsfuerzo } from "@/lib/db/result";
import { alertar } from "@/lib/alertas";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";

export type OnboardingStatus = "pendiente" | "verificado" | "requiere_info";

export interface ConnectState {
  accountId: string | null;
  onboardingStatus: OnboardingStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  oxxoEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: number;
}

export const CONNECT_NONE: ConnectState = {
  accountId: null,
  onboardingStatus: "pendiente",
  chargesEnabled: false,
  payoutsEnabled: false,
  oxxoEnabled: false,
  detailsSubmitted: false,
  requirementsDue: 0,
};

/** Deriva el estado propio a partir de la cuenta de Stripe. */
export function deriveConnectState(acct: Stripe.Account): ConnectState {
  const due = acct.requirements?.currently_due?.length ?? 0;
  const pastDue = acct.requirements?.past_due?.length ?? 0;
  const disabled = Boolean(acct.requirements?.disabled_reason);
  let status: OnboardingStatus = "pendiente";
  if (acct.charges_enabled && due === 0 && pastDue === 0 && !disabled) status = "verificado";
  else if (acct.details_submitted) status = "requiere_info";
  return {
    accountId: acct.id,
    onboardingStatus: status,
    chargesEnabled: Boolean(acct.charges_enabled),
    payoutsEnabled: Boolean(acct.payouts_enabled),
    oxxoEnabled: acct.capabilities?.oxxo_payments === "active",
    detailsSubmitted: Boolean(acct.details_submitted),
    requirementsDue: due + pastDue,
  };
}

/** Persiste el estado (best-effort: la tabla puede no existir aún). */
export async function upsertConnectState(hotelId: string, state: ConnectState): Promise<void> {
  if (!state.accountId) return;
  try {
    // Mejor-esfuerzo declarado: es un cache. La verdad vive en Stripe y
    // `getConnectState` sabe consultarla en vivo si esto no está.
    await escribirMejorEsfuerzo("connect.cacheEscribir", createAdminClient()
      .from("hotel_stripe_accounts")
      .upsert(
        {
          hotel_id: hotelId,
          stripe_account_id: state.accountId,
          onboarding_status: state.onboardingStatus,
          charges_enabled: state.chargesEnabled,
          payouts_enabled: state.payoutsEnabled,
          oxxo_enabled: state.oxxoEnabled,
          details_submitted: state.detailsSubmitted,
          requirements_due: state.requirementsDue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "hotel_id" },
      ));
  } catch (e) {
    console.error("upsertConnectState error:", e);
  }
}

/** Cuánto vale el cache antes de volver a preguntarle a Stripe. */
export const CACHE_MAX_HORAS = 24;

/**
 * ¿Sirve todavía la fila del cache, o hay que preguntarle a Stripe en vivo?
 *
 * Va aparte y exportada para poder probarla sin Supabase ni Stripe: es la regla
 * que decide EN QUÉ CUENTA entra el dinero de un huésped, y la llave de Stripe
 * de esta máquina es `sk_live`, así que ejercitar el checkout entero en local
 * crearía sesiones de verdad. Sin fecha legible devuelve `false`: preguntar de
 * más cuesta una llamada; dar por bueno un estado que no se sabe de cuándo es
 * cuesta el cobro.
 */
export function cacheVigente(updatedAt: string | null | undefined, ahora = Date.now()): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return ahora - t < CACHE_MAX_HORAS * 3_600_000;
}

interface ConnectRow {
  stripe_account_id: string;
  onboarding_status: OnboardingStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  oxxo_enabled: boolean;
  details_submitted: boolean;
  requirements_due: number;
  updated_at: string;
}

/**
 * Estado Connect de un hotel para decidir el cobro. Lee el cache en BD (rápido,
 * lo mantiene el webhook); si no hay fila, consulta Stripe en vivo y siembra el
 * cache. Nunca lanza: sin cuenta usable devuelve CONNECT_NONE (cobro degradado
 * en la cuenta plataforma).
 */
export async function getConnectState(
  hotelId: string,
  stripeAccountId: string | null | undefined,
  opts?: { live?: boolean }, // live: saltar el cache (ej. al volver del onboarding de Stripe)
): Promise<ConnectState> {
  if (!stripeAccountId || !stripeEnvReady) return CONNECT_NONE;

  if (opts?.live) {
    try {
      const acct = await getStripe().accounts.retrieve(stripeAccountId);
      const state = deriveConnectState(acct);
      await upsertConnectState(hotelId, state);
      return state;
    } catch {
      // Stripe caído: cae al cache de abajo.
    }
  }

  // Si el cache está viejo se consulta a Stripe en vivo, pero se guarda por si
  // esa consulta falla: devolver CONNECT_NONE ahí significaría cobrar en la
  // cuenta de Kora a un hotel que sí tiene la suya lista (K-332).
  let cacheViejo: ConnectState | null = null;

  try {
    const data = await leer<ConnectRow>(
      "connect.cache",
      createAdminClient()
        .from("hotel_stripe_accounts")
        .select(
          "stripe_account_id, onboarding_status, charges_enabled, payouts_enabled, oxxo_enabled, details_submitted, requirements_due, updated_at",
        )
        .eq("hotel_id", hotelId)
        .maybeSingle(),
    );
    if (data) {
      const row = data as ConnectRow;
      // Si la cuenta cambió (reconexión), se ignora el cache viejo.
      if (row.stripe_account_id === stripeAccountId) {
        const estado: ConnectState = {
          accountId: row.stripe_account_id,
          onboardingStatus: row.onboarding_status,
          chargesEnabled: row.charges_enabled,
          payoutsEnabled: row.payouts_enabled,
          oxxoEnabled: row.oxxo_enabled,
          detailsSubmitted: row.details_submitted,
          requirementsDue: row.requirements_due,
        };
        // El cache lo mantiene fresco el webhook `account.updated`, pero ese
        // webhook se puede perder o llegar mal: sin caducidad, una fila que dice
        // `charges_enabled: false` de hace meses manda el cobro a la cuenta de
        // Kora aunque el hotelero ya haya terminado su alta — y al revés, un
        // `true` viejo manda el cobro a una cuenta que Stripe ya suspendió.
        if (cacheVigente(row.updated_at)) return estado;
        cacheViejo = estado;
      }
    }
  } catch (e) {
    // Sigue al retrieve en vivo, así que el checkout no se cae — pero ya no en
    // silencio: si esta tabla deja de leerse, cada checkout y cada carga del
    // panel se van a Stripe en vivo, y eso se nota como lentitud sin causa
    // aparente hasta que alguien mira los logs.
    await alertar(
      "no se pudo leer el cache de Stripe Connect",
      `Hotel ${hotelId}. ${e instanceof Error ? e.message : String(e)}. ` +
        `Se consulta a Stripe en vivo mientras tanto.`,
    );
  }

  try {
    const acct = await getStripe().accounts.retrieve(stripeAccountId);
    const state = deriveConnectState(acct);
    await upsertConnectState(hotelId, state);
    return state;
  } catch (e) {
    console.error("getConnectState retrieve error:", e);
    // Stripe no contestó. Si había cache —aunque esté viejo— vale mil veces más
    // que CONNECT_NONE: lo segundo desvía el cobro a la cuenta de Kora, y eso el
    // hotelero no lo ve en su panel ni en su Stripe.
    if (cacheViejo) {
      await alertar(
        "Stripe no contestó y se usó el cache viejo de Connect",
        `Hotel ${hotelId}, cuenta ${stripeAccountId}. ${e instanceof Error ? e.message : String(e)}. ` +
          `Se sigue cobrando en la cuenta del hotel con el último estado conocido.`,
      );
      return cacheViejo;
    }
    return CONNECT_NONE;
  }
}

/**
 * Pide la capability de OXXO a una cuenta existente que no la tenga (las
 * cuentas nuevas ya la piden al crearse). Best-effort.
 */
export async function ensureOxxoCapability(acct: Stripe.Account): Promise<void> {
  const cap = acct.capabilities?.oxxo_payments;
  if (cap === "active" || cap === "pending") return;
  try {
    await getStripe().accounts.update(acct.id, {
      capabilities: { oxxo_payments: { requested: true } },
    });
  } catch (e) {
    console.error("ensureOxxoCapability error:", e);
  }
}
