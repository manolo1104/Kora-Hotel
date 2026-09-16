import { isCrmAuthed } from "@/lib/crm/auth";
import { adminEnvReady } from "@/lib/supabase/admin";
import { cargarPrepago } from "@/lib/saldo/prepago-crm";
import { Prepago } from "@/components/crm/Prepago";

export const dynamic = "force-dynamic";

// Mismo motivo que /crm y /crm/hoteles: `cargarPrepago` cuenta el consumo de
// Camila HOTEL POR HOTEL (`saldosPorHotel`, una consulta de conteo por hotel, de
// 8 en 8) y después pregunta por los movimientos de la recarga de seguridad. Con
// el tope corto por defecto de la plataforma, una base lenta mata la página y el
// fundador ve el error genérico en vez de la pantalla con su banda roja. Y esta
// es la pantalla desde la que se decide callar a Camila: tiene que abrir.
export const maxDuration = 60;

// El prepago de Camila: los dos interruptores (recargas y bloqueo), la recarga
// de seguridad, los regalos a todos y el saldo de cada hotel.
//
// Antes todo esto era un script de la terminal y dos variables de Vercel. Carga
// en el servidor (service-role) y le pasa al componente sólo datos planos; los
// botones llaman a /api/crm/saldo, que es donde viven los candados.
export default async function CrmPrepagoPage() {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const datos = await cargarPrepago();
  return <Prepago inicial={datos} />;
}
