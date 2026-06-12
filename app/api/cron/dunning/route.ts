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
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, motivo: "Sin BD." });
  }

  const admin = createAdminClient();
  const { data: vencidas } = await admin
    .from("suscripciones")
    .select("id, user_id, avisos_dunning")
    .eq("estado", "pago_vencido")
    .lt("avisos_dunning", MAX_AVISOS);

  let enviados = 0;
  for (const s of vencidas ?? []) {
    // El correo del dueño vive en auth.users.
    const { data: userData } = await admin.auth.admin.getUserById(s.user_id);
    const email = userData?.user?.email;
    if (!email) continue;

    const intento = s.avisos_dunning + 1;
    const ok = await enviarEmail({ to: email, ...emailPagoVencido({ intento }) });
    if (ok) {
      await admin
        .from("suscripciones")
        .update({ avisos_dunning: intento })
        .eq("id", s.id);
      enviados++;
    }
  }

  return NextResponse.json({ ok: true, pendientes: vencidas?.length ?? 0, enviados });
}
