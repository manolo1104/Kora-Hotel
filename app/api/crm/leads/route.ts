import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { requireCrmMutacion } from "@/lib/crm/guardas";
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
  if (error) {
    console.error("[crm.leads.listar]", error.message);
    return NextResponse.json({ error: "No se pudo completar la operación. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ leads: data });
}

// POST /api/crm/leads  → crea un lead
//
// `requireCrmMutacion` y no `requireCrmAuth`: la cookie `kora_crm` va con
// `path: "/"` y `sameSite: "lax"`, así que el navegador la manda a cualquier
// ruta de este dominio —el mismo que sirve las páginas públicas de los hoteles—
// y el repositorio es público. Sin la comprobación de `Origin`, una página de
// otro sitio podía crear leads con la sesión del fundador. Las rutas nuevas del
// CRM ya pasaban por aquí; estas se quedaron atrás.
export async function POST(req: Request) {
  const denied = await requireCrmMutacion(req);
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
  // El mensaje crudo de Postgres NO sale al navegador (nombra tablas, columnas y
  // restricciones); queda en el log, como en el resto del CRM.
  if (dbErr) {
    console.error("[crm.leads.crear]", dbErr.message);
    return NextResponse.json({ error: "No se pudo guardar el lead. Intenta de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ lead });
}
