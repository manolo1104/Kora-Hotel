import { NextResponse } from "next/server";
import { z } from "zod";
import { negar } from "@/lib/panel/permisos";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { limitado } from "@/lib/api/rate-limit";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { leerSaldo, consumoDelMes, SIN_DATO } from "@/lib/db/saldo";
import { paquetePorMxn, PAQUETES, diasQueAlcanzan, UMBRAL_AVISO_BAJO, recargaActiva, bloqueoActivo } from "@/lib/saldo/paquetes";

export const dynamic = "force-dynamic";

// El saldo del bot de WhatsApp: consultarlo y recargarlo.
//
// ── DOS PERMISOS DISTINTOS, A PROPÓSITO ──────────────────────────────────────
//
// `saldo:ver` es de mando (dueño y encargada): cuando Camila se calla, la
// primera que se entera es quien recibe los WhatsApps, y tiene que poder saber
// por qué sin llamar al dueño. `saldo:recargar` es sólo del dueño, porque es
// gastar dinero del hotel.
//
// ── EL IMPORTE NO VIENE DEL NAVEGADOR ────────────────────────────────────────
//
// El cliente manda qué PAQUETE quiere, y el precio se busca en
// `lib/saldo/paquetes.ts`. Nunca se cobra una cifra que llegue en el cuerpo: eso
// es lo que impide comprar 3.000 mensajes por un peso editando el inspector.
//
// ── LA CUENTA ES LA DE KORA, NO LA DEL HOTEL ─────────────────────────────────
//
// Sin `{ stripeAccount }`. El saldo se le compra a Kora, igual que la
// mensualidad. `stripeAccount` es SÓLO para las reservas del hotel
// (`app/api/h/[slug]/checkout/route.ts`), que son dinero del hotel y por eso van
// a su cuenta conectada. Confundir las dos cosas metería el pago del saldo en la
// cuenta del hotelero, que es exactamente al revés de lo que se quiere.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const ESQUEMA = z.object({
  /** Importe en pesos. Tiene que ser uno de `PAQUETES`. */
  mxn: z.number().int().positive(),
});

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "saldo:ver");
  if (no) return no;

  const [saldo, consumo] = await Promise.all([leerSaldo(ctx.hotelId), consumoDelMes(ctx.hotelId)]);

  return NextResponse.json({
    ok: true,
    // `null` = no hay dato (no se pudo leer, o este hotel no está dado de alta
    // en el prepago). El panel lo distingue de "cero", que sí es sin saldo.
    mensajes: saldo.conocido && saldo.mensajes !== SIN_DATO ? saldo.mensajes : null,
    consumo30d: consumo.mensajes,
    diasRestantes:
      saldo.conocido && saldo.mensajes !== SIN_DATO ? diasQueAlcanzan(saldo.mensajes, consumo.porDia) : null,
    umbralBajo: UMBRAL_AVISO_BAJO,
    paquetes: PAQUETES,
    // Para que el panel sepa si pintar el botón de recargar o sólo la cifra.
    // Son DOS cosas distintas: `recargaAbierta` es si la función existe ya para
    // cualquiera, y `puedeRecargar` es si a ESTA persona le toca (sólo el dueño).
    recargaAbierta: recargaActiva(),
    // Con el bloqueo apagado el saldo baja pero Camila NO se calla, y el panel
    // tiene que contar eso y no otra cosa.
    bloqueoActivo: bloqueoActivo(),
    puedeRecargar: ctx.permisos.has("saldo:recargar"),
  });
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "saldo:recargar");
  if (no) return no;

  // La puerta de verdad está AQUÍ, no en el botón. Esconder el botón no impide
  // que alguien mande el POST a mano, y mientras el prepago esté anunciado como
  // «próximamente» no puede cobrarse un peso a nadie.
  if (!recargaActiva()) {
    return NextResponse.json(
      { ok: false, error: "Las recargas todavía no están abiertas." },
      { status: 503 },
    );
  }

  if (!stripeEnvReady) {
    return NextResponse.json({ ok: false, error: "Los pagos no están configurados." }, { status: 503 });
  }

  // Tope flojo: son clics en un botón de pago, no una API. Lo que ataja es un
  // botón con el clic pegado abriendo veinte checkouts.
  if (await limitado("saldo.recarga", ctx.hotelId, { max: 20, ventanaMs: 10 * 60_000 })) {
    return NextResponse.json({ ok: false, error: "Demasiados intentos, espera un momento." }, { status: 429 });
  }

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) return NextResponse.json({ ok: false, error: "Falta el importe." }, { status: 400 });

  const paquete = paquetePorMxn(c.datos.mxn);
  if (!paquete) {
    return NextResponse.json({ ok: false, error: "Ese importe no existe." }, { status: 400 });
  }

  const volver = `${SITE}/panel/${encodeURIComponent(ctx.hotel.slug)}/camila`;

  try {
    const sesion = await getStripe().checkout.sessions.create({
      mode: "payment",
      // Un pago suelto, no una suscripción: el precio se arma aquí y no vive en
      // el catálogo de Stripe, igual que hacen las reservas.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: paquete.mxn * 100,
            product_data: {
              name: `${paquete.mensajes.toLocaleString("es-MX")} mensajes de WhatsApp`,
              description: `Saldo para el bot de ${ctx.hotel.nombre ?? ctx.hotel.slug}`,
            },
          },
        },
      ],
      // ESTO es lo que el webhook lee para saber a quién acreditar. `kora:"saldo"`
      // lo distingue de la suscripción, que llega por el mismo endpoint.
      metadata: {
        kora: "saldo",
        hotel_id: ctx.hotelId,
        mensajes: String(paquete.mensajes),
      },
      locale: "es",
      success_url: `${volver}?recarga=ok`,
      cancel_url: `${volver}?recarga=cancelada`,
    });

    if (!sesion.url) {
      return NextResponse.json({ ok: false, error: "Stripe no devolvió el enlace." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, url: sesion.url });
  } catch (e) {
    console.error("[saldo] no se pudo abrir el checkout:", e);
    return NextResponse.json({ ok: false, error: "No se pudo abrir el pago." }, { status: 502 });
  }
}
