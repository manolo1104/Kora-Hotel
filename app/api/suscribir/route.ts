import { NextResponse } from "next/server";
import { escribir, escribirMejorEsfuerzo } from "@/lib/db/result";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email/resend";
import { emailGuia } from "@/lib/email/guia";
import { cabecerasBaja, normalizarEmail, emailValido } from "@/lib/suscriptores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Alta en la lista de correo. UN SOLO CAMPO: el correo.
//
// Es el hermano ligero de /api/leads. Aquel pide nombre + WhatsApp y le avisa a
// Manolo al instante porque quien lo llena pidió que le hablen. Éste NO avisa a
// nadie y NO entra al CRM: quien lo llena quería una guía. Confundirlos llenaba
// el CRM de gente fría y el digest diario de seguimientos que nadie iba a hacer.
//
// Defensas: honeypot (_gotcha), rate limit por IP y validación del correo.

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const ahora = Date.now();
  const previos = (hits.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  hits.set(ip, previos);
  return previos.length > MAX_POR_VENTANA;
}

const str = (v: unknown, max = 120): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

interface FilaSuscriptor {
  id: string;
  token_baja: string;
  nombre: string | null;
  baja_at: string | null;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Vas muy rápido. Espera un minuto e inténtalo de nuevo." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Honeypot: a los bots les respondemos éxito falso para que no reintenten.
  if (str(body._gotcha)) return NextResponse.json({ ok: true });

  const email = normalizarEmail(body.email);
  const nombre = str(body.nombre, 120) || null;
  const origen = str(body.origen, 80) || "web";

  if (!emailValido(email)) {
    return NextResponse.json(
      { error: "Escribe un correo válido." },
      { status: 400 },
    );
  }

  if (!adminEnvReady) {
    // Sin BD no se puede guardar NI mandar la guía con su link de baja. Decirlo
    // es mejor que fingir éxito: quien lo pidió se quedaría esperando un correo
    // que nunca va a llegar.
    console.error("[suscribir] sin BD configurada");
    return NextResponse.json(
      { error: "No pudimos registrarte. Inténtalo más tarde." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  // Alta idempotente. Volver a suscribirse REACTIVA a quien se había dado de
  // baja: es una decisión suya, tomada después. El token NO se regenera — un
  // link de baja viejo, guardado en un correo de hace meses, tiene que seguir
  // funcionando.
  // `nombre` sólo viaja si vino: casi ningún formulario lo pide, y mandarlo en
  // null borraría el que ya estaba guardado de un alta anterior que sí lo tenía.
  const alta: Record<string, unknown> = { email, origen, baja_at: null, baja_motivo: null };
  if (nombre) alta.nombre = nombre;

  const { data: fila, error } = await admin
    .from("suscriptores")
    .upsert(alta, { onConflict: "email" })
    .select("id, token_baja, nombre, baja_at")
    .single();

  if (error || !fila) {
    console.error("[suscribir] error guardando:", error?.message);
    return NextResponse.json(
      { error: "No pudimos registrarte. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  const sus = fila as FilaSuscriptor;

  // Primer toque AL INSTANTE: es la guía, que es exactamente lo que pidió.
  //
  // Se RECLAMA la fila del log antes de enviar (UNIQUE suscriptor_id,email_type),
  // así dos clics seguidos no mandan dos correos. Si el envío falla se retira la
  // marca: si se quedara puesta, el cron lo daría por enviado y esta persona se
  // quedaría sin su guía para siempre.
  //
  // CON await, no `void (async () => …)()`: en Vercel la función se apaga al
  // responder y el envío se pierde a medias (ver el comentario largo en
  // /api/leads, que documenta ese bug ya cazado).
  let enviado = false;
  try {
    const { data: claimed } = await admin
      .from("suscriptor_email_log")
      .upsert(
        { suscriptor_id: sus.id, email_type: "guia_0", email_destino: email },
        { onConflict: "suscriptor_id,email_type", ignoreDuplicates: true },
      )
      .select("id");

    if (claimed && claimed.length > 0) {
      const logId = (claimed[0] as { id: string }).id;
      const envio = await enviarEmail({
        to: email,
        ...emailGuia("guia_0", { nombre: sus.nombre, token: sus.token_baja }),
        headers: cabecerasBaja(sus.token_baja),
      });
      if (envio.ok) {
        enviado = true;
        await escribirMejorEsfuerzo(
          "suscriptor_email_log.resendId",
          admin.from("suscriptor_email_log").update({ resend_id: envio.id }).eq("id", logId),
        );
      } else {
        await escribir(
          "suscriptor_email_log.guia0.liberar",
          admin.from("suscriptor_email_log").delete().eq("id", logId),
        );
        console.error("[suscribir] la guía no salió:", envio.error);
      }
    } else {
      // Ya se le había mandado antes (volvió a suscribirse). No se reenvía.
      enviado = true;
    }
  } catch (e) {
    console.error("[suscribir] fallo mandando la guía:", e);
  }

  // `ok` aunque el correo falle: el alta SÍ quedó y el cron reintenta mañana.
  // `enviado` deja que el formulario diga la verdad ("revisa tu correo" contra
  // "te llega en un momento") en vez de prometer algo que no pasó.
  return NextResponse.json({ ok: true, enviado });
}
