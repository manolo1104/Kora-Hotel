import { negar } from "@/lib/panel/permisos";
import { leer } from "@/lib/db/result";
import { NextResponse } from "next/server";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getHotelMember, getHotelesDelUsuario } from "@/lib/tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { alertar } from "@/lib/alertas";

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
  const noBorra = negar(ctx, "hotel:eliminar");
  if (noBorra) return noBorra;

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
      // Lanza si falla. Con `?? null` el hotel se borraba y la suscripción se
      // quedaba viva: a alguien que se dio de baja le seguían cobrando $550 al
      // mes por una cuenta que ya no existe.
      const susc = await leer<{ stripe_subscription_id: string | null; estado: string }>(
        "eliminarHotel.suscripcion",
        admin
          .from("suscripciones")
          .select("stripe_subscription_id, estado")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (susc?.stripe_subscription_id && susc.estado !== "cancelada") {
        try {
          // AL FINAL DEL PERIODO, no de inmediato. Cancelar desde el portal de
          // Stripe conserva el acceso que el hotelero ya pagó (así está montada
          // su configuración: `mode: "at_period_end"`), y borrar el hotel desde
          // el panel no puede ser un camino más duro a la misma salida: con
          // `subscriptions.cancel()` perdía el resto del mes ya cobrado.
          await getStripe().subscriptions.update(susc.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
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

  // ANTES de borrar: soltar el vínculo `suscripciones.hotel_id`, que es
  // `on delete cascade`. Si no, borrar el hotel se lleva por delante la fila de
  // la suscripción — y con ella el `stripe_subscription_id` de una suscripción
  // que en Stripe sigue VIVA hasta el corte del periodo (ver el paso 5). Kora la
  // olvidaría, y si el hotelero da de alta otro hotel esa misma semana el
  // checkout le abriría una SEGUNDA suscripción cobrándole dos veces. Soltando
  // el vínculo la fila sobrevive y el webhook la sigue sincronizando.
  const { error: desvincularError } = await admin
    .from("suscripciones")
    .update({ hotel_id: null })
    .eq("hotel_id", ctx.hotelId);
  // 42703 / PGRST204 = la columna no existe en esta base; entonces tampoco hay
  // cascade del que protegerse y no hay nada que avisar.
  if (desvincularError && !["42703", "PGRST204"].includes(desvincularError.code ?? "")) {
    console.error("No se pudo desvincular la suscripción del hotel:", desvincularError);
    await alertar(
      "una suscripción pudo perderse al borrar un hotel",
      `Al eliminar el hotel ${ctx.hotelId} (usuario ${user.id}) no se pudo poner ` +
        `suscripciones.hotel_id a NULL, así que el borrado en cascada puede haberse ` +
        `llevado la fila. Comprueba en Stripe si a ese cliente le sigue viva una ` +
        `suscripción y, si es así, vuelve a crear su fila en \`suscripciones\`.\n\n` +
        `${desvincularError.message}`,
    );
  }

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
