import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { planPorClave, planPorPriceId } from "@/lib/oferta";
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";
import { emailBienvenida } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook de Stripe: la única fuente que ESCRIBE el estado de las suscripciones.
// La firma se verifica sobre el cuerpo CRUDO (req.text), nunca sobre JSON parseado.

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// El API "basil" de Stripe movió algunos campos; estos helpers leen ambas formas.
function subscriptionIdDeInvoice(inv: Stripe.Invoice): string | null {
  const legacy = (inv as unknown as { subscription?: string | { id: string } }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  const parent = (inv as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } } };
  }).parent;
  const sub = parent?.subscription_details?.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object") return sub.id;
  return null;
}

function periodoFinDeSub(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const fin =
    item?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return fin ? new Date(fin * 1000).toISOString() : null;
}

function planDeSub(sub: Stripe.Subscription): string | null {
  const porMeta = planPorClave(sub.metadata?.plan)?.clave;
  if (porMeta) return porMeta;
  return planPorPriceId(sub.items?.data?.[0]?.price?.id)?.clave ?? null;
}

function estadoDeSub(sub: Stripe.Subscription): string {
  switch (sub.status) {
    case "active":
    case "trialing":
      return "activa";
    case "past_due":
    case "unpaid":
      return "pago_vencido";
    case "canceled":
      return "cancelada";
    default:
      return "incompleta";
  }
}

export async function POST(req: Request) {
  if (!stripeEnvReady || !WEBHOOK_SECRET || !adminEnvReady) {
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 503 });
  }

  const firma = req.headers.get("stripe-signature");
  if (!firma) return NextResponse.json({ error: "Sin firma." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const cuerpo = await req.text();
    event = getStripe().webhooks.constructEvent(cuerpo, firma, WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const userId = session.metadata?.user_id;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!userId || !subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const plan = planDeSub(sub);

        await admin.from("suscripciones").upsert(
          {
            user_id: userId,
            stripe_customer_id:
              typeof session.customer === "string" ? session.customer : session.customer?.id,
            stripe_subscription_id: subId,
            plan,
            estado: "activa",
            periodo_fin: periodoFinDeSub(sub),
            cancela_al_final: false,
            avisos_dunning: 0,
          },
          { onConflict: "user_id" }
        );

        // Email de bienvenida al cliente + aviso interno al fundador.
        const email = session.customer_details?.email;
        const planInfo = planPorClave(plan);
        if (email && planInfo) {
          await enviarEmail({ to: email, ...emailBienvenida({ plan: planInfo.nombre, precio: planInfo.precio }) });
        }
        if (NOTIFY_EMAIL) {
          await enviarEmail({
            to: NOTIFY_EMAIL,
            subject: `💳 Nueva suscripción: plan ${planInfo?.nombre ?? plan ?? "?"} (${email ?? "sin email"})`,
            html: `<p>Se activó una suscripción nueva en Kora. Cliente: ${email ?? "?"}. Plan: ${planInfo?.nombre ?? "?"}.</p>`,
          });
        }
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = subscriptionIdDeInvoice(inv);
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        await admin
          .from("suscripciones")
          .update({ estado: "activa", periodo_fin: periodoFinDeSub(sub), avisos_dunning: 0 })
          .eq("stripe_subscription_id", subId);
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = subscriptionIdDeInvoice(inv);
        if (!subId) break;
        await admin
          .from("suscripciones")
          .update({ estado: "pago_vencido" })
          .eq("stripe_subscription_id", subId);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from("suscripciones")
          .update({
            plan: planDeSub(sub),
            estado: estadoDeSub(sub),
            periodo_fin: periodoFinDeSub(sub),
            cancela_al_final: sub.cancel_at_period_end === true,
          })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin
          .from("suscripciones")
          .update({ estado: "cancelada", cancela_al_final: false })
          .eq("stripe_subscription_id", sub.id);
        if (NOTIFY_EMAIL) {
          await enviarEmail({
            to: NOTIFY_EMAIL,
            subject: "⚠️ Suscripción cancelada en Kora",
            html: `<p>La suscripción ${sub.id} quedó cancelada (cliente ${
              typeof sub.customer === "string" ? sub.customer : sub.customer?.id
            }).</p>`,
          });
        }
        break;
      }
    }
  } catch (e) {
    console.error(`Error procesando webhook ${event.type}:`, e);
    // 500 para que Stripe reintente la entrega.
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
