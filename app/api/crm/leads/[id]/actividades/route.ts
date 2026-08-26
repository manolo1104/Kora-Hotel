import { escribirMejorEsfuerzo } from "@/lib/db/result";
import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { TIPOS_ACTIVIDAD } from "@/lib/crm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const TIPO_IDS = TIPOS_ACTIVIDAD.map((t) => t.id) as string[];

// GET → actividades del lead
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_actividades")
    .select("*")
    .eq("lead_id", id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[crm.actividades.listar]", error.message);
    return NextResponse.json({ error: "No se pudo cargar. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ actividades: data });
}

// POST → registra una actividad (llamada/correo/whatsapp/reunion/nota)
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const tipo = typeof body.tipo === "string" && TIPO_IDS.includes(body.tipo) ? body.tipo : "nota";
  const nota = typeof body.nota === "string" && body.nota.trim() ? body.nota.trim() : null;
  const fecha =
    typeof body.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fecha)
      ? body.fecha
      : new Date().toISOString().slice(0, 10);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_actividades")
    .insert({ lead_id: id, tipo, nota, fecha })
    .select("*")
    .single();
  // El mensaje crudo de Postgres ya no sale al navegador; queda en el log.
  if (error) {
    console.error("[crm/actividades] insert:", error.message);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
  // Toca el lead para que suba en la lista por updated_at. Mejor-esfuerzo
  // declarado: sólo afecta el orden de una lista.
  await escribirMejorEsfuerzo(
    "crm_leads.tocar",
    supabase.from("crm_leads").update({ updated_at: new Date().toISOString() }).eq("id", id),
  );
  return NextResponse.json({ actividad: data });
}
