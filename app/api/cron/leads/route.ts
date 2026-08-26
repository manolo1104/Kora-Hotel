import { NextResponse } from "next/server";
import { escribirMejorEsfuerzo } from "@/lib/db/result";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { emailLeadSecuencia, type LeadSecuencia } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── CRON de seguimiento a LEADS (1 vez al día, ver vercel.json) ──────────────
// Antes no existía nada: el formulario no pedía correo y el único seguimiento
// posible era que Manolo se acordara de escribir por WhatsApp. Un lead sin
// contactar salía del digest a las 24 h y se perdía en silencio.
//
// Toques: día 0 (lo manda /api/leads al entrar), día 3 y día 7. Después de eso
// no se vuelve a escribir — la secuencia se cierra sola.
//
// DEDUP atómico igual que en las secuencias del huésped: se reclama la fila en
// `lead_email_log` (UNIQUE lead_id,email_type) ANTES de enviar; si el envío
// falla, se libera para reintentar mañana.
//
// Un lead sale de la secuencia si: lo ganaste, lo perdiste, o marcaste
// `secuencia_pausada` (por ejemplo porque ya hablaste con él).
//
// Auth: Authorization: Bearer $CRON_SECRET.

const TOQUES: { tipo: LeadSecuencia; dia: number }[] = [
  { tipo: "lead_day3", dia: 3 },
  { tipo: "lead_day7", dia: 7 },
];

// Ventana de tolerancia: si el cron no corrió un día, el toque no se pierde.
// Cerrada por arriba para que un lead viejo no reciba la secuencia de golpe.
const TOLERANCIA_DIAS = 2;

// No tocar leads más viejos que esto (evita bombardear el histórico el primer
// día que este cron se enciende).
const MAX_ANTIGUEDAD_DIAS = 30;

interface LeadRow {
  id: string;
  tomador_nombre: string | null;
  hotel_nombre: string | null;
  email: string | null;
  etapa: string | null;
  secuencia_pausada: boolean | null;
  created_at: string | null;
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
    // Igual que en las otras secuencias: sin llave no se envía NI se marca, así
    // los leads quedan pendientes para cuando el correo esté configurado.
    return NextResponse.json({ ok: false, motivo: "Sin RESEND_API_KEY — sin envíos." });
  }

  const admin = createAdminClient();
  const desde = new Date(Date.now() - MAX_ANTIGUEDAD_DIAS * 86_400_000).toISOString();

  const { data: leadsRaw, error } = await admin
    .from("crm_leads")
    .select("id, tomador_nombre, hotel_nombre, email, etapa, secuencia_pausada, created_at")
    .gte("created_at", desde)
    .not("etapa", "in", '("ganado","perdido")')
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    // Columnas nuevas sin aplicar (falta el SQL) u otro error: reportar sin tronar.
    console.error("[cron/leads] error leyendo leads:", error.message);
    console.error("[cron.leads]", error.message);
    return NextResponse.json({ ok: false, error: "No se pudo completar la operación. Intenta de nuevo." }, { status: 500 });
  }

  const leads = ((leadsRaw ?? []) as LeadRow[]).filter(
    (l) => !l.secuencia_pausada && l.email && l.email.includes("@") && l.created_at,
  );

  const totals = { revisados: leads.length, enviados: 0, saltados: 0, errores: 0 };

  for (const lead of leads) {
    const edad = diasDesde(lead.created_at as string);

    for (const toque of TOQUES) {
      if (edad < toque.dia || edad > toque.dia + TOLERANCIA_DIAS) continue;

      // 1) Reclamar el envío (dedup por UNIQUE lead_id,email_type).
      const { data: claimed, error: claimErr } = await admin
        .from("lead_email_log")
        .upsert(
          { lead_id: lead.id, email_type: toque.tipo, email_destino: lead.email },
          { onConflict: "lead_id,email_type", ignoreDuplicates: true },
        )
        .select("id");

      if (claimErr) {
        totals.errores++;
        console.error(`[cron/leads] claim ${toque.tipo} (${lead.id}):`, claimErr.message);
        continue;
      }
      if (!claimed || claimed.length === 0) {
        totals.saltados++; // ya se le había mandado
        continue;
      }
      const logId = (claimed[0] as { id: string }).id;

      // 2) Enviar. Si falla, liberar la marca para reintentar mañana.
      const contenido = emailLeadSecuencia(toque.tipo, {
        nombre: lead.tomador_nombre ?? "",
        hotel: lead.hotel_nombre ?? undefined,
      });
      const envio = await enviarEmail({ to: lead.email as string, ...contenido });
      if (envio.ok) {
        totals.enviados++;
      } else {
        await escribirMejorEsfuerzo(
          "lead_email_log.liberar",
          admin.from("lead_email_log").delete().eq("id", logId),
        );
        totals.errores++;
      }
    }
  }

  console.log(
    `[cron/leads] revisados:${totals.revisados} enviados:${totals.enviados} ` +
      `saltados:${totals.saltados} errores:${totals.errores}`,
  );

  return NextResponse.json({ ok: true, ...totals });
}
