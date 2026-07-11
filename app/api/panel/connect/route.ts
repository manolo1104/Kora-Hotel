import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { deriveConnectState, upsertConnectState, ensureOxxoCapability } from "@/lib/stripe/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe Connect (Express) por hotel: el dueño conecta SU cuenta y los pagos de
// reservas entran DIRECTO a ella (direct charges, sin comisión de Kora). Solo
// un miembro del hotel puede consultar; solo el dueño puede conectar.

// Estado de la conexión (consulta en vivo: esta pantalla es el reconciliador).
export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  if (!stripeEnvReady) return NextResponse.json({ connected: false, stripe: false });

  const accountId = ctx.hotel.stripe_account_id;
  if (!accountId) return NextResponse.json({ connected: false, stripe: true });

  const stripe = getStripe();
  try {
    const account = await stripe.accounts.retrieve(accountId);
    const state = deriveConnectState(account);
    // Mantiene fresco el cache que usa el checkout + pide OXXO si falta.
    await upsertConnectState(ctx.hotelId, state);
    await ensureOxxoCapability(account);

    // Link al Express Dashboard de Stripe (solo con onboarding enviado).
    let dashboardUrl: string | null = null;
    if (state.detailsSubmitted) {
      try {
        const login = await stripe.accounts.createLoginLink(accountId);
        dashboardUrl = login.url;
      } catch {
        dashboardUrl = null;
      }
    }

    // Últimos depósitos a su banco (payouts automáticos de Stripe).
    let payouts: Array<{ amount: number; currency: string; arrivalDate: string; status: string }> = [];
    if (state.chargesEnabled) {
      try {
        const list = await stripe.payouts.list({ limit: 5 }, { stripeAccount: accountId });
        payouts = list.data.map((p) => ({
          amount: p.amount / 100,
          currency: p.currency.toUpperCase(),
          arrivalDate: new Date(p.arrival_date * 1000).toISOString().slice(0, 10),
          status: p.status,
        }));
      } catch {
        payouts = [];
      }
    }

    return NextResponse.json({
      stripe: true,
      accountId,
      connected: state.chargesEnabled,
      pendiente: !state.chargesEnabled,
      status: state.onboardingStatus,
      chargesEnabled: state.chargesEnabled,
      payoutsEnabled: state.payoutsEnabled,
      oxxoEnabled: state.oxxoEnabled,
      requirementsDue: state.requirementsDue,
      dashboardUrl,
      payouts,
    });
  } catch {
    return NextResponse.json({ connected: false, stripe: true });
  }
}

// Inicia (o reanuda) el onboarding de Connect y devuelve el link hospedado.
export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  if (!stripeEnvReady) {
    return NextResponse.json({ error: "Pagos aún no configurados." }, { status: 503 });
  }
  if (ctx.rol !== "dueno") {
    return NextResponse.json({ error: "Solo el dueño puede conectar pagos." }, { status: 403 });
  }

  const stripe = getStripe();
  const admin = createAdminClient();
  const origin = new URL(req.url).origin;

  // ¿A dónde volver al terminar con Stripe? Whitelist: pagos (default) u
  // onboarding (el wizard de configuración manda {returnTo:"onboarding"}).
  const body = (await req.json().catch(() => ({}))) as { returnTo?: string };
  const volverA = body.returnTo === "onboarding" ? "onboarding" : "pagos";
  const tenant = ctx; // capturado no-nulo para las funciones anidadas

  // Crea una cuenta Express nueva y la guarda en el hotel.
  async function crearCuentaNueva(): Promise<string> {
    const account = await stripe.accounts.create({
      type: "express",
      country: "MX",
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
        oxxo_payments: { requested: true }, // pagos en efectivo vía OXXO
      },
      metadata: { hotel_id: tenant.hotelId, slug: tenant.hotel.slug },
    });
    await admin.from("hoteles").update({ stripe_account_id: account.id }).eq("id", tenant.hotelId);
    await upsertConnectState(tenant.hotelId, deriveConnectState(account));
    return account.id;
  }

  const crearLink = (account: string) =>
    stripe.accountLinks.create({
      account,
      refresh_url: `${origin}/panel/${tenant.hotel.slug}/${volverA}?refresh=1`,
      return_url: `${origin}/panel/${tenant.hotel.slug}/${volverA}?ok=1`,
      type: "account_onboarding",
    });

  try {
    let accountId = tenant.hotel.stripe_account_id || (await crearCuentaNueva());

    let link;
    try {
      link = await crearLink(accountId);
    } catch (e: unknown) {
      // La cuenta guardada no existe con la llave actual (típico: se creó en modo
      // PRUEBA y ahora corres en VIVO → "No such account"). Se limpia y se crea una
      // nueva, en vez de fallar para siempre.
      const err = e as { code?: string; message?: string };
      const noExiste =
        err?.code === "resource_missing" ||
        /no such account|does not exist|account.*not found/i.test(err?.message || "");
      if (!noExiste) throw e;
      console.warn("connect: cuenta guardada inválida, recreando:", err?.message);
      accountId = await crearCuentaNueva();
      link = await crearLink(accountId);
    }

    return NextResponse.json({ url: link.url });
  } catch (e: unknown) {
    console.error("connect onboarding error:", e);
    const msg = (e as { message?: string })?.message;
    // Se propaga el mensaje real de Stripe (esta pantalla es solo del dueño), que
    // suele ser accionable ("completa el perfil de tu plataforma", etc.).
    return NextResponse.json(
      { error: msg ? `No se pudo iniciar la conexión de pagos: ${msg}` : "No se pudo iniciar la conexión de pagos." },
      { status: 500 },
    );
  }
}
