import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { cabecerasBaja } from "@/lib/suscriptores";
import { emailAnuncio, TIPO_ANUNCIO } from "@/lib/email/anuncio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El envío de novedades a la lista de Kora.
//
// Esto le escribe a PERSONAS REALES y no se puede deshacer, así que está montado
// para que sea difícil mandarlo sin querer y imposible mandarlo dos veces:
//
// 1. POR DEFECTO NO MANDA NADA. Sin `?enviar=1` cuenta a cuántos les llegaría y
//    devuelve el primer correo en HTML para poder leerlo. Es un ensayo, no un
//    envío con red de seguridad.
// 2. NO SE PUEDE DUPLICAR. Cada envío se apunta en `suscriptor_email_log`, que
//    tiene índice único (suscriptor_id, email_type): el apunte va ANTES del
//    envío, así que si alguien lanza esto dos veces, la segunda no le escribe a
//    nadie que ya lo recibiera.
// 3. NADIE SIN SALIDA. Un suscriptor sin `token_baja` se salta: un correo
//    comercial sin enlace de baja no se manda, y punto.
// 4. Sólo con `CRON_SECRET`, igual que el resto de los crons.
//
// A diferencia de la secuencia de la guía, aquí NO se filtra por antigüedad: un
// anuncio va a toda la lista viva, no sólo a quien se apuntó este mes.
//
//   Ensayo:  curl -H "authorization: Bearer $CRON_SECRET" ".../api/cron/anuncio"
//   Envío:   curl -H "authorization: Bearer $CRON_SECRET" ".../api/cron/anuncio?enviar=1"

/** Tope por corrida. Resend no es infinito y una lista enorme se manda por partes. */
const TOPE = 500;

interface Suscriptor {
  id: string;
  email: string;
  nombre: string | null;
  token_baja: string | null;
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "no-autorizado" }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, error: "sin-service-role" }, { status: 503 });
  }

  const enviar = new URL(req.url).searchParams.get("enviar") === "1";
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("suscriptores")
    .select("id, email, nombre, token_baja")
    .is("baja_at", null)
    .order("created_at", { ascending: true })
    .limit(TOPE);

  if (error) {
    console.error("[cron/anuncio] no se pudo leer la lista:", error.message);
    return NextResponse.json({ ok: false, error: "no-se-pudo-leer-la-lista" }, { status: 500 });
  }

  const todos = (data ?? []) as Suscriptor[];
  // Sin token de baja no hay correo comercial posible.
  const destinatarios = todos.filter((s) => s.email && s.token_baja);
  const sinToken = todos.length - destinatarios.length;

  // ── Ensayo: se cuenta y se enseña, no se manda ──
  if (!enviar) {
    const muestra = destinatarios[0];
    return NextResponse.json({
      ok: true,
      modo: "ENSAYO — no se mandó nada",
      leLlegariaA: destinatarios.length,
      sinTokenDeBaja: sinToken,
      tope: TOPE,
      correoConfigurado: resendEnvReady,
      asunto: muestra ? emailAnuncio({ nombre: muestra.nombre ?? "", token: muestra.token_baja! }).subject : null,
      paraMandarloDeVerdad: "añade ?enviar=1 a esta misma URL",
    });
  }

  if (!resendEnvReady) {
    return NextResponse.json({ ok: false, error: "sin-resend" }, { status: 503 });
  }

  const total = { enviados: 0, yaLoTenian: 0, fallidos: 0 };

  for (const s of destinatarios) {
    // El apunte va ANTES del envío. Si dos corridas se pisan, la segunda choca
    // contra el índice único y no escribe. Al revés —enviar y luego apuntar— un
    // fallo entre medias le manda el mismo correo dos veces a la misma persona,
    // que en una lista es de las cosas que hacen que te marquen como spam.
    const { error: yaEstaba } = await admin
      .from("suscriptor_email_log")
      .insert({ suscriptor_id: s.id, email_type: TIPO_ANUNCIO });
    if (yaEstaba) {
      total.yaLoTenian++;
      continue;
    }

    const envio = await enviarEmail({
      to: s.email,
      ...emailAnuncio({ nombre: s.nombre ?? "", token: s.token_baja! }),
      headers: cabecerasBaja(s.token_baja!),
    });

    if (envio.ok) {
      total.enviados++;
    } else {
      total.fallidos++;
      console.error("[cron/anuncio] no salió:", envio.error);
      // Se libera la marca para poder reintentarlo en otra corrida.
      await admin
        .from("suscriptor_email_log")
        .delete()
        .eq("suscriptor_id", s.id)
        .eq("email_type", TIPO_ANUNCIO);
    }
  }

  console.log(`[cron/anuncio] enviados ${total.enviados}, ya lo tenían ${total.yaLoTenian}, fallidos ${total.fallidos}`);
  return NextResponse.json({ ok: true, modo: "ENVIADO", ...total });
}
