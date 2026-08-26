import { alertar } from "@/lib/alertas";
import { createAdminClient } from "@/lib/supabase/admin";
import { construirMetadataBase } from "@/lib/booking/metadata";
// Reserva TRANSACCIONAL del bot de WhatsApp (Camila). El bot manda el cuarto +
// fechas + datos del huésped; aquí se calcula el precio SIEMPRE en el servidor,
// se aparta el cuarto (hold) y se genera un LINK de pago de Stripe (direct charge
// a la cuenta del hotel). El huésped paga en un tap y el webhook existente
// (app/api/h/webhooks/stripe) crea la reserva ATÓMICA (mismo candado
// anti-overbooking que el motor web) y manda los correos.
//
// CLAVE: este módulo NO crea reservas ni toca el webhook. Solo produce una sesión
// de Checkout con la MISMA metadata que el webhook ya sabe leer. El contrato de
// metadata vive espejeado en app/api/h/[slug]/checkout/route.ts (motor web) y se
// consume en app/api/h/webhooks/stripe/route.ts — mantener los tres en sync.
//
// Separado del route para poder testear sin auth/HTTP (mismo patrón que lib/offers.ts).
//
// SOLO servidor.

import type Stripe from "stripe";
import {
  hotelRooms,
  bookingRules,
  seasonMinNoches,
  calcCartSubtotal,
  calcNights,
  calcDepositAmount,
  type CartItem,
} from "@/lib/booking";
import { freeUnitsByType, createTemporaryHold, releaseHold } from "@/lib/db/availability";
import { getConnectState } from "@/lib/stripe/connect";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import type { HotelRow } from "@/lib/tenant";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MIN_CENTS = 1000; // $10 MXN mínimo de Stripe
const OXXO_MAX_CENTS = 10_000_00; // tope de OXXO por transacción ($10,000 MXN)
const MAX_UNIDADES = 5; // el bot cierra reservas chicas; grupos grandes van a la web
const HOLD_MIN = 45; // apartar el cuarto 45 min (el chat es más lento que la web)

/**
 * Cuántos cuartos puede tener apartados el BOT a la vez en un mismo hotel.
 * 20 deja holgura de sobra: el hotel más grande de Kora tiene 11 unidades, y
 * estos apartados duran 45 minutos. Pasado ese número no es demanda, es un
 * bucle.
 */
const MAX_HOLDS_BOT = 20;

/** Apartados VIVOS creados por el bot en un hotel (los del motor web no cuentan). */
async function contarHoldsDelBot(hotelId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("blocks")
    .select("id", { count: "exact", head: true })
    .eq("hotel_id", hotelId)
    .eq("status", "HOLD")
    .like("hold_session", "bot_%")
    .gt("expires_at", new Date().toISOString());
  // Falla ABIERTO a propósito: no dejar reservar a un huésped de verdad porque
  // no se pudo contar sería peor que el abuso del que protege este tope.
  if (error) {
    console.error("[agent-booking] no se pudo contar los apartados del bot:", error.message);
    return 0;
  }
  return count ?? 0;
}
const SESSION_MIN = 40; // la sesión de pago expira ANTES que el hold (nunca pago-sin-cuarto)

export interface AgentBookingInput {
  /** id del TIPO de cuarto (preferido) o su nombre. */
  cuarto?: string | number | null;
  checkin: string; // YYYY-MM-DD
  checkout: string;
  unidades?: number; // cuántas unidades del tipo (default 1)
  huespedes?: number; // adultos (default 1)
  ninos?: number; // menores (default 0)
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
  lang?: "es" | "en";
}

export type AgentBookingResult =
  | {
      ok: true;
      url: string; // link de pago para mandarle al huésped
      holdSession: string;
      habitacion: string;
      unidades: string[]; // nombres de las unidades apartadas
      noches: number;
      total: number; // total de la estancia
      anticipo: number; // lo que paga ahora
      pendiente: number; // lo que paga al llegar
      oxxo: boolean; // si el link acepta OXXO además de tarjeta
      expiraMin: number; // minutos que dura apartado el cuarto
    }
  | {
      ok: false;
      error:
        | "datos-incompletos"
        | "fechas-invalidas"
        | "fecha-pasada"
        | "cuarto-no-encontrado"
        | "capacidad-insuficiente"
        | "min-noches"
        | "no-disponible"
        | "sin-pago"
        | "monto-invalido"
        | "stripe-error"
        | "servicio-no-disponible";
      detalle?: string;
      minNoches?: number;
      maxHuespedes?: number;
    };

function hoyMexico(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/**
 * Genera el link de pago de una reserva pedida por el bot. Devuelve un resultado
 * discriminado: `ok:false` trae un código de error que el bot traduce a lenguaje
 * natural para el huésped (p. ej. "min-noches" → "esas fechas piden mínimo N noches").
 */
export async function crearLinkReservaAgente(
  hotel: HotelRow,
  input: AgentBookingInput,
  origin: string,
): Promise<AgentBookingResult> {
  const lang = input.lang === "en" ? "en" : "es";

  // Datos del huésped: sin ellos no hay a quién confirmarle ni cobrarle. El bot
  // debe pedírselos antes de llamar aquí.
  const nombre = (input.nombre ?? "").trim();
  const email = (input.email ?? "").trim();
  const telefono = (input.telefono ?? "").trim();
  if (nombre.length < 2 || !email.includes("@") || telefono.length < 7) {
    return { ok: false, error: "datos-incompletos", detalle: "nombre, email y teléfono" };
  }

  // Fechas.
  if (!FECHA.test(input.checkin) || !FECHA.test(input.checkout)) {
    return { ok: false, error: "fechas-invalidas" };
  }
  const nights = calcNights(input.checkin, input.checkout);
  if (nights <= 0) return { ok: false, error: "fechas-invalidas" };
  if (input.checkin < hoyMexico()) return { ok: false, error: "fecha-pasada" };

  // Cuarto: por id del tipo (preferido) o por nombre (lo que teclee el huésped).
  const rooms = hotelRooms(hotel);
  const pedido = input.cuarto == null ? "" : String(input.cuarto).trim().toLowerCase();
  const room =
    rooms.find((r) => String(r.id).toLowerCase() === pedido) ??
    rooms.find((r) => r.name.trim().toLowerCase() === pedido);
  if (!room) return { ok: false, error: "cuarto-no-encontrado" };

  // Huéspedes y unidades.
  const adults = Math.max(1, Math.floor(Number(input.huespedes) || 1));
  const children = Math.max(0, Math.floor(Number(input.ninos) || 0));
  const quantity = Math.max(1, Math.min(Math.floor(Number(input.unidades) || 1), MAX_UNIDADES));
  if (room.maxGuests * quantity < adults) {
    return { ok: false, error: "capacidad-insuficiente", maxHuespedes: room.maxGuests };
  }

  // Mínimo de noches (regla del hotel, o mayor si la llegada cae en temporada).
  const rules = bookingRules(hotel);
  const minNoches = Math.max(rules.minNoches, seasonMinNoches(hotel, input.checkin));
  if (nights < minNoches) return { ok: false, error: "min-noches", minNoches };

  // Disponibilidad + asignación de UNIDADES concretas (mismo mecanismo que el
  // motor web: reservar nombres de unidad concretos hace que el candado atómico
  // impida sobreventa). Fail-closed dentro de freeUnitsByType.
  const typesAvail = await freeUnitsByType(hotel.id, hotel, input.checkin, input.checkout);
  const ta = typesAvail.find((t) => String(t.id) === String(room.id));
  if (!ta || ta.freeCount < quantity) return { ok: false, error: "no-disponible" };
  const unidades = ta.freeUnitNames.slice(0, quantity);

  // Precio SIEMPRE server-side. Los adultos se REPARTEN entre las unidades: la
  // base a cada una y una persona más a las primeras `resto`.
  //
  // Antes era `ceil(adults / quantity)` aplicado por igual a todas, así que 5
  // personas en 2 cuartos de 3 se cobraban como 3+3 = 6 personas, no 5. En un
  // hotel con tarifas por número de personas eso es dinero de más en la tarjeta
  // del huésped. La capacidad ya se validó arriba (maxGuests × quantity ≥
  // adults), así que ninguna unidad rebasa su máximo.
  const base = Math.floor(adults / quantity);
  const resto = adults % quantity;
  const repartos = Array.from({ length: quantity }, (_, i) =>
    Math.max(1, Math.min(room.maxGuests, base + (i < resto ? 1 : 0))),
  );
  const cart: CartItem[] = repartos.map((g) => ({ roomId: room.id, guestCount: g, quantity: 1 }));
  const stayTotal = calcCartSubtotal(rooms, cart, input.checkin, input.checkout, rules.nightOpts);
  const deposit = calcDepositAmount(stayTotal, nights, {
    pct: rules.anticipoPct,
    minNights: rules.anticipoMinNoches,
  });
  const pending = Math.max(0, stayTotal - deposit);

  // Cobro: exige la cuenta Stripe del hotel lista (direct charges). Sin ella el
  // bot no puede cobrar → cae con gracia a "coordina por WhatsApp con el hotel".
  if (!stripeEnvReady) return { ok: false, error: "sin-pago", detalle: "plataforma-sin-stripe" };
  const connect = await getConnectState(hotel.id, hotel.stripe_account_id);
  const direct = Boolean(connect.chargesEnabled && connect.accountId);
  if (!direct) return { ok: false, error: "sin-pago", detalle: "hotel-sin-connect" };
  const amountCents = Math.round(deposit * 100);
  if (amountCents < MIN_CENTS) return { ok: false, error: "monto-invalido" };

  // TERCERA CAPA contra un runtime comprometido.
  //
  // Las dos primeras (el token fuera de una tabla pública, y el segundo factor
  // de `/api/agent`) protegen contra un token filtrado. Ésta protege contra el
  // caso peor: que alguien controle el runtime de Camila. Sin tope, un bucle de
  // "reservar" apartaría el hotel entero en minutos — y como los holds duran 45
  // min, el motor web mostraría todo agotado sin que nadie haya pagado nada.
  //
  // El tope es por hotel y sólo cuenta los apartados VIVOS del BOT (prefijo
  // `bot_`), así que ni el motor web ni los bloqueos del panel lo consumen.
  const holdsVivos = await contarHoldsDelBot(hotel.id);
  if (holdsVivos >= MAX_HOLDS_BOT) {
    await alertar(
      "el bot llegó al tope de cuartos apartados",
      `Hotel ${hotel.slug} (${hotel.id}) tiene ${holdsVivos} apartados vivos del bot, tope ${MAX_HOLDS_BOT}. ` +
        `Si el hotel no es enorme, alguien está pidiendo links de reserva en bucle.`,
    );
    return { ok: false, error: "servicio-no-disponible", detalle: "tope-de-apartados" };
  }

  // Hold de 45 min. El id lleva prefijo `bot_` para distinguir en BD/métricas los
  // apartados del bot de los del motor web (`web_`). Lo libera el webhook al
  // confirmar/expirar; si el huésped no paga, expira solo.
  const sessionId = `bot_${crypto.randomUUID()}`;
  await createTemporaryHold(hotel.id, unidades, input.checkin, input.checkout, sessionId, HOLD_MIN);

  // Metadata: contrato EXACTO que lee el webhook (una entrada "unidad:huéspedes"
  // por unidad apartada). origen:"bot" marca la reserva como cerrada por Camila.
  const roomsMeta = unidades.map((u, i) => `${u}:${repartos[i]}`).join("|").slice(0, 480);
  // Mismo constructor que el motor web: si el webhook empieza a leer una clave
  // nueva, las dos puntas la reciben a la vez. Antes eran dos objetos escritos a
  // mano y una diferencia entre ellos sólo se descubría con un huésped que ya
  // había pagado y no recibía reserva.
  const md: Record<string, string> = {
    ...construirMetadataBase({
      hotelId: hotel.id,
      slug: hotel.slug,
      rooms: roomsMeta,
      checkin: input.checkin,
      checkout: input.checkout,
      nights,
      stayTotal,
      deposit,
      pending,
      anticipoPct: rules.anticipoPct,
      ratePlan: "flex",
      payMode: "online",
      adults,
      children,
      customerName: nombre,
      customerEmail: email,
      customerPhone: telefono,
      holdSession: sessionId,
      lang,
    }),
    origen: "bot",
  };

  const conOxxo = connect.oxxoEnabled && amountCents <= OXXO_MAX_CENTS;
  const pmTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = conOxxo
    ? ["card", "oxxo"]
    : ["card"];
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MIN * 60;
  const successUrl = `${origin}/h/${hotel.slug}/reservar/confirmacion?session_id={CHECKOUT_SESSION_ID}&lang=${lang}`;
  // Sin `hs=` en el cancelUrl: la liberación por navegador solo acepta holds
  // `web_`; el hold del bot simplemente expira en 45 min si el huésped no paga.
  const cancelUrl = `${origin}/h/${hotel.slug}/reservar?lang=${lang}`;
  const requestOptions = { stripeAccount: connect.accountId as string };
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: pmTypes,
        ...(conOxxo ? { payment_method_options: { oxxo: { expires_after_days: 1 } } } : {}),
        line_items: [
          {
            price_data: {
              currency: "mxn",
              unit_amount: amountCents,
              product_data: {
                name: `Reserva · ${hotel.nombre}`,
                description: `${input.checkin} a ${input.checkout} · ${nights} noche(s) · ${unidades.join(", ")}`,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: email || undefined,
        metadata: md,
        payment_intent_data: { metadata: md },
        expires_at: expiresAt,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      requestOptions,
    );
    if (!session.url) throw new Error("sesión sin url");
    return {
      ok: true,
      url: session.url,
      holdSession: sessionId,
      habitacion: room.name,
      unidades,
      noches: nights,
      total: stayTotal,
      anticipo: deposit,
      pendiente: pending,
      oxxo: conOxxo,
      expiraMin: HOLD_MIN,
    };
  } catch (e) {
    // Si Stripe falló, el hold no debe quedarse apartando el cuarto.
    await releaseHold(hotel.id, sessionId).catch((e) => console.error("[lib/agent-booking] ignorado:", e));
    console.error("crearLinkReservaAgente stripe error:", e);
    return { ok: false, error: "stripe-error" };
  }
}
