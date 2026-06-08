import { notFound } from "next/navigation";
import { isCrmAuthed } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { LeadDetail } from "@/components/crm/LeadDetail";
import type { Lead, Actividad } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: lead } = await supabase.from("crm_leads").select("*").eq("id", id).single();
  if (!lead) notFound();
  const { data: actividades } = await supabase
    .from("crm_actividades")
    .select("*")
    .eq("lead_id", id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  return <LeadDetail initialLead={lead as Lead} initialActs={(actividades as Actividad[]) ?? []} />;
}
