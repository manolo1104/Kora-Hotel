import { requireCrmAuth } from "@/lib/crm/auth";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { ETAPA_LABEL, type Lead } from "@/lib/crm/types";
import { armarCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/crm/export → descarga CSV de todos los leads
export async function GET() {
  const denied = await requireCrmAuth();
  if (denied) return denied;
  if (!adminEnvReady)
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[crm.export]", error.message);
    return NextResponse.json({ error: "No se pudo completar la operación. Intenta de nuevo." }, { status: 500 });
  }

  const cols: [keyof Lead, string][] = [
    ["hotel_nombre", "Hotel"],
    ["tomador_nombre", "Tomador de decisiones"],
    ["tomador_puesto", "Puesto"],
    ["contacto", "Contacto"],
    ["email", "Correo"],
    ["ciudad", "Ciudad"],
    ["origen", "Origen"],
    ["etapa", "Etapa"],
    ["valor_estimado", "Valor estimado (MXN)"],
    ["proximo_seguimiento", "Próximo seguimiento"],
    ["notas", "Notas"],
    ["created_at", "Creado"],
  ];
  // `armarCsv` neutraliza las fórmulas. El nombre del hotel y las notas los
  // escribe cualquiera que rellene el formulario público de la landing, así que
  // una celda que empiece por `=` la ejecutaría Excel al abrir el archivo.
  const csv = armarCsv(
    cols.map(([, l]) => l),
    (data as Lead[]).map((lead) =>
      cols.map(([k]) => (k === "etapa" ? ETAPA_LABEL[lead.etapa] : lead[k])),
    ),
  );

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kora-crm-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
