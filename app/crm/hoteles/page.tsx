import { isCrmAuthed } from "@/lib/crm/auth";
import { adminEnvReady } from "@/lib/supabase/admin";
import { cargarListaHoteles } from "@/lib/crm/ficha";
import { HotelesAdmin } from "@/components/crm/HotelesAdmin";

export const dynamic = "force-dynamic";

// Mismo motivo que en /crm: `cargarListaHoteles` espera a las cuentas de Auth
// (8 s por página), al servidor de Camila (4 s) y a un conteo de consumo por
// hotel. Sin este tope, la lista larga muere en la plataforma en vez de salir
// con la banda roja de lo que no se pudo leer.
export const maxDuration = 60;

// Todos los hoteles, cada uno con la entrada a su ficha (/crm/hoteles/[slug]),
// que es donde están los botones: cortesía, días de prueba, saldo, demo y
// bloqueo.
//
// Antes esta página sólo servía para bloquear, y si la consulta fallaba decía
// «No hay hoteles todavía». Ahora un fallo se ve como fallo.
export default async function CrmHotelesPage() {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const datos = await cargarListaHoteles();
  return <HotelesAdmin datos={datos} />;
}
