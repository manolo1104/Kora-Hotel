import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { releaseHold, sesionStripeDelApartado } from "@/lib/db/availability";
import { liberarExperienciaApartado } from "@/lib/db/experiencias";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { getConnectState } from "@/lib/stripe/connect";

export const dynamic = "force-dynamic";

// Libera el hold del carrito cuando el huésped regresa de un Checkout
// cancelado (?cancelado=1&hs=...). Sin esto, su propio hold le bloqueaba el
// cuarto ~30 min a él y a cualquier otro visitante. El id es un UUID que solo
// conoce quien inició esa sesión: no se puede liberar el hold de un tercero.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { session?: unknown } | null;
  const session = typeof body?.session === "string" ? body.session : "";
  if (!/^web_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(session)) {
    return NextResponse.json({ error: "session-invalida" }, { status: 400 });
  }

  // ORDEN: primero se APAGA la sesión de pago, después se suelta el cuarto.
  //
  // Al revés queda una ventana en la que existe una sesión de Stripe pagable
  // cuyo cuarto ya está a la venta otra vez (K-102): el huésped vuelve a esa
  // pestaña, paga, y o le creamos una reserva que no debía existir o —si otro
  // se llevó el cuarto— le cobramos para reembolsarle acto seguido. La sesión
  // de Checkout vive hasta 31 minutos, así que la ventana no es teórica.
  //
  // Es mejor esfuerzo: si apagarla falla, se suelta el cuarto igual. Dejarle el
  // cuarto bloqueado 35 minutos a un huésped que ya se fue es peor.
  if (stripeEnvReady) {
    try {
      const stripeSessionId = await sesionStripeDelApartado(hotel.id, session);
      if (stripeSessionId) {
        const connect = await getConnectState(hotel.id, hotel.stripe_account_id);
        const opciones = connect.chargesEnabled && connect.accountId
          ? { stripeAccount: connect.accountId }
          : undefined;
        // Firma: expire(id, params, options). La cuenta conectada va en el
        // TERCER argumento; en el segundo, TypeScript la acepta como objeto
        // vacío y la petición saldría contra la cuenta de Kora.
        await getStripe().checkout.sessions.expire(stripeSessionId, undefined, opciones);
      }
    } catch (e) {
      // `already_expired` / `session_completed` entran aquí y son normales: el
      // huésped pagó o Stripe la caducó antes que nosotros.
      console.error("[h/[slug]/hold] no se pudo expirar la sesión de Stripe:", e);
    }
  }

  await releaseHold(hotel.id, session);
  // Y los lugares de experiencias que ese mismo apartado tenía reservados.
  await liberarExperienciaApartado(hotel.id, session);
  return NextResponse.json({ ok: true });
}
