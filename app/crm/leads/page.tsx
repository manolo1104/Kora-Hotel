import { isCrmAuthed } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { CrmApp } from "@/components/crm/CrmApp";
import type { Lead } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("crm_leads")
    .select("*")
    .order("updated_at", { ascending: false });
  return <CrmApp initialLeads={(data as Lead[]) ?? []} />;
}
