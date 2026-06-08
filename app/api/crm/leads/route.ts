import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { sanitizeLead } from "@/lib/crm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/crm/leads?q=&etapa=  → lista de leads
export async function GET(req: Request) {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const etapa = (searchParams.get("etapa") || "").trim();
  // Saneo: solo letras/números/espacios (evita romper o inyectar en el filtro .or()).
  const q = (searchParams.get("q") || "").replace(/[^\p{L}\p{N}\s]/gu, "").trim().slice(0, 80);

  const supabase = createAdminClient();
  let query = supabase.from("crm_leads").select("*").order("updated_at", { ascending: false });
  if (etapa) query = query.eq("etapa", etapa);
  if (q)
    query = query.or(
      `hotel_nombre.ilike.*${q}*,tomador_nombre.ilike.*${q}*,ciudad.ilike.*${q}*`
    );

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data });
}

// POST /api/crm/leads  → crea un lead
export async function POST(req: Request) {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const { data, error } = sanitizeLead(body, "create");
  if (error) return NextResponse.json({ error }, { status: 400 });

  const supabase = createAdminClient();
  const { data: lead, error: dbErr } = await supabase
    .from("crm_leads")
    .insert(data!)
    .select("*")
    .single();
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ lead });
}
