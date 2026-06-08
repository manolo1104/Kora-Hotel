import { requireCrmAuth } from "@/lib/crm/auth";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { ETAPA_LABEL, type Lead } from "@/lib/crm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  const header = cols.map(([, l]) => cell(l)).join(",");
  const rows = (data as Lead[]).map((lead) =>
    cols
      .map(([k]) => cell(k === "etapa" ? ETAPA_LABEL[lead.etapa] : lead[k]))
      .join(",")
  );
  const csv = "﻿" + [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kora-crm-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
