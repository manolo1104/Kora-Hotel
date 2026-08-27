import { leer } from "@/lib/db/result";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { alertar } from "@/lib/alertas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// Configuración del portal creada POR CÓDIGO: garantiza que cancelar la
// suscripción siempre esté habilitado (la promesa "cancela en un clic" del
// sitio no puede depender de un ajuste manual en el dashboard de Stripe).
// Se crea una vez y se reutiliza (identificada por metadata.kora).
async function portalConfigId(stripe: Stripe): Promise<string | undefined> {
  try {
    // 100 es el máximo de Stripe. Con `limit: 20`, en cuanto hubiera 20
    // configuraciones la nuestra podía quedar fuera de la página y el `find`
    // fallaba: cada visita al portal creaba OTRA configuración, y así sin fin.
    const existentes = await stripe.billingPortal.configurations.list({ limit: 100 });
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
    // ME APARTO DEL PLAN, que pedía devolverle el error al panel. El portal es
    // la ÚNICA salida del cliente para cambiar su tarjeta, bajar recibos Y
    // cancelar: cerrárselo entero porque la API de configuraciones tuvo un hipo
    // es el mismo error que fallar cerrado al leer una suscripción (K-53). Se
    // sigue abriendo con la configuración por defecto del dashboard —conserva
    // tarjeta y recibos— pero DEJA DE SER SILENCIOSO: la promesa "cancela en un
    // clic" queda sin garantizar y eso hay que saberlo el mismo día, no cuando
    // un cliente se queje de que no encuentra cómo darse de baja.
    console.error("No se pudo asegurar la configuración del portal:", e);
    await alertar(
      "el portal de Stripe se abrió SIN la configuración de Kora",
      `No se pudo leer ni crear la configuración "portal-v1". El portal se abre ` +
        `con la del dashboard de Stripe, así que "cancela en un clic" NO está ` +
        `garantizado hasta que esto se resuelva. Revisa que la configuración por ` +
        `defecto del dashboard tenga habilitado cancelar la suscripción.\n\n${String(e)}`,
    );
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
  // Lanza si falla. Antes un error se le presentaba al cliente como "no
  // encontramos una suscripción tuya", que es exactamente lo contrario de lo que
  // pasa — y lo deja sin poder cambiar su tarjeta ni cancelar.
  const susc = await leer<{ stripe_customer_id: string | null }>(
    "portal.suscripcion",
    admin
      .from("suscripciones")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  );

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
    // Un `stripe_customer_id` que Stripe ya no reconoce (el caso típico es una
    // fila que quedó de las llaves de PRUEBA, o un cliente borrado a mano) no se
    // arregla reintentando: el cliente se quedaba dando clics contra un 500
    // genérico, sin poder cambiar su tarjeta ni cancelar, y sin que nadie en Kora
    // se enterara. Se le dice la verdad y se le da una salida humana.
    if ((e as { code?: string })?.code === "resource_missing") {
      await alertar(
        "un cliente no puede abrir su portal de pagos",
        `El usuario ${user.id} tiene stripe_customer_id=${susc.stripe_customer_id}, ` +
          `y Stripe responde que no existe (resource_missing). Suele ser una fila ` +
          `creada con llaves de prueba. Hay que corregir esa fila a mano; mientras ` +
          `tanto el cliente NO puede cambiar su tarjeta ni cancelar.`,
      );
      return NextResponse.json(
        {
          error:
            "Tu cuenta de pagos necesita una corrección de nuestro lado. Escríbenos y lo resolvemos hoy mismo — no te preocupes, no se te cobra de más.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "No pudimos abrir el portal de pagos. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
