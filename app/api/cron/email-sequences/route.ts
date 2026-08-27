import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email/resend";
import { escribirMejorEsfuerzo } from "@/lib/db/result";
import { getAllBookings, logAgentActivity, type AdminBooking } from "@/lib/db/admin";
import {
  buildSurveyEmailHtml,
  buildReviewEmailHtml,
  buildReturnOfferEmailHtml,
  buildRestaurantEmailHtml,
  buildWelcomeGuideEmailHtml,
  type HotelBrand,
} from "@/lib/email-sequences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── CRON GLOBAL multi-tenant de las 5 secuencias de email ────────────────────
// Itera TODOS los hoteles; por cada uno trae sus reservas y, para cada reserva,
// evalúa qué secuencias caen en su ventana de fecha (mismas ventanas que
// mi-hotel). El DEDUP es atómico vía la tabla `email_log`
// (UNIQUE hotel_id,confirmacion,email_type): se INTENTA el INSERT con
// ignoreDuplicates ANTES de enviar; solo si esta ejecución "gana" la fila, se
// envía. Así nunca se duplica aunque el cron corra dos veces o se solapen runs.
//
// Auth: Authorization: Bearer $CRON_SECRET (401 si no coincide).

type EmailType =
  | "pre_day3"
  | "pre_checkin"
  | "post_day1"
  | "post_day7"
  | "post_day30";

// No reprocesar reservas muy antiguas (espejo de mi-hotel).
const MAX_LOOKBACK_DAYS = 45;

// Tolerancia de las ventanas post-estancia, en días. Las condiciones eran
// ABIERTAS ("checkout + N ya pasó"): al conectar un hotel con reservas
// históricas, todos sus huéspedes de las últimas 6 semanas recibían los tres
// correos post-estancia el mismo día. Con la ventana cerrada, un correo solo
// sale si HOY cae dentro de sus días; una reserva vieja ya pasó de largo y se
// queda callada.
const TOLERANCIA_DIAS = 2;

/** ¿Hoy cae en [ancla + offset, ancla + offset + TOLERANCIA]? */
function enVentana(ancla: string, offset: number, hoy: string): boolean {
  const desde = shiftDate(ancla, offset);
  const hasta = shiftDate(ancla, offset + TOLERANCIA_DIAS);
  return desde <= hoy && hoy <= hasta;
}

interface HotelRow {
  id: string;
  nombre: string | null;
  slug: string | null;
  whatsapp: string | null;
  ubicacion: string | null;
  config: Record<string, unknown> | null;
  guia: Record<string, unknown> | null;
  extras: Record<string, unknown> | null;
}

// ── HELPERS DE FECHA (zona MX, espejo del origen) ───────────────────────────
function todayMX(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateEs(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const f = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function promoExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

// ── BRANDING: fila `hoteles` → HotelBrand para las plantillas ───────────────
function brandFromHotel(h: HotelRow): HotelBrand {
  const config = h.config ?? {};
  // El hotelero edita reviewUrl/mapsUrl en su panel (extras); config.* queda
  // como respaldo legado para hoteles configurados a mano.
  const extras = h.extras ?? {};
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
    // Sin promo configurada quedan undefined a propósito: el correo de +30 días
    // NO debe inventar un descuento que el motor de reservas no reconoce.
    promoCode: str(extras.promoCode) || str(config.promo_code),
    promoDiscount: str(extras.promoDiscount) || str(config.promo_discount),
  };
}

/** Remitente del hotel: config.email_from → RESEND_FROM → default Kora. */
function fromForHotel(h: HotelRow): string {
  const fromCfg = h.config && typeof h.config.email_from === "string" ? h.config.email_from : "";
  return fromCfg || process.env.RESEND_FROM || "Kora <hola@kora-hotel.com>";
}

export async function GET(req: Request) {
  // ── Auth ──
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, motivo: "Sin BD." });
  }

  const admin = createAdminClient();
  const today = todayMX();
  const maxPastDate = shiftDate(today, -MAX_LOOKBACK_DAYS);

  // Envío gated: si no hay API key, no enviamos (pero tampoco marcamos email_log).
  const puedeEnviar = Boolean(process.env.RESEND_API_KEY);

  // ── Todos los hoteles ──
  const { data: hotelesRaw, error: hotelesErr } = await admin
    .from("hoteles")
    .select("id, nombre, slug, whatsapp, ubicacion, config, guia, extras");
  if (hotelesErr) {
    console.error("[cron/email-sequences] error leyendo hoteles:", hotelesErr.message);
    return NextResponse.json({ ok: false, error: hotelesErr.message }, { status: 500 });
  }
  const hoteles = (hotelesRaw ?? []) as HotelRow[];

  const totals = { hoteles: hoteles.length, sent: 0, skipped: 0, errors: 0 };
  const perHotel: { hotel: string; sent: number; skipped: number; errors: number }[] = [];

  for (const hotel of hoteles) {
    const brand = brandFromHotel(hotel);
    const from = fromForHotel(hotel);
    const hres = { sent: 0, skipped: 0, errors: 0 };

    let bookings: AdminBooking[] = [];
    try {
      bookings = await getAllBookings(hotel.id);
    } catch (e) {
      console.error(`[cron/email-sequences] getAllBookings(${hotel.id}) falló:`, e);
      perHotel.push({ hotel: hotel.nombre ?? hotel.id, ...hres });
      continue;
    }

    // Solo reservas con datos suficientes y recientes (espejo del origen).
    const eligible = bookings.filter(
      (b) =>
        reservaCuenta(b.estado) &&
        b.email &&
        b.email !== "N/A" &&
        b.checkin &&
        b.checkout &&
        b.checkout >= maxPastDate,
    );

    // Datos opcionales de guía (check-in/out, dirección) desde hotel.guia/config.
    const guia = (hotel.guia ?? {}) as Record<string, unknown>;
    const gstr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const checkinHora = gstr(guia.checkin);
    const checkoutHora = gstr(guia.checkout);
    const direccion = gstr(guia.direccion) || gstr((hotel.config ?? {}).direccion);

    /**
     * DEDUP + ENVÍO atómico. Intenta insertar la marca en email_log primero
     * (ignoreDuplicates por la UNIQUE). Si NO insertó fila → ya se envió antes →
     * salta. Si insertó → envía; si el envío falla, borra la marca para reintentar
     * en la siguiente corrida.
     */
    async function sendOnce(
      b: AdminBooking,
      emailType: EmailType,
      subject: string,
      html: string,
    ) {
      // 1) Reclamar el envío en email_log (dedup por UNIQUE).
      const { data: claimed, error: claimErr } = await admin
        .from("email_log")
        .upsert(
          {
            hotel_id: hotel.id,
            confirmacion: b.confirmacion,
            email_type: emailType,
            email_destino: b.email,
          },
          { onConflict: "hotel_id,confirmacion,email_type", ignoreDuplicates: true },
        )
        .select("id");

      if (claimErr) {
        // No tocar nada: registrar y seguir (no abortar el hotel).
        hres.errors++;
        totals.errors++;
        console.error(`[cron/email-sequences] email_log claim ${emailType} (${b.confirmacion}):`, claimErr.message);
        return;
      }
      // Sin fila devuelta = ya existía = ya enviado → saltar.
      if (!claimed || claimed.length === 0) {
        hres.skipped++;
        totals.skipped++;
        return;
      }
      const logId = (claimed[0] as { id: string }).id;

      // 2) Enviar (gated). Sin API key deshacemos la marca para reintentar luego.
      if (!puedeEnviar) {
        await escribirMejorEsfuerzo(
          "email_log.liberarSinApiKey",
          admin.from("email_log").delete().eq("id", logId),
        );
        hres.skipped++;
        totals.skipped++;
        return;
      }

      try {
        const res = await enviarEmail({ from, to: b.email, subject, html });
        if (!res.ok) throw new Error(res.error);
        // 3) Guardar el resend_id en la marca.
        await escribirMejorEsfuerzo(
          "email_log.resendId",
          admin.from("email_log").update({ resend_id: res.id }).eq("id", logId),
        );
        // Métrica de agentes (dashboard Insights): correo del ciclo de estancia
        // enviado. Fail-safe: si la tabla no existe, no afecta el envío.
        await logAgentActivity(
          hotel.id,
          emailType.startsWith("pre_") ? "email_preestancia" : "email_postestancia",
          `${emailType}:${b.confirmacion}`,
        );
        hres.sent++;
        totals.sent++;
      } catch (e) {
        // Envío falló: liberar la marca para reintentar en la próxima corrida.
        // Mejor-esfuerzo a propósito: si tampoco se puede borrar la marca, el
        // correo se saltará mañana, y eso queda en el log en vez de en la nada.
        await escribirMejorEsfuerzo(
          "email_log.liberarTrasFallo",
          admin.from("email_log").delete().eq("id", logId),
        );
        hres.errors++;
        totals.errors++;
        console.error(`[cron/email-sequences] envío ${emailType} → ${b.email}:`, e);
      }
    }

    for (const b of eligible) {
      const checkin = b.checkin;
      const checkout = b.checkout;
      const first = b.cliente.trim().split(" ")[0];
      // Idioma con el que reservó (columna `bookings.lang`). Sin ella, español.
      const lang: "es" | "en" = b.lang === "en" ? "en" : "es";
      const en = lang === "en";
      // Página de reseña de Kora atada al folio. Canónico kora-hotel.com para
      // que /h/[slug]/resena resuelva siempre.
      const resenaUrl = hotel.slug
        ? `https://kora-hotel.com/h/${hotel.slug}/resena?r=${b.id}&lang=${lang}`
        : undefined;

      try {
        // pre_day3: ventana [checkin-3, checkin)
        if (shiftDate(checkin, -3) <= today && today < checkin) {
          await sendOnce(
            b,
            "pre_day3",
            en
              ? `${first}, your arrival at ${brand.nombre} is near`
              : `${first}, tu llegada a ${brand.nombre} se acerca`,
            buildRestaurantEmailHtml({
              hotel: brand,
              customerName: b.cliente,
              confirmacion: b.confirmacion,
              checkin,
              checkinFormatted: en ? undefined : formatDateEs(checkin),
              lang,
            }),
          );
        }

        // pre_checkin: ventana [checkin, checkin+1]
        if (checkin <= today && today <= shiftDate(checkin, 1)) {
          await sendOnce(
            b,
            "pre_checkin",
            en
              ? `Today's the day, ${first}! — Your room is ready`
              : `¡Hoy es el día, ${first}! — Tu habitación te espera`,
            buildWelcomeGuideEmailHtml({
              hotel: brand,
              customerName: b.cliente,
              confirmacion: b.confirmacion,
              checkin,
              habitaciones: b.habitaciones,
              checkinHora,
              checkoutHora,
              direccion,
              lang,
            }),
          );
        }

        // post_day1: ventana cerrada [checkout+1, checkout+1+tolerancia]
        if (enVentana(checkout, 1, today)) {
          await sendOnce(
            b,
            "post_day1",
            en
              ? `${first}, how was your stay at ${brand.nombre}?`
              : `${first}, ¿cómo fue tu estancia en ${brand.nombre}?`,
            buildSurveyEmailHtml({
              hotel: brand,
              customerName: b.cliente,
              confirmacion: b.confirmacion,
              checkin,
              checkout,
              habitaciones: b.habitaciones,
              resenaUrl,
              lang,
            }),
          );
        }

        // post_day7: ventana cerrada [checkout+7, checkout+7+tolerancia]
        if (enVentana(checkout, 7, today)) {
          await sendOnce(
            b,
            "post_day7",
            en ? `${first}, would you leave us a review?` : `${first}, ¿nos dejas una reseña?`,
            buildReviewEmailHtml({
              hotel: brand,
              customerName: b.cliente,
              confirmacion: b.confirmacion,
              checkin,
              resenaUrl,
              lang,
            }),
          );
        }

        // post_day30: ventana cerrada [checkout+30, checkout+30+tolerancia].
        // El asunto solo promete descuento si el hotel configuró uno de verdad.
        if (enVentana(checkout, 30, today)) {
          const conPromo = Boolean(brand.promoCode);
          const asunto = conPromo
            ? en
              ? `${first}, ${brand.promoDiscount} off your next stay at ${brand.nombre}`
              : `${first}, ${brand.promoDiscount} de descuento en tu próxima estancia`
            : en
              ? `${first}, your room at ${brand.nombre} is waiting`
              : `${first}, tu habitación en ${brand.nombre} te espera`;
          await sendOnce(
            b,
            "post_day30",
            asunto,
            buildReturnOfferEmailHtml({
              hotel: brand,
              customerName: b.cliente,
              confirmacion: b.confirmacion,
              promoExpiry: conPromo ? promoExpiry() : undefined,
              lang,
            }),
          );
        }
      } catch (e) {
        // Error inesperado por reserva: contar y seguir sin abortar el hotel.
        hres.errors++;
        totals.errors++;
        console.error(`[cron/email-sequences] reserva ${b.confirmacion} falló:`, e);
      }
    }

    perHotel.push({ hotel: hotel.nombre ?? hotel.id, ...hres });
  }

  console.log(
    `[cron/email-sequences] ${today} hoteles:${totals.hoteles} ` +
      `sent:${totals.sent} skipped:${totals.skipped} errors:${totals.errors}` +
      (puedeEnviar ? "" : " (RESEND_API_KEY ausente — sin envíos)"),
  );

  return NextResponse.json({
    ok: true,
    date: today,
    enviosActivos: puedeEnviar,
    ...totals,
    perHotel,
  });
}
