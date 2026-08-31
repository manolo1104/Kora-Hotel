import { leer } from "@/lib/db/result";
import { rutaSegura } from "@/lib/api/responder";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { pruebaDelHotel, tienePlanActivo, bloqueoDelHotel, type Suscripcion } from "@/lib/suscripcion";
import { escribirMejorEsfuerzo } from "@/lib/db/result";
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
// El umbral ya avisado se PERSISTE en `extras.prueba.avisos`. "Corre una vez al
// día" describe el cron de Vercel, no lo que le puede pasar a la ruta: un `curl`
// suelto, un redespliegue o un reintento la ejecutan otra vez el mismo día, y sin
// marca el hotelero recibía el mismo "te quedan 3 días" dos veces. No hace falta
// tabla nueva: la marca vive en el propio hotel.

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
    // Una cuenta que Kora bloqueó a mano no recibe upsell: "activa tu plan" a
    // quien tenemos apagado a propósito es, según por qué se bloqueó, desde
    // ridículo hasta ofensivo.
    if (bloqueoDelHotel(hotel.extras)) continue;
    const prueba = pruebaDelHotel(hotel, inicios.get(hotel.owner_id) ?? null);
    if (!prueba) continue; // demo

    const esRecordatorio = !prueba.vencida && DIAS_RECORDATORIO.has(prueba.diasRestantes);
    const msVencida = Date.now() - prueba.fin.getTime();
    const recienVencida = prueba.vencida && msVencida < 86_400_000;
    if (!esRecordatorio && !recienVencida) continue;

    // Marca de "este aviso ya salió". Los recordatorios se marcan por su umbral
    // ("10", "3", "1") y el de vencida por su nombre, para que los cuatro sean
    // independientes entre sí.
    const marca = esRecordatorio ? String(prueba.diasRestantes) : "vencida";
    const extrasPrueba = ((hotel.extras ?? {}).prueba ?? {}) as { avisos?: unknown };
    const avisos = Array.isArray(extrasPrueba.avisos) ? extrasPrueba.avisos.map(String) : [];
    if (avisos.includes(marca)) continue;

    const to = await resolveHotelAvisoEmail(hotel);
    if (!to) continue;

    const enviado = esRecordatorio
      ? await sendRecordatorioPrueba(to, {
          hotelNombre: hotel.nombre,
          diasRestantes: prueba.diasRestantes,
        })
      : await sendPruebaPausada(to, hotel.nombre);

    if (!enviado.ok) continue; // sin marca: mañana se reintenta

    if (esRecordatorio) recordatorios++;
    else pausados++;

    // Se relee `extras` antes de escribir: entre la lectura del principio del
    // cron y este punto el hotelero pudo haber guardado su editor, y escribir el
    // objeto viejo le borraría lo que acaba de cambiar.
    const fresco = await leer<{ extras: Record<string, unknown> | null }>(
      "cron.prueba.extrasFrescos",
      admin.from("hoteles").select("extras").eq("id", hotel.id).maybeSingle(),
    );
    const base = (fresco?.extras ?? hotel.extras ?? {}) as Record<string, unknown>;
    const pruebaBase = (base.prueba ?? {}) as Record<string, unknown>;
    const avisosBase = Array.isArray(pruebaBase.avisos) ? pruebaBase.avisos.map(String) : [];
    await escribirMejorEsfuerzo(
      "hoteles.pruebaAvisos",
      admin
        .from("hoteles")
        .update({
          extras: { ...base, prueba: { ...pruebaBase, avisos: [...new Set([...avisosBase, marca])] } },
        })
        .eq("id", hotel.id),
    );
  }

  return NextResponse.json({ ok: true, recordatorios, pausados });
  });
}
