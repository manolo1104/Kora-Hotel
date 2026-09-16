import Link from "next/link";
import { notFound } from "next/navigation";
import { isCrmAuthed } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { LeadDetail } from "@/components/crm/LeadDetail";
import type { Lead, Actividad } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const { id } = await params;
  // Una URL con algo que no es un uuid es un 404, no una avería: Postgres
  // contestaría «sintaxis inválida para uuid» y eso se pintaría como si la base
  // estuviera caída. Se descarta antes de preguntar.
  if (!UUID.test(id)) notFound();

  const supabase = createAdminClient();
  // `maybeSingle` y no `single`: con `single`, «no hay fila» llega como ERROR y
  // no se podía separar de «la consulta falló». El error se miraba: la base caída
  // mandaba a un 404 que dice «este prospecto no existe» — y aquí se llega desde
  // la bandeja, justo después de crear el lead («Ver el lead»), así que el
  // fundador leía que lo que acababa de crear no existe.
  const { data: lead, error } = await supabase.from("crm_leads").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error(`[crm/lead] no se pudo leer el lead ${id}:`, error.message);
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <Link href="/crm/leads" className="text-sm text-kora-muted hover:text-kora-text">
          ← Prospectos
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">No se pudo abrir este prospecto</p>
          <p className="mt-1 text-sm text-red-700">
            No es que no exista: la consulta falló. Recarga en un momento; si sigue igual, la base de datos no
            está respondiendo.
          </p>
        </div>
      </main>
    );
  }
  if (!lead) notFound();
  const { data: actividades } = await supabase
    .from("crm_actividades")
    .select("*")
    .eq("lead_id", id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  return <LeadDetail initialLead={lead as Lead} initialActs={(actividades as Actividad[]) ?? []} />;
}
