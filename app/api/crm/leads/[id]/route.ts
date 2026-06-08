import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { sanitizeLead } from "@/lib/crm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/crm/leads/:id  → lead + sus actividades
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: lead, error } = await supabase.from("crm_leads").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  const { data: actividades } = await supabase
    .from("crm_actividades")
    .select("*")
    .eq("lead_id", id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  return NextResponse.json({ lead, actividades: actividades ?? [] });
}

// PATCH /api/crm/leads/:id  → edita campos / cambia etapa
export async function PATCH(req: Request, { params }: Ctx) {
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
  const { data, error } = sanitizeLead(body, "patch");
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!data || Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: lead, error: dbErr } = await supabase
    .from("crm_leads")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ lead });
}

// DELETE /api/crm/leads/:id
export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { error } = await supabase.from("crm_leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
