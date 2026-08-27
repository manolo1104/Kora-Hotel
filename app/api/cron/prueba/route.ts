import { leer } from "@/lib/db/result";
import { rutaSegura } from "@/lib/api/responder";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { pruebaDelHotel, tienePlanActivo, type Suscripcion } from "@/lib/suscripcion";
import { iniciosPruebaDeDuenos } from "@/lib/db/prueba-dueno";
import { resolveHotelAvisoEmail } from "@/lib/email/reserva";
import { sendRecordatorioPrueba, sendPruebaPausada } from "@/lib/email/prueba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── CRON de la prueba de 30 días (corre 1 vez al día, ver vercel.json) ───────
// Recorre los hoteles cuyo dueño NO tiene plan activo y, según los días que le
// queden a su prueba (derivada de created_at, ver lib/suscripcion):
//   - día 10 / 3 / 1 restantes → recordatorio con CTA de activar el plan
//   - recién vencida (primeras 24 h) → aviso de motor pausado
// Como corre una vez al día, cada umbral dispara exactamente un correo — no
// hace falta tabla de deduplicación.

const DIAS_RECORDATORIO = new Set([10, 3, 1]);

export async function GET(req: Request) {
  return rutaSegura("cron.prueba", async () => {
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, motivo: "Sin BD." });
  }

  const admin = createAdminClient();

  // Dueños con plan (o gracia) vigente: sus hoteles no entran al ciclo.
  //
  // Las DOS consultas lanzan si fallan, y la ruta aborta ANTES de mandar un solo
  // correo. Antes se leía `?? []`: con la lista de suscripciones vacía por un
  // error, `conPlan` quedaba vacío y este cron le escribía a TODOS los clientes
  // de pago diciéndoles que su motor está pausado. Un cron que decide a quién
  // escribirle según una lista no puede operar sobre una lista que falló.
  const suscs = await leer<Suscripcion[]>(
    "cron.prueba.suscripciones",
    admin.from("suscripciones").select("*"),
  );
  const conPlan = new Set(
    ((suscs ?? []) as Suscripcion[]).filter((s) => tienePlanActivo(s)).map((s) => s.user_id),
  );

  const hoteles = await leer<Array<Record<string, unknown>>>(
    "cron.prueba.hoteles",
    admin.from("hoteles").select("id, owner_id, nombre, extras, config, created_at, publicado"),
  );

  // Los anclajes de la prueba, de una sola consulta para todos los dueños: sin
  // ellos este cron le mandaría "te quedan 10 días" a quien borró y recreó su
  // hotel, contradiciendo lo que el panel y el motor ya le dicen.
  const inicios = await iniciosPruebaDeDuenos(
    ((hoteles ?? []) as Array<{ owner_id?: string }>).map((h) => h.owner_id ?? ""),
  );

  let recordatorios = 0;
  let pausados = 0;
  for (const hotel of (hoteles ?? []) as Array<{
    id: string;
    owner_id: string;
    nombre: string;
    extras: Record<string, unknown> | null;
    config: Record<string, unknown> | null;
    created_at: string | null;
    publicado: boolean;
  }>) {
    if (conPlan.has(hotel.owner_id)) continue;
    const prueba = pruebaDelHotel(hotel, inicios.get(hotel.owner_id) ?? null);
    if (!prueba) continue; // demo

    const esRecordatorio = !prueba.vencida && DIAS_RECORDATORIO.has(prueba.diasRestantes);
    const msVencida = Date.now() - prueba.fin.getTime();
    const recienVencida = prueba.vencida && msVencida < 86_400_000;
    if (!esRecordatorio && !recienVencida) continue;

    const to = await resolveHotelAvisoEmail(hotel);
    if (!to) continue;

    if (esRecordatorio) {
      const ok = await sendRecordatorioPrueba(to, {
        hotelNombre: hotel.nombre,
        diasRestantes: prueba.diasRestantes,
      });
      if (ok.ok) recordatorios++;
    } else {
      const ok = await sendPruebaPausada(to, hotel.nombre);
      if (ok.ok) pausados++;
    }
  }

  return NextResponse.json({ ok: true, recordatorios, pausados });
  });
}
