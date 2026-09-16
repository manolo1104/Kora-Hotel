// ¿El motor de reservas de este hotel cobra de verdad o SIMULA el pago?
// SOLO servidor (lee Stripe Connect con la service-role).
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
//
// El 15 sep 2026 la web pasa a decir «regístrate y pruébalo por dentro». Hasta
// hoy, «probar» el motor era peligroso por dos razones que se suman:
//
//   1. Un hotel nace PUBLICADO (`app/api/panel/crear-hotel`), así que su motor
//      acepta pagos desde el minuto uno.
//   2. Si el hotel todavía no terminó su alta en Stripe Connect, el cobro NO
//      falla: cae en la cuenta de Kora (`app/api/h/[slug]/checkout/route.ts`,
//      «cobro a la cuenta de Kora, no a la del hotel») y Manolo lo concilia a
//      mano. Cuatro de seis hoteles publicados estaban así el 26 ago 2026.
//
// Invitar a todo el que se registra a «hacer una reserva de prueba» con esas
// dos cosas juntas es invitarlo a pagarle a Kora con su propia tarjeta, y a
// Manolo a devolver cada prueba a mano.
//
// ── LA REGLA (decisión de Manolo, 15 sep 2026) ───────────────────────────────
//
// El motor simula el pago —no llega nada a Stripe— SÓLO si el hotel está EN
// PRUEBA (sin plan pagado ni cortesía) y su cuenta de Stripe todavía NO puede
// cobrar. Quien paga o tiene cortesía sigue exactamente igual que hoy, aunque no
// tenga Connect: apagarle el cobro a un cliente de pago sería peor que el
// problema que se arregla.
//
// Y ante la duda, simular: si no se puede leer el estado de Connect, cuenta como
// «no listo». Simular una reserva de un hotel en prueba cuesta que ese huésped
// (casi siempre el propio hotelero probando) no pague; cobrarla en la cuenta de
// Kora cuesta una devolución manual y la confianza del hotelero.

import { accesoDelHotel, type AccesoHotel } from "@/lib/suscripcion";
import { getConnectState, type ConnectState } from "@/lib/stripe/connect";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

/**
 * ¿Este estado de Connect puede cobrarle al huésped en la cuenta DEL HOTEL?
 *
 * Es literalmente el `direct` del checkout del motor. Vive aquí, y no escrito
 * dos veces, porque si un día las dos expresiones dejaran de coincidir pasaría
 * lo peor de los dos mundos: el guard creería que cobra de verdad y el checkout
 * mandaría el dinero a la cuenta de Kora (o al revés, se simularía un cobro que
 * el hotelero espera recibir).
 */
export function cobrosListosDe(connect: ConnectState): boolean {
  return Boolean(connect.chargesEnabled && connect.accountId);
}

/**
 * La decisión, PURA. Sin base, sin Stripe, sin reloj: sólo lo que ya se sabe.
 *
 * `acceso.prueba !== null` es lo que dice «está en prueba»: `accesoDelHotel` la
 * deja en null cuando hay plan, cuando es demo y cuando no pudo leer la
 * suscripción (en ese caso falla abierto y el motor sigue como siempre).
 */
export function decidirModoPrueba(a: {
  acceso: AccesoHotel;
  cobrosListos: boolean;
  demo: boolean;
}): boolean {
  const { acceso, cobrosListos, demo } = a;
  return (
    !demo &&
    acceso.activo &&
    !acceso.bloqueado &&
    !acceso.planActivo &&
    acceso.prueba !== null &&
    !cobrosListos
  );
}

/**
 * ¿La cuenta de Stripe de este hotel puede cobrar YA? `charges_enabled` real,
 * no «tiene un stripe_account_id»: una cuenta a medias tiene id y no cobra, y
 * es justo el caso que desvía el dinero a Kora. NUNCA lanza; ante cualquier
 * duda, false.
 *
 * `stripeAccountId`: pásalo si ya lo leíste. `undefined` = se lee de `hoteles`
 * aquí (la columna no la puede leer el navegador, por eso va con service-role).
 */
export async function cobrosListosDelHotel(
  hotelId: string,
  stripeAccountId?: string | null,
): Promise<boolean> {
  try {
    let cuenta = stripeAccountId;
    if (cuenta === undefined) {
      if (!adminEnvReady || !hotelId) return false;
      const { data, error } = await createAdminClient()
        .from("hoteles")
        .select("stripe_account_id")
        .eq("id", hotelId)
        .maybeSingle();
      if (error) {
        console.error(`[modo-prueba] no se pudo leer la cuenta de Stripe de ${hotelId}; se simula:`, error.message);
        return false;
      }
      cuenta = (data as { stripe_account_id?: string | null } | null)?.stripe_account_id ?? null;
    }
    if (!cuenta) return false;

    // Misma fuente que el checkout del motor (cache en BD, Stripe en vivo si está
    // viejo): lo que aquí dice «listo» es exactamente lo que allí cobra directo.
    const connect = await getConnectState(hotelId, cuenta);
    return cobrosListosDe(connect);
  } catch (e) {
    console.error(`[modo-prueba] no se pudo leer Connect de ${hotelId}; se simula:`, e);
    return false;
  }
}

/**
 * ¿El motor de este hotel está en modo prueba? NUNCA lanza.
 *
 * `acceso`: pásalo si ya lo calculaste (el checkout lo tiene a mano) y te
 * ahorras leer la suscripción dos veces. Sólo se consulta Connect cuando el
 * resto de la regla ya dice «podría ser modo prueba»: a un hotel que paga esta
 * función no le cuesta ninguna llamada a Stripe.
 */
export async function motorEnModoPrueba(
  hotel: {
    id: string;
    owner_id: string;
    created_at?: string | null;
    extras?: Record<string, unknown> | null;
    publicado?: boolean | null;
    /** Opcional: si viene (aunque sea null), no se vuelve a leer de la base. */
    stripe_account_id?: string | null;
  },
  acceso?: AccesoHotel,
): Promise<boolean> {
  try {
    const demo = (hotel.extras as { demo?: boolean } | null)?.demo === true;
    // El demo ya simula por su cuenta (y nunca llega al checkout): no es esto.
    if (demo) return false;

    const a = acceso ?? (await accesoDelHotel(hotel));
    // Atajo: si ya sin Connect la respuesta es «no», no se le pregunta a Stripe.
    if (!decidirModoPrueba({ acceso: a, cobrosListos: false, demo })) return false;

    const cuenta = "stripe_account_id" in hotel ? (hotel.stripe_account_id ?? null) : undefined;
    const cobrosListos = await cobrosListosDelHotel(hotel.id, cuenta);
    return decidirModoPrueba({ acceso: a, cobrosListos, demo });
  } catch (e) {
    // Sólo llega aquí un fallo inesperado de `accesoDelHotel` (que no lanza por
    // diseño). Sin saber si está en prueba no se puede decidir simular: se deja
    // el motor como estaba, que es lo que hacía antes de existir esta función.
    console.error(`[modo-prueba] no se pudo decidir para ${hotel?.id}:`, e);
    return false;
  }
}
