import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

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
    const session = await getStripe().billingPortal.sessions.create({
      customer: susc.stripe_customer_id,
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
