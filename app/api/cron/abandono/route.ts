import { leer } from "@/lib/db/result";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { sendRecordatorioAbandono } from "@/lib/email/reserva";
import { bookingBrandFromHotel } from "@/lib/email/booking-branded";
import { hotelRooms, calcCartSubtotal, calcNights, nightOpts, type CartItem } from "@/lib/booking";
import type { HotelRow as HotelRowFull } from "@/lib/tenant";
import type { MiniExtras } from "@/lib/mini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── CRON de recuperación de abandono (corre 1 vez al día — límite del plan
// Hobby de Vercel; ver vercel.json) ──────────────────────────────────────────
// Lee booking_intents (email capturado en el paso de datos del motor) que NO
// convirtieron y les manda UN recordatorio con link para retomar la búsqueda.
//
// Ventana: intents tocados entre 2 h y 48 h atrás. El piso de 2 h da tiempo a
// terminar la reserva (el webhook marca `convertido`); el techo de 48 h evita
// escribir sobre búsquedas frías (y bombardear el backlog al primer deploy).
//
// DEDUP atómico sin tabla extra: `recordatorio_enviado_at` se marca con un
// UPDATE ... IS NULL antes de enviar (solo una corrida "gana" la fila); si el
// envío falla, se libera la marca para reintentar en la siguiente corrida.
//
// Auth: Authorization: Bearer $CRON_SECRET (401 si no coincide).

interface IntentRow {
  id: string;
  hotel_id: string;
  email: string;
  nombre: string | null;
  lang: string | null;
  payload: Record<string, unknown> | null;
}

interface HotelRow {
  id: string;
  nombre: string;
  slug: string;
  publicado: boolean;
  extras: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  habitaciones: unknown[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayMX(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, motivo: "Sin BD." });
  }
  // Sin API key no se envía NI se marca nada: los intents quedan para cuando
  // el envío esté configurado (mismo criterio que email-sequences).
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, motivo: "Sin RESEND_API_KEY — sin envíos." });
  }

  const admin = createAdminClient();
  const ahora = Date.now();
  const desde = new Date(ahora - 48 * 3600_000).toISOString();
  const hasta = new Date(ahora - 2 * 3600_000).toISOString();

  const { data: intentsRaw, error: intentsErr } = await admin
    .from("booking_intents")
    .select("id, hotel_id, email, nombre, lang, payload")
    .eq("convertido", false)
    .is("recordatorio_enviado_at", null)
    .gte("updated_at", desde)
    .lte("updated_at", hasta)
    .order("updated_at", { ascending: true })
    .limit(200);
  if (intentsErr) {
    // Tabla aún no creada (SQL fase 2 sin aplicar) u otro error: reportar sin tronar.
    console.error("[cron/abandono] error leyendo intents:", intentsErr.message);
    return NextResponse.json({ ok: false, error: intentsErr.message }, { status: 500 });
  }
  const intents = (intentsRaw ?? []) as IntentRow[];
  if (intents.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, errors: 0 });
  }

  // Hoteles de los intents (una sola consulta).
  const hotelIds = [...new Set(intents.map((i) => i.hotel_id))];
  // Lanza si falla, y aborta ANTES de reclamar ninguna fila. Antes se leía
  // `?? []`: con la consulta rota el cron seguía, no encontraba el hotel de
  // ningún intent, y los marcaba como procesados sin enviar nada — quemando los
  // 200 recordatorios de abandono del día. (La consulta de intents de arriba ya
  // estaba bien hecha: este es el mismo patrón, no uno nuevo.)
  const hotelesRaw = await leer<HotelRow[]>(
    "cron.abandono.hoteles",
    admin
      .from("hoteles")
      .select("id, nombre, slug, publicado, extras, config, habitaciones")
      .in("id", hotelIds),
  );
  const hoteles = new Map(((hotelesRaw ?? []) as HotelRow[]).map((h) => [h.id, h]));

  const hoy = todayMX();
  const totals = { sent: 0, skipped: 0, errors: 0 };

  for (const intent of intents) {
    const hotel = hoteles.get(intent.hotel_id);
    const extras = (hotel?.extras ?? {}) as MiniExtras;

    // El hotel puede apagar la recuperación en Panel → Avanzado.
    const activo = hotel?.publicado && extras.notificaciones?.abandono !== false;

    const p = intent.payload ?? {};
    const checkin = typeof p.checkin === "string" && DATE_RE.test(p.checkin) ? p.checkin : null;
    const checkout = typeof p.checkout === "string" && DATE_RE.test(p.checkout) ? p.checkout : null;
    // Búsqueda ya irrecuperable (la llegada pasó): no vale la pena escribir.
    const vigente = checkin !== null && checkout !== null && checkin >= hoy;

    // Reclamar la fila ANTES de decidir/enviar. También los saltados se marcan:
    // así salen del índice de pendientes y no se reevalúan cada hora.
    const { data: claimed, error: claimErr } = await admin
      .from("booking_intents")
      .update({ recordatorio_enviado_at: new Date().toISOString() })
      .eq("id", intent.id)
      .is("recordatorio_enviado_at", null)
      .select("id");
    if (claimErr) {
      totals.errors++;
      console.error(`[cron/abandono] claim ${intent.id}:`, claimErr.message);
      continue;
    }
    if (!claimed || claimed.length === 0) {
      totals.skipped++; // otra corrida la ganó
      continue;
    }

    if (!hotel || !activo || !vigente) {
      totals.skipped++;
      continue;
    }

    // Link que retoma la búsqueda (el motor lee estos params y los prefija).
    const cfgBase = typeof hotel.config?.base_url === "string" ? hotel.config.base_url.trim() : "";
    const base = (cfgBase || `https://kora-hotel.com/h/${hotel.slug}`).replace(/\/$/, "");
    const lang = intent.lang === "en" ? "en" : "es";
    const qs = new URLSearchParams({ checkin, checkout, lang });
    const adults = Number(p.adults);
    const children = Number(p.children);
    if (Number.isInteger(adults) && adults > 0) qs.set("adults", String(adults));
    if (Number.isInteger(children) && children >= 0) qs.set("children", String(children));

    const fromCfg =
      typeof hotel.config?.email_from === "string" ? hotel.config.email_from.trim() : "";

    // Resolver el carrito guardado → cuarto(s) + total, para el recordatorio
    // branded (best-effort: si algo falla, el correo sale sin esos detalles).
    let suites: string[] | undefined;
    let noches: number | undefined;
    let total: number | undefined;
    try {
      const cart = Array.isArray(p.cart) ? (p.cart as CartItem[]) : [];
      if (cart.length) {
        const rooms = hotelRooms(hotel as unknown as HotelRowFull);
        const nombres = cart
          .map((c) => rooms.find((r) => String(r.id) === String(c.roomId))?.name)
          .filter((n): n is string => Boolean(n));
        if (nombres.length) suites = nombres;
        noches = calcNights(checkin, checkout);
        total = calcCartSubtotal(rooms, cart, checkin, checkout, nightOpts(hotel as unknown as HotelRowFull));
      }
    } catch (e) {
      console.error("[cron/abandono] no se pudo resolver el carrito:", (e as Error)?.message);
    }
    const huespedes =
      ((Number.isInteger(adults) && adults > 0 ? adults : 0) +
        (Number.isInteger(children) && children >= 0 ? children : 0)) ||
      undefined;

    const enviado = await sendRecordatorioAbandono(
      intent.email,
      {
        hotelNombre: hotel.nombre,
        nombre: intent.nombre,
        checkin,
        checkout,
        reanudarUrl: `${base}/reservar?${qs.toString()}`,
        lang,
        brandColor: extras.diseno?.color,
        // Correo PREMIUM con marca del hotel + cuarto/total del carrito.
        brand: bookingBrandFromHotel(hotel),
        suites,
        huespedes,
        noches,
        total,
      },
      fromCfg || null,
    );

    if (enviado.ok) {
      totals.sent++;
    } else {
      // Liberar la marca para reintentar en la próxima corrida.
      await admin
        .from("booking_intents")
        .update({ recordatorio_enviado_at: null })
        .eq("id", intent.id);
      totals.errors++;
    }
  }

  console.log(
    `[cron/abandono] intents:${intents.length} sent:${totals.sent} skipped:${totals.skipped} errors:${totals.errors}`,
  );
  return NextResponse.json({ ok: true, intents: intents.length, ...totals });
}
