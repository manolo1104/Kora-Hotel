import { isCrmAuthed } from "@/lib/crm/auth";
import { adminEnvReady } from "@/lib/supabase/admin";
import { cargarOperaciones } from "@/lib/crm/operaciones";
import { Operaciones } from "@/components/crm/Operaciones";

export const dynamic = "force-dynamic";

// La casa del CRM es el panel de operaciones, no el tablero de leads.
//
// El tablero se mudó a /crm/leads. El fundador abre esto para saber qué se está
// por caer hoy; los leads son una de las respuestas, no la única — y era la
// única que se veía. Un marcador viejo a /crm cae aquí, que enlaza a todo.
export default async function CrmPage() {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const datos = await cargarOperaciones();
  return <Operaciones datos={datos} />;
}
