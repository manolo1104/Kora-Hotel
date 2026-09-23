import { leer } from "@/lib/db/result";
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

  let body: { plan?: string; embedded?: boolean };
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
    // Lanza si falla. Con `?? null`, un error de lectura hacía que la guarda de
    // "ya tienes un plan activo" fallara en ABIERTO: el cliente que ya paga
    // llega a Stripe otra vez y acaba con dos suscripciones cobrándole.
    const susc = await leer<{ stripe_customer_id: string | null; estado: string }>(
      "checkout.suscripcionExistente",
      admin
        .from("suscripciones")
        .select("stripe_customer_id, estado")
        .eq("user_id", user.id)
        .maybeSingle(),
    );

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

    // Embebido: el pago ocurre DENTRO de kora-hotel.com (Stripe Embedded
    // Checkout, mismo nivel de seguridad PCI). Requiere la llave pública en el
    // cliente; sin ella, el flujo cae al Checkout hospedado de siempre.
    const puedeEmbebido =
      body.embedded === true && Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

    // SE COBRA EL DÍA QUE SE SUSCRIBE (decisión de Manolo, 23 sep 2026).
    //
    // Hasta ahora se respetaba lo que le quedara de prueba con un `trial_end`:
    // el hotelero ponía la tarjeta y Stripe no cobraba hasta el final. Con el
    // modelo nuevo, suscribirse es lo que abre a Camila (el QR y su chat de
    // prueba), y el webhook guarda `trialing` como `activa`: con días gratis en
    // Stripe, Camila se abría sin haber cobrado nada y se podía cancelar antes
    // del primer cargo. Ahora «pagó» significa dinero cobrado.
    const subscriptionData = { metadata: { user_id: user.id, plan: plan.clave } };

    const comun = {
      mode: "subscription" as const,
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      metadata: { user_id: user.id, plan: plan.clave },
      subscription_data: subscriptionData,
      locale: "es" as const,
      allow_promotion_codes: true,
    };

    if (puedeEmbebido) {
      const session = await stripe.checkout.sessions.create({
        ...comun,
        // "embedded_page" = el Embedded Checkout clásico (así se llama "embedded"
        // en la versión de API que fija este SDK).
        ui_mode: "embedded_page",
        return_url: `${SITE}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
      });
      return NextResponse.json({ clientSecret: session.client_secret });
    }

    const session = await stripe.checkout.sessions.create({
      ...comun,
      success_url: `${SITE}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/precios`,
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
