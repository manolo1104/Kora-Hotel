import { leer } from "@/lib/db/result";
import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { requireCrmMutacion } from "@/lib/crm/guardas";
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
  if (error) {
    console.error("[crm.lead.leer]", error.message);
    return NextResponse.json({ error: "No se pudo completar la operación. Intenta de nuevo." }, { status: 404 });
  }
  const actividades = await leer(
    "crm.lead.actividades",
    supabase
      .from("crm_actividades")
      .select("*")
      .eq("lead_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  );
  return NextResponse.json({ lead, actividades: actividades ?? [] });
}

// PATCH /api/crm/leads/:id  → edita campos / cambia etapa
//
// `requireCrmMutacion`: además de la sesión, comprueba que la petición salga del
// propio CRM (cabecera `Origin`). La cookie va con `path: "/"` en el mismo
// dominio que las páginas públicas de los hoteles, así que sin esto una página
// de fuera podía editar o borrar leads con la sesión del fundador.
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireCrmMutacion(req);
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
  // El mensaje crudo de Postgres queda en el log, no en el navegador.
  if (dbErr) {
    console.error("[crm.lead.editar]", dbErr.message);
    return NextResponse.json({ error: "No se pudo guardar el cambio. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ lead });
}

// DELETE /api/crm/leads/:id
export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireCrmMutacion(req);
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { error } = await supabase.from("crm_leads").delete().eq("id", id);
  if (error) {
    console.error("[crm.lead.editar]", error.message);
    return NextResponse.json({ error: "No se pudo completar la operación. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
