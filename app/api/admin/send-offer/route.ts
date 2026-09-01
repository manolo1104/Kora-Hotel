import { negar } from "@/lib/panel/permisos";
import { promosDe } from "@/lib/booking/rooms";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { buildPersonalOfferEmailHtml } from "@/lib/email-sequences";
import type { HotelBrand } from "@/lib/email-sequences";
import { draftOfferEmail } from "@/lib/offers";
import type { HotelRow } from "@/lib/tenant";
import { leerCuerpo, zEmail, zTextoCorto, zTextoLargo } from "@/lib/api/cuerpo";
import { z } from "zod";
import { EMAIL_FROM } from "@/lib/contacto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Enviar una oferta de regreso PERSONALIZADA a un huésped desde el CRM de
// clientes. La IA (Anthropic, vía lib/offers) redacta el cuerpo según el
// historial del huésped; se envuelve en el shell de marca del hotel y se envía
// por Resend con el remitente del hotel. Devuelve status != 200 en error para
// que el cliente distinga (antes marcaba "enviado" con cualquier 200).

// Fila `hoteles` → HotelBrand (espejo de brandFromHotel del cron email-sequences).
function brandFromHotel(h: HotelRow): HotelBrand {
  const config = (h.config ?? {}) as Record<string, unknown>;
  // reviewUrl/mapsUrl: primero lo editable del panel (extras); config.* legado.
  const extras = (h.extras ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    nombre: h.nombre || "el hotel",
    baseUrl: str(config.base_url) || (h.slug ? `https://kora-hotel.com/h/${h.slug}` : undefined),
    ubicacion: h.ubicacion || str(config.ubicacion),
    telefono: str(config.telefono) || (h.whatsapp ?? undefined),
    whatsapp: (h.whatsapp ?? undefined) || str(config.whatsapp),
    email: str(config.email_from) || str(config.email),
    reviewUrl: str(extras.reviewUrl) || str(config.review_url),
    mapsUrl: str(extras.mapsUrl) || str(config.maps_url),
    // Misma fuente que el motor y que el correo de +30 días: si el hotelero no
    // encendió su promo en el panel, esta oferta no reparte un código muerto.
    ...promoParaCorreo(h),
  };
}

function promoParaCorreo(h: HotelRow): { promoCode?: string; promoDiscount?: string } {
  const promo = promosDe(h as Parameters<typeof promosDe>[0])[0];
  if (!promo) return {};
  return {
    promoCode: promo.code,
    promoDiscount:
      promo.tipo === "porcentaje"
        ? `${promo.valor}%`
        : `$${Math.round(promo.valor).toLocaleString("es-MX")} MXN`,
  };
}

/** Remitente del hotel: config.email_from → RESEND_FROM → default Kora. */
function fromForHotel(h: HotelRow): string {
  const config = (h.config ?? {}) as Record<string, unknown>;
  const fromCfg = typeof config.email_from === "string" ? config.email_from : "";
  return fromCfg || process.env.RESEND_FROM || EMAIL_FROM;
}

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
