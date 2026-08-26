import { leer } from "@/lib/db/result";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { planPorClave } from "@/lib/oferta";
import { pruebaDelHotel } from "@/lib/suscripcion";

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

    // La prueba de 30 días vive en el PRODUCTO (corre desde que creó su primer
    // hotel, sin tarjeta). Al activar el plan se respeta el tiempo que le QUEDE:
    // ni 30 días extra encima de su prueba, ni cobrarle antes de tiempo. Sin
    // hotel aún (paga primero, carga después) → 30 días desde hoy. Prueba
    // vencida (o a <48 h, mínimo de Stripe) → el cobro corre desde hoy.
    // Lanza si falla: sin este dato la prueba se recalcula como 30 días desde
    // hoy, y a un hotelero que lleva 28 días de prueba se le regalarían otros 30.
    const primerHotel = await leer<{ created_at: string | null; extras: Record<string, unknown> | null }>(
      "checkout.primerHotel",
      admin
        .from("hoteles")
        .select("created_at, extras")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    );
    const prueba = primerHotel
      ? pruebaDelHotel(primerHotel as { created_at: string | null; extras: Record<string, unknown> | null })
      : null;
    const subMeta = { user_id: user.id, plan: plan.clave };
    const subscriptionData = !primerHotel
      ? { trial_period_days: 30, metadata: subMeta }
      : prueba && !prueba.vencida && prueba.diasRestantes >= 2
        ? { trial_end: Math.floor(prueba.fin.getTime() / 1000), metadata: subMeta }
        : { metadata: subMeta };

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
