import { alertar } from "@/lib/alertas";
import { leer, escribir, DbError } from "@/lib/db/result";
import { rutaSegura } from "@/lib/api/responder";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email/resend";
import { emailPagoVencido } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dunning básico (cron diario): a cada suscripción con pago vencido le manda
// hasta 3 recordatorios para actualizar la tarjeta. Stripe reintenta el cobro
// por su lado; si lo logra, invoice.paid resetea el contador. Si agota los
// reintentos, customer.subscription.deleted la cancela.

const MAX_AVISOS = 3;

/** Postgres: "esa columna no existe aquí" (y su equivalente en PostgREST). */
const COL_FALTANTE = new Set(["42703", "PGRST204"]);

interface FilaDunning {
  id: string;
  user_id: string;
  avisos_dunning: number;
  ultimo_aviso_dunning?: string | null;
}

// Una función serverless vive segundos; esto sólo evita repetir el mismo aviso
// dentro de una invocación.
let yaAvisadoSinColumna = false;

export async function GET(req: Request) {
  return rutaSegura("cron.dunning", async () => {
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, motivo: "Sin BD." });
  }

  const admin = createAdminClient();
  const consulta = (cols: string) =>
    admin
      .from("suscripciones")
      .select(cols)
      .eq("estado", "pago_vencido")
      .lt("avisos_dunning", MAX_AVISOS);

  // LA GUARDA DE "YA LE ESCRIBÍ HOY" (K-193). Sin ella, el cron sube
  // `avisos_dunning` en CADA pasada: dos invocaciones el mismo día —un `curl`
  // suelto, un redespliegue— le vaciaban los 3 avisos de golpe al cliente y le
  // llegaba la secuencia entera en unas horas. En Vercel Hobby el cron corre una
  // vez al día, así que la guarda es justo contra lo que no es el cron.
  //
  // Si la columna todavía no existe (falta correr sql/kora-plan-unico.sql), se
  // sigue trabajando SIN guarda y se dice en voz alta. Lanza si falla por
  // cualquier otro motivo: una lista vacía por error es indistinguible de "nadie
  // debe", y este es el único aviso que recibe un hotelero antes de perder acceso.
  let conGuarda = true;
  let vencidas: FilaDunning[] = [];
  const conColumna = await consulta("id, user_id, avisos_dunning, ultimo_aviso_dunning");
  if (conColumna.error && COL_FALTANTE.has(conColumna.error.code ?? "")) {
    conGuarda = false;
    if (!yaAvisadoSinColumna) {
      yaAvisadoSinColumna = true;
      console.warn(
        "[dunning] falta la columna `ultimo_aviso_dunning`: sin ella, dos pasadas " +
          "el mismo día mandan dos avisos al mismo cliente. Corre sql/kora-plan-unico.sql.",
      );
    }
    const sinColumna = await consulta("id, user_id, avisos_dunning");
    if (sinColumna.error) {
      throw new DbError("cron.dunning.vencidas", sinColumna.error.message, sinColumna.error.code);
    }
    vencidas = (sinColumna.data ?? []) as unknown as FilaDunning[];
  } else if (conColumna.error) {
    throw new DbError("cron.dunning.vencidas", conColumna.error.message, conColumna.error.code);
  } else {
    vencidas = (conColumna.data ?? []) as unknown as FilaDunning[];
  }

  // "Hoy" en la zona del negocio, nunca en UTC: entre las 18:00 y la medianoche
  // el servidor ya cree que es mañana y la guarda no guardaría nada.
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

  let enviados = 0;
  let yaPagaron = 0;
  let repetidos = 0;
  const sinCorreo: string[] = [];
  for (const s of vencidas) {
    if (conGuarda && (s.ultimo_aviso_dunning ?? "").slice(0, 10) === hoy) {
      repetidos++;
      continue;
    }

    // El correo del dueño vive en auth.users. Un fallo aquí NO puede pasar por
    // "este usuario no tiene correo": es el único aviso que recibe alguien antes
    // de perder el acceso por falta de pago.
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(s.user_id);
    if (userErr) {
      sinCorreo.push(`${s.user_id}: ${userErr.message}`);
      continue;
    }
    const email = userData?.user?.email;
    if (!email) {
      sinCorreo.push(`${s.user_id}: la cuenta no tiene correo`);
      continue;
    }

    // RELEER JUSTO ANTES DE MANDAR (K-194). La lista se leyó al empezar y los
    // correos salen en serie; si el pago entra a mitad del bucle —Stripe reintenta
    // por su lado y `invoice.paid` pone la fila en `activa`—, al cliente le llegaba
    // "no pudimos cobrarte" DESPUÉS de haber pagado. Es el peor correo posible.
    const actual = await leer<{ estado: string; avisos_dunning: number }>(
      "cron.dunning.releer",
      admin.from("suscripciones").select("estado, avisos_dunning").eq("id", s.id).maybeSingle(),
    );
    if (!actual || actual.estado !== "pago_vencido" || actual.avisos_dunning >= MAX_AVISOS) {
      yaPagaron++;
      continue;
    }

    const intento = actual.avisos_dunning + 1;
    const envio = await enviarEmail({ to: email, ...emailPagoVencido({ intento }) });
    if (envio.ok) {
      await escribir(
        "suscripciones.avisosDunning",
        admin
          .from("suscripciones")
          .update({
            avisos_dunning: intento,
            ...(conGuarda ? { ultimo_aviso_dunning: hoy } : {}),
          })
          .eq("id", s.id),
      );
      enviados++;
    }
  }

  if (sinCorreo.length) {
    await alertar(
      "avisos de pago vencido que no se pudieron enviar",
      `No se pudo resolver el correo de ${sinCorreo.length} dueño(s):\n${sinCorreo.join("\n")}`,
    );
  }

  return NextResponse.json({
    ok: true,
    pendientes: vencidas.length,
    enviados,
    // `repetidos` = ya se les escribió hoy; `yaPagaron` = pagaron entre que se
    // leyó la lista y les tocaba el correo. Los dos deben poder verse desde
    // fuera: son la prueba de que las guardas están funcionando.
    repetidos,
    yaPagaron,
    sinGuardaDeDia: !conGuarda,
    sinCorreo: sinCorreo.length,
  });
  });
}
