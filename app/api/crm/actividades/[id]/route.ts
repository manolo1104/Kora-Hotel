import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/crm/actividades/:id
export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  const { id } = await params;

  const supabase = createAdminClient();
  const { error } = await supabase.from("crm_actividades").delete().eq("id", id);
  if (error) {
    console.error("[crm.actividades.borrar]", error.message);
    return NextResponse.json({ error: "No se pudo completar la operación. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
