import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe Connect (Express) por hotel: el dueño conecta SU cuenta para recibir
// los pagos de sus reservas directamente. Solo un miembro del hotel puede hacerlo.

// Estado de la conexión.
export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  if (!stripeEnvReady) return NextResponse.json({ connected: false, stripe: false });

  const accountId = ctx.hotel.stripe_account_id;
  if (!accountId) return NextResponse.json({ connected: false, stripe: true });

  try {
    const account = await getStripe().accounts.retrieve(accountId);
    return NextResponse.json({
      connected: Boolean(account.charges_enabled),
      pendiente: !account.charges_enabled,
      accountId,
      stripe: true,
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

  try {
    let accountId = ctx.hotel.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "MX",
        email: undefined,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { hotel_id: ctx.hotelId, slug: ctx.hotel.slug },
      });
      accountId = account.id;
      await admin.from("hoteles").update({ stripe_account_id: accountId }).eq("id", ctx.hotelId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/panel/${ctx.hotel.slug}/pagos?refresh=1`,
      return_url: `${origin}/panel/${ctx.hotel.slug}/pagos?ok=1`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (e) {
    console.error("connect onboarding error:", e);
    return NextResponse.json({ error: "No se pudo iniciar la conexión de pagos." }, { status: 500 });
  }
}
