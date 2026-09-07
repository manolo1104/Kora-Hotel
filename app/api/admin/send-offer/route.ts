import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { buildPersonalOfferEmailHtml } from "@/lib/email-sequences";
import type { HotelBrand } from "@/lib/email-sequences";
import { draftOfferEmail } from "@/lib/offers";
import { brandFromHotel, fromForHotel } from "@/lib/email/marca-hotel";
import { limitado } from "@/lib/api/rate-limit";
import { leerCuerpo, zEmail, zTextoCorto, zTextoLargo } from "@/lib/api/cuerpo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Enviar una oferta de regreso PERSONALIZADA a un huésped desde el CRM de
// clientes. La IA (Anthropic, vía lib/offers) redacta el cuerpo según el
// historial del huésped; se envuelve en el shell de marca del hotel y se envía
// por Resend con el remitente del hotel. Devuelve status != 200 en error para
// que el cliente distinga (antes marcaba "enviado" con cualquier 200).

// Esto MANDA UN CORREO desde el dominio de Kora a la dirección que venga en el
// cuerpo. Antes se comprobaba que llevara una arroba; ahora el correo tiene que
// serlo de verdad. Y `notas` y `suitesFavoritas` van a la IA que redacta el
// mensaje: sin topes, un texto enorme se cobra entero.
const OFERTA_SCHEMA = z.object({
  email: zEmail.refine((v) => v !== "N/A", "sin correo"),
  nombre: zTextoCorto.optional(),
  suitesFavoritas: z.array(z.string().max(200)).max(20).default([]),
  ultimaEstancia: z.string().trim().max(40).default(""),
  totalReservas: z.number().int().min(0).max(10_000).default(0),
  notas: zTextoLargo.default(""),
});

export async function POST(req: Request) {
  // 1) Tenant: identidad por sesión, hotel por cookie verificada contra members.
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "marketing:enviar");
  if (no) return no;

  // 1.5) Tope por HOTEL. Esta ruta llama a Anthropic Y manda un correo, y era la
  // única de `admin` que hacía las dos cosas sin ningún límite: un botón con el
  // clic pegado, o un empleado probando, gastaba cuota de IA y quemaba
  // reputación del dominio de correo sin que nadie se enterara. La clave es el
  // hotel, no la IP: el panel entero sale por las mismas máquinas de Vercel.
  if (await limitado("correo.oferta", ctx.hotelId, { max: 20, ventanaMs: 60 * 60_000 })) {
    return NextResponse.json(
      { ok: false, error: "Has mandado muchas ofertas seguidas. Espera un rato e intenta de nuevo." },
      { status: 429 },
    );
  }

  // 2) Dependencias de infraestructura (fallan con status != 200, no 200/ok:false).
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "La IA no está configurada (falta ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }
  if (!resendEnvReady) {
    return NextResponse.json(
      { ok: false, error: "El envío de correo no está configurado (falta RESEND_API_KEY)." },
      { status: 503 },
    );
  }

  // 3) Datos del huésped (del CRM). El email es obligatorio y válido.
  const c = await leerCuerpo(req, OFERTA_SCHEMA);
  if (!c.ok) {
    return NextResponse.json(
      { ok: false, error: "Este cliente no tiene un correo válido para enviarle la oferta." },
      { status: 400 },
    );
  }
  const { email, suitesFavoritas, ultimaEstancia, totalReservas, notas } = c.datos;
  const nombre = c.datos.nombre || "huésped";

  const hotel = ctx.hotel;
  const brand = brandFromHotel(hotel);

  // 4) La IA redacta el cuerpo personalizado (mismo helper que la prueba).
  let draft;
  try {
    draft = await draftOfferEmail(brand, {
      nombre,
      totalReservas,
      ultimaEstancia,
      suitesFavoritas,
      notas,
    });
  } catch (e) {
    console.error("[send-offer] error de IA:", e);
    return NextResponse.json(
      { ok: false, error: "La IA no pudo redactar el correo. Intenta de nuevo." },
      { status: 502 },
    );
  }

  // 5) Construir el email de marca y enviarlo con el remitente del hotel.
  const html = buildPersonalOfferEmailHtml({
    hotel: brand,
    customerName: nombre,
    paragraphs: draft.paragraphs,
  });
  // La oferta la firma el hotelero: si el huésped contesta, tiene que llegarle
  // a él y no al buzón de Kora (el `from` es el dominio de Kora salvo que el
  // hotel tenga `config.email_from`).
  const envio = await enviarEmail({
    to: email,
    subject: draft.subject,
    html,
    from: fromForHotel(hotel),
    replyTo: brand.email,
  });
  if (!envio.ok) {
    console.error("[send-offer] no salió el correo:", envio.error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el correo. Revisa la configuración de correo del hotel." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, subject: draft.subject });
}
