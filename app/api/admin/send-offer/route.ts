import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { buildPersonalOfferEmailHtml } from "@/lib/email-sequences";
import type { HotelBrand } from "@/lib/email-sequences";
import { draftOfferEmail } from "@/lib/offers";
import type { HotelRow } from "@/lib/tenant";

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
    promoCode: str(config.promo_code),
    promoDiscount: str(config.promo_discount),
  };
}

/** Remitente del hotel: config.email_from → RESEND_FROM → default Kora. */
function fromForHotel(h: HotelRow): string {
  const config = (h.config ?? {}) as Record<string, unknown>;
  const fromCfg = typeof config.email_from === "string" ? config.email_from : "";
  return fromCfg || process.env.RESEND_FROM || "Kora <hola@kora-hotel.com>";
}

export async function POST(req: Request) {
  // 1) Tenant: identidad por sesión, hotel por cookie verificada contra members.
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });

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
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Petición inválida." }, { status: 400 });
  }
  const email = String(payload.email ?? "").trim();
  const nombre = String(payload.nombre ?? "").trim() || "huésped";
  if (!email || email === "N/A" || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, error: "Este cliente no tiene un correo válido para enviarle la oferta." },
      { status: 400 },
    );
  }
  const suitesFavoritas = Array.isArray(payload.suitesFavoritas)
    ? (payload.suitesFavoritas as unknown[]).map(String).filter(Boolean)
    : [];
  const ultimaEstancia = String(payload.ultimaEstancia ?? "").trim();
  const totalReservas = Number(payload.totalReservas) || 0;
  const notas = String(payload.notas ?? "").trim();

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
  const sent = await enviarEmail({ to: email, subject: draft.subject, html, from: fromForHotel(hotel) });
  if (!sent) {
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el correo. Revisa la configuración de correo del hotel." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, subject: draft.subject });
}
