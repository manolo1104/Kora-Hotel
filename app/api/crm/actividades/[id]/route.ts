import { NextResponse } from "next/server";
import { requireCrmMutacion } from "@/lib/crm/guardas";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/crm/actividades/:id
//
// `requireCrmMutacion`: sesión + que la petición salga del propio CRM. La cookie
// `kora_crm` viaja a todo el dominio, que es el mismo de las páginas públicas de
// los hoteles, así que la sola cookie no basta para borrar nada.
export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireCrmMutacion(req);
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
