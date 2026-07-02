// Estado de Stripe Connect por hotel (direct charges: el dinero entra DIRECTO
// a la cuenta del hotel; Kora no cobra comisión por reserva). La verdad vive en
// Stripe; aquí se cachea en hotel_stripe_accounts (la refresca el webhook
// account.updated y el panel de Pagos). SOLO servidor.

import type Stripe from "stripe";
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
    const { error } = await createAdminClient()
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
      );
    if (error) console.error("upsertConnectState error:", error);
  } catch (e) {
    console.error("upsertConnectState error:", e);
  }
}

interface ConnectRow {
  stripe_account_id: string;
  onboarding_status: OnboardingStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  oxxo_enabled: boolean;
  details_submitted: boolean;
  requirements_due: number;
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

  try {
    const { data } = await createAdminClient()
      .from("hotel_stripe_accounts")
      .select(
        "stripe_account_id, onboarding_status, charges_enabled, payouts_enabled, oxxo_enabled, details_submitted, requirements_due",
      )
      .eq("hotel_id", hotelId)
      .maybeSingle();
    if (data) {
      const row = data as ConnectRow;
      // Si la cuenta cambió (reconexión), se ignora el cache viejo.
      if (row.stripe_account_id === stripeAccountId) {
        return {
          accountId: row.stripe_account_id,
          onboardingStatus: row.onboarding_status,
          chargesEnabled: row.charges_enabled,
          payoutsEnabled: row.payouts_enabled,
          oxxoEnabled: row.oxxo_enabled,
          detailsSubmitted: row.details_submitted,
          requirementsDue: row.requirements_due,
        };
      }
    }
  } catch {
    // Tabla sin crear o error transitorio → sigue al retrieve en vivo.
  }

  try {
    const acct = await getStripe().accounts.retrieve(stripeAccountId);
    const state = deriveConnectState(acct);
    await upsertConnectState(hotelId, state);
    return state;
  } catch (e) {
    console.error("getConnectState retrieve error:", e);
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
