import { alertar } from "@/lib/alertas";
import { leer, escribir } from "@/lib/db/result";
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
  // Lanza si falla: una lista vacía por error es indistinguible de "nadie debe",
  // y este cron es el único aviso que recibe un hotelero antes de perder acceso.
  const vencidas = await leer<Array<{ id: string; user_id: string; avisos_dunning: number }>>(
    "cron.dunning.vencidas",
    admin
      .from("suscripciones")
      .select("id, user_id, avisos_dunning")
      .eq("estado", "pago_vencido")
      .lt("avisos_dunning", MAX_AVISOS),
  );

  let enviados = 0;
  const sinCorreo: string[] = [];
  for (const s of vencidas ?? []) {
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

    const intento = s.avisos_dunning + 1;
    const envio = await enviarEmail({ to: email, ...emailPagoVencido({ intento }) });
    if (envio.ok) {
      await escribir(
        "suscripciones.avisosDunning",
        admin.from("suscripciones").update({ avisos_dunning: intento }).eq("id", s.id),
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
    pendientes: vencidas?.length ?? 0,
    enviados,
    sinCorreo: sinCorreo.length,
  });
  });
}
