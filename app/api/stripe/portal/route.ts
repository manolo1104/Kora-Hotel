import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// Configuración del portal creada POR CÓDIGO: garantiza que cancelar la
// suscripción siempre esté habilitado (la promesa "cancela en un clic" del
// sitio no puede depender de un ajuste manual en el dashboard de Stripe).
// Se crea una vez y se reutiliza (identificada por metadata.kora).
async function portalConfigId(stripe: Stripe): Promise<string | undefined> {
  try {
    const existentes = await stripe.billingPortal.configurations.list({ limit: 20 });
    const propia = existentes.data.find((c) => c.metadata?.kora === "portal-v1" && c.active);
    if (propia) return propia.id;
    const creada = await stripe.billingPortal.configurations.create({
      business_profile: { headline: "Kora — administra tu suscripción" },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end", // conserva el acceso ya pagado hasta el corte
          cancellation_reason: {
            enabled: true,
            options: ["too_expensive", "missing_features", "too_complex", "unused", "other"],
          },
        },
      },
      metadata: { kora: "portal-v1" },
    });
    return creada.id;
  } catch (e) {
    // Sin configuración propia, Stripe usa la default del dashboard (si existe).
    console.error("No se pudo asegurar la configuración del portal:", e);
    return undefined;
  }
}

// Abre el Customer Portal de Stripe: ahí el cliente cambia su tarjeta,
// descarga recibos o cancela, sin que intervenga nadie de Kora.
export async function POST() {
  if (!stripeEnvReady || !adminEnvReady) {
    return NextResponse.json({ error: "Pagos aún no configurados." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: susc } = await admin
    .from("suscripciones")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!susc?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No encontramos una suscripción tuya. Escríbenos y lo revisamos." },
      { status: 404 }
    );
  }

  try {
    const stripe = getStripe();
    const configuration = await portalConfigId(stripe);
    const session = await stripe.billingPortal.sessions.create({
      customer: susc.stripe_customer_id,
      ...(configuration ? { configuration } : {}),
      return_url: `${SITE}/panel`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Error creando portal de Stripe:", e);
    return NextResponse.json(
      { error: "No pudimos abrir el portal de pagos. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
