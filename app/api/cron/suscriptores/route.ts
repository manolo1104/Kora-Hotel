import { NextResponse } from "next/server";
import { escribirMejorEsfuerzo } from "@/lib/db/result";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { emailGuia } from "@/lib/email/guia";
import {
  TOQUES_CRON,
  TOLERANCIA_DIAS,
  MAX_ANTIGUEDAD_DIAS,
  cabecerasBaja,
} from "@/lib/suscriptores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── CRON de la lista de correo (1 vez al día, ver vercel.json) ───────────────
// Manda los toques 2, 5, 9 y 14 de la secuencia de la guía. El 0 sale al
// instante desde /api/suscribir. Después del 14 la secuencia se apaga sola: no
// hay newsletter recurrente que mantener.
//
// DEDUP ATÓMICO, igual que /api/cron/leads: se RECLAMA la fila en
// `suscriptor_email_log` (UNIQUE suscriptor_id,email_type) ANTES de enviar. Si
// el envío falla se libera para reintentar mañana. Sin eso, dos ejecuciones que
// se traslapen mandan el correo dos veces.
//
// Auth: Authorization: Bearer $CRON_SECRET.

interface SusRow {
  id: string;
  email: string;
  nombre: string | null;
  token_baja: string;
  created_at: string;
}

/** Días completos entre `iso` y ahora. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) return NextResponse.json({ ok: false, motivo: "Sin BD." });
  if (!resendEnvReady) {
    // Sin llave no se envía NI se marca: los toques quedan pendientes para
    // cuando el correo esté configurado, en vez de darse por enviados.
    return NextResponse.json({ ok: false, motivo: "Sin RESEND_API_KEY — sin envíos." });
  }

  const admin = createAdminClient();
  const desde = new Date(Date.now() - MAX_ANTIGUEDAD_DIAS * 86_400_000).toISOString();

  const { data: susRaw, error } = await admin
    .from("suscriptores")
    .select("id, email, nombre, token_baja, created_at")
    .is("baja_at", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("[cron/suscriptores] error leyendo la lista:", error.message);
    return NextResponse.json(
      { ok: false, error: "No se pudo completar la operación. Intenta de nuevo." },
      { status: 500 },
    );
  }

  const suscriptores = (susRaw ?? []) as SusRow[];

  // ── El filtro que evita el bombardeo doble ────────────────────────────────
  // Quien ya es lead activo del CRM está recibiendo la secuencia de venta
  // (día 0, 3 y 7 desde /api/cron/leads). Si además le corre ésta, recibe ocho
  // correos en dos semanas y se da de baja — o peor, marca spam. Manda la de
  // leads: esa persona ya dio su WhatsApp y pidió que le hablen.
  //
  // Se salta el toque, no se le da de baja: cuando su lead se cierre
  // (ganado/perdido), deja de estar en esta lista de exclusión.
  const enVenta = new Set<string>();
  const { data: leads, error: errLeads } = await admin
    .from("crm_leads")
    .select("email")
    .not("email", "is", null)
    .not("etapa", "in", '("ganado","perdido")')
    .gte("created_at", desde);

  if (errLeads) {
    // Sin la lista de exclusión NO se manda nada: mandar de más es el error
    // caro. Se reintenta mañana.
    console.error("[cron/suscriptores] no se pudo leer el CRM:", errLeads.message);
    return NextResponse.json(
      { ok: false, error: "No se pudo completar la operación. Intenta de nuevo." },
      { status: 500 },
    );
  }
  for (const l of (leads ?? []) as { email: string | null }[]) {
    if (l.email) enVenta.add(l.email.toLowerCase());
  }

  const totals = {
    revisados: suscriptores.length,
    enviados: 0,
    saltados: 0,
    enVenta: 0,
    errores: 0,
  };

  for (const sus of suscriptores) {
    if (enVenta.has(sus.email.toLowerCase())) {
      totals.enVenta++;
      continue;
    }

    const edad = diasDesde(sus.created_at);

    for (const toque of TOQUES_CRON) {
      if (edad < toque.dia || edad > toque.dia + TOLERANCIA_DIAS) continue;

      // 1) Reclamar el envío.
      const { data: claimed, error: claimErr } = await admin
        .from("suscriptor_email_log")
        .upsert(
          { suscriptor_id: sus.id, email_type: toque.tipo, email_destino: sus.email },
          { onConflict: "suscriptor_id,email_type", ignoreDuplicates: true },
        )
        .select("id");

      if (claimErr) {
        totals.errores++;
        console.error(`[cron/suscriptores] claim ${toque.tipo} (${sus.id}):`, claimErr.message);
        continue;
      }
      if (!claimed || claimed.length === 0) {
        totals.saltados++; // ya se le había mandado
        continue;
      }
      const logId = (claimed[0] as { id: string }).id;

      // 2) Enviar. Si falla, liberar la marca para reintentar mañana.
      const envio = await enviarEmail({
        to: sus.email,
        ...emailGuia(toque.tipo, { nombre: sus.nombre, token: sus.token_baja }),
        headers: cabecerasBaja(sus.token_baja),
      });

      if (envio.ok) {
        totals.enviados++;
        await escribirMejorEsfuerzo(
          "suscriptor_email_log.resendId",
          admin.from("suscriptor_email_log").update({ resend_id: envio.id }).eq("id", logId),
        );
      } else {
        await escribirMejorEsfuerzo(
          "suscriptor_email_log.liberar",
          admin.from("suscriptor_email_log").delete().eq("id", logId),
        );
        totals.errores++;
      }
    }
  }

  console.log(
    `[cron/suscriptores] revisados:${totals.revisados} enviados:${totals.enviados} ` +
      `saltados:${totals.saltados} enVenta:${totals.enVenta} errores:${totals.errores}`,
  );

  return NextResponse.json({ ok: true, ...totals });
}
