import { CircleAlert } from "lucide-react";
import { isCrmAuthed } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { CrmApp } from "@/components/crm/CrmApp";
import type { Lead } from "@/lib/crm/types";

export const dynamic = "force-dynamic";

/** «Esa tabla no existe aquí»: falta correr su SQL, no es una avería. */
const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);

export default async function CrmPage() {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_leads")
    .select("*")
    .order("updated_at", { ascending: false });

  // Antes el `error` se ignoraba: con la base caída la página decía «Aún no
  // tienes leads» y el tablero invitaba a crear uno nuevo encima de una tabla
  // que no respondía. El silencio y el cero tienen que verse distintos (la
  // misma regla que /crm), así que un fallo se enseña como fallo y no se pinta
  // el tablero vacío.
  if (error) {
    const faltaSql = TABLA_AUSENTE.has((error as { code?: string }).code ?? "");
    if (!faltaSql) console.error("[crm/leads] no se pudieron leer los leads:", error.message);
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <h1 className="text-xl font-bold text-kora-text">Mis prospectos</h1>
        {faltaSql ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-kora-text">Falta terminar de instalar</p>
            <p className="mt-1 text-sm text-kora-muted">
              Falta correr sql/kora-crm-schema.sql: todavía no existe la tabla de leads.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-red-800">
              <CircleAlert className="h-4 w-4" /> No se pudieron leer los leads
            </p>
            <p className="mt-1 text-sm text-red-700">
              No es que no haya ninguno: la consulta falló. Recarga la página en un momento; si sigue igual,
              la base de datos no está respondiendo.
            </p>
          </div>
        )}
      </main>
    );
  }

  return <CrmApp initialLeads={(data as Lead[]) ?? []} />;
}
