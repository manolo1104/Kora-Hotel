import { escribirMejorEsfuerzo } from "@/lib/db/result";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveHotel } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitado, ipDe } from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.email().max(160),
  nombre: z.string().trim().max(120).optional(),
  lang: z.enum(["es", "en"]).default("es"),
  // Snapshot de la búsqueda (fechas, carrito, extras) para restaurarla desde el
  // email de recuperación. Se guarda tal cual, con tope de tamaño.
  payload: z.record(z.string(), z.unknown()).default({}),
});

// Captura temprana del email en el checkout (paso de datos). Si el huésped
// abandona sin pagar, el cron de recuperación (Fase 4) le escribe. Best-effort:
// nunca bloquea el flujo de reserva.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) return NextResponse.json({ error: "hotel-no-encontrado" }, { status: 404 });

  // Guarda el correo del huésped para escribirle si abandona. Sin tope, es una
  // vía para meter filas —y direcciones ajenas— en la tabla de recuperación, que
  // luego DISPARA CORREOS desde el dominio del hotel.
  if (await limitado("h.intento", ipDe(req), { max: 20, ventanaMs: 10 * 60_000 })) {
    return NextResponse.json(
      { error: "Vas muy rápido. Espera un momento e inténtalo de nuevo." },
      { status: 429 },
    );
  }

  // Hotel demo: no se capturan correos de quien juega con él.
  if ((hotel.extras as { demo?: boolean } | null)?.demo === true) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "datos-invalidos" }, { status: 400 });

  const { email, nombre, lang, payload } = parsed.data;
  if (JSON.stringify(payload).length > 4000) {
    return NextResponse.json({ error: "payload-muy-grande" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    // NO se tocan `convertido` ni `recordatorio_enviado_at`. Este upsert los
    // ponía a `false`/`null` en cada captura de correo, así que un huésped que
    // YA había reservado —el webhook le pone `convertido: true`— y volvía a
    // entrar al motor a mirar fechas se marcaba otra vez como carrito
    // abandonado: al día siguiente el cron le mandaba "termina tu reserva" a
    // alguien que ya había pagado y tenía su folio. Los dos campos son de quien
    // los escribe (el webhook y el propio cron), no de esta ruta.
    await escribirMejorEsfuerzo("booking_intents.capturar", supabase.from("booking_intents").upsert(
      {
        hotel_id: hotel.id,
        email: email.toLowerCase(),
        nombre: nombre || null,
        lang,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hotel_id,email" },
    ));
  } catch (e) {
    console.error("intento error:", e);
  }
  // Siempre ok: la captura es auxiliar, no debe romper el checkout.
  return NextResponse.json({ ok: true });
}
