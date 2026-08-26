import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from "next/server";
import { escribir } from "@/lib/db/result";
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
  // El POST de más abajo ya exigía `dueno`; el GET no comprobaba el rol y devuelve
  // cosas más delicadas que el POST: `dashboardUrl` es un enlace de un solo uso
  // que abre una sesión YA AUTENTICADA en el Express Dashboard de Stripe del
  // hotel — donde se cambia la cuenta bancaria a la que caen los depósitos— más
  // el saldo, los últimos 10 cobros y los últimos 5 depósitos. Cualquier miembro
  // (limpieza, cocina, recepción) lo obtenía con un fetch desde la consola: la UI
  // sólo escondía el botón. Es desvío de dinero, no una fuga de información.
  const noPuede = negar(ctx, "pagos:ver");
  if (noPuede) return noPuede;
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

    // Saldo, pagos cobrados y últimos depósitos: todo lo que el hotelero necesita
    // para NO tener que entrar a Stripe. Los montos de saldo y de "recibe" son
    // NETOS (ya sin la comisión de Stripe) para que el número sea el real.
    let payouts: Array<{ amount: number; currency: string; arrivalDate: string; status: string }> = [];
    let balance: { available: number; pending: number; currency: string } | null = null;
    let payments: Array<{
      created: string;
      availableOn: string; // fecha estimada en que el dinero llega al banco
      gross: number;
      fee: number;
      net: number;
      currency: string;
      status: string; // 'available' (ya depositable) | 'pending' (en camino)
    }> = [];
    if (state.chargesEnabled) {
      // Últimos depósitos a su banco (payouts automáticos de Stripe).
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

      // Saldo: disponible (ya liberado) + en camino (cobrado pero aún retenido).
      try {
        const bal = await stripe.balance.retrieve({}, { stripeAccount: accountId });
        const sum = (arr: Array<{ amount: number }>) => arr.reduce((s, x) => s + x.amount, 0) / 100;
        const cur = bal.available[0]?.currency || bal.pending[0]?.currency || "mxn";
        balance = {
          available: sum(bal.available),
          pending: sum(bal.pending),
          currency: cur.toUpperCase(),
        };
      } catch {
        balance = null;
      }

      // Pagos ya cobrados (aunque Stripe todavía no los deposite). El balance
      // transaction trae bruto (amount), comisión (fee) y NETO (net) de cada uno.
      try {
        const txns = await stripe.balanceTransactions.list({ limit: 20 }, { stripeAccount: accountId });
        payments = txns.data
          .filter((t) => t.type === "charge" || t.type === "payment")
          .slice(0, 10)
          .map((t) => ({
            created: new Date(t.created * 1000).toISOString().slice(0, 10),
            availableOn: new Date(t.available_on * 1000).toISOString().slice(0, 10),
            gross: t.amount / 100,
            fee: t.fee / 100,
            net: t.net / 100,
            currency: t.currency.toUpperCase(),
            status: t.status,
          }));
      } catch {
        payments = [];
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
      balance,
      payments,
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
  const noConecta = negar(ctx, "pagos:conectar");
  if (noConecta) return noConecta;

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
    // LANZA si falla. Es la escritura que ata la cuenta de Stripe recién creada a
    // su hotel: si se pierde, el hotelero termina el onboarding con Stripe, el
    // dinero tiene a dónde llegar y Kora no lo sabe — a la siguiente le crea otra
    // cuenta distinta, y el panel de Pagos le dice que no ha conectado nada.
    await escribir(
      "hoteles.stripeAccountId",
      admin.from("hoteles").update({ stripe_account_id: account.id }).eq("id", tenant.hotelId),
    );
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
