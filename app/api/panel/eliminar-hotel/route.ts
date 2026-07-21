import { NextResponse } from "next/server";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getHotelMember, getHotelesDelUsuario } from "@/lib/tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Elimina un hotel de forma PERMANENTE (hard delete: la FK cascade borra
// reservas, huéspedes, cotizaciones, miembros, tareas, email_log, canales OTA…).
// Blindado: identidad de la sesión, solo el DUEÑO, re-verificación de la
// contraseña de la cuenta, y cancelación de Stripe si es su último hotel.
export async function POST(req: Request) {
  if (!supabaseEnvReady || !adminEnvReady) {
    return NextResponse.json({ error: "Cuentas aún no configuradas." }, { status: 503 });
  }

  // 1) Identidad SIEMPRE de la sesión (nunca del body).
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  }

  // 2) Body.
  let body: { slug?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const slug = (body.slug ?? "").trim();
  const password = body.password ?? "";
  if (!slug || !password) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  // 3) Pertenencia + solo el dueño puede borrar.
  const ctx = await getHotelMember(slug);
  if (!ctx) {
    return NextResponse.json({ error: "No tienes acceso a ese hotel." }, { status: 403 });
  }
  if (ctx.rol !== "dueno") {
    return NextResponse.json(
      { error: "Solo el dueño de la cuenta puede eliminar el hotel." },
      { status: 403 }
    );
  }

  // 4) Re-verificar la contraseña de la cuenta con un cliente EFÍMERO
  //    (persistSession:false) para no rotar la sesión viva del usuario.
  const ephemeral = createSbClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await ephemeral.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) {
    return NextResponse.json(
      {
        error:
          "Contraseña incorrecta. Si entraste con enlace mágico, primero crea una contraseña desde “¿Olvidaste tu contraseña?”.",
      },
      { status: 403 }
    );
  }

  // 5) Stripe: si este es el ÚLTIMO hotel del usuario y hay suscripción activa,
  //    cancelarla en Stripe (el cascade borra la fila pero no cancela el cobro).
  try {
    const hoteles = await getHotelesDelUsuario();
    const esUltimoHotel = hoteles.length <= 1;
    if (esUltimoHotel && stripeEnvReady) {
      const admin = createAdminClient();
      const { data: susc } = await admin
        .from("suscripciones")
        .select("stripe_subscription_id, estado")
        .eq("user_id", user.id)
        .maybeSingle();
      if (susc?.stripe_subscription_id && susc.estado !== "cancelada") {
        try {
          await getStripe().subscriptions.cancel(susc.stripe_subscription_id);
        } catch (e) {
          // No bloqueamos el borrado si Stripe falla: se puede cancelar aparte.
          console.error("No se pudo cancelar la suscripción de Stripe al eliminar el hotel:", e);
        }
      }
    }
  } catch (e) {
    console.error("Error evaluando Stripe en eliminar-hotel:", e);
  }

  // 6) Borrar el hotel (cascade). Con el admin client (service-role).
  const admin = createAdminClient();
  const { error: delError } = await admin.from("hoteles").delete().eq("id", ctx.hotelId);
  if (delError) {
    console.error("Error eliminando hotel:", delError);
    return NextResponse.json(
      { error: "No pudimos eliminar el hotel. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
