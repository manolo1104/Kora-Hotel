import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { planPorClave } from "@/lib/oferta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// Crea la sesión de Stripe Checkout para suscribirse a un plan.
// Requiere sesión de Supabase: así el webhook siempre sabe a qué usuario
// pertenece el pago (metadata.user_id) y nunca hay pagos huérfanos.
export async function POST(req: Request) {
  if (!stripeEnvReady || !adminEnvReady) {
    return NextResponse.json(
      { error: "Los pagos en línea aún no están activos. Escríbenos y te ayudamos." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const plan = planPorClave(body.plan);
  if (!plan || !plan.priceId) {
    return NextResponse.json({ error: "Plan no válido." }, { status: 400 });
  }

  const stripe = getStripe();
  const admin = createAdminClient();

  try {
    // Reusar el customer si ya existe; si no, crearlo y guardarlo.
    const { data: susc } = await admin
      .from("suscripciones")
      .select("stripe_customer_id, estado")
      .eq("user_id", user.id)
      .maybeSingle();

    if (susc && (susc.estado === "activa" || susc.estado === "cortesia")) {
      return NextResponse.json(
        { error: "Ya tienes un plan activo. Adminístralo desde tu panel." },
        { status: 409 }
      );
    }
    // Con pago vencido NO se abre otra suscripción (quedarían dos vivas en
    // Stripe y la fila única por usuario dejaría huérfana la primera): que
    // regularice el pago desde el portal de facturación en su panel.
    if (susc && susc.estado === "pago_vencido") {
      return NextResponse.json(
        {
          error:
            "Tu plan tiene un pago pendiente. Actualiza tu tarjeta desde tu panel (Mi suscripción) y se reactiva solo.",
        },
        { status: 409 }
      );
    }

    let customerId = susc?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("suscripciones")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId, estado: "incompleta" },
          { onConflict: "user_id" }
        );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      metadata: { user_id: user.id, plan: plan.clave },
      subscription_data: {
        trial_period_days: 30, // 30 días de prueba: la tarjeta queda en garantía, el primer cobro es hasta el día 31
        metadata: { user_id: user.id, plan: plan.clave },
      },
      success_url: `${SITE}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/precios`,
      locale: "es",
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Error creando Checkout de Stripe:", e);
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Inténtalo de nuevo en un momento." },
      { status: 500 }
    );
  }
}
