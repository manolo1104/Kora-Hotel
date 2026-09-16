import { isCrmAuthed } from "@/lib/crm/auth";
import { adminEnvReady } from "@/lib/supabase/admin";
import { cargarOperaciones } from "@/lib/crm/operaciones";
import { Operaciones } from "@/components/crm/Operaciones";

export const dynamic = "force-dynamic";

// Las esperas de fuera se suman: Stripe (hasta 15 s), el servidor de Camila
// (4 s), las cuentas de Auth (8 s por página) y un conteo por hotel del saldo.
// Si la función tiene el tope corto por defecto, un Stripe lento puede tumbar la
// página entera en vez de sacarla con la banda roja, que es justo lo que promete
// `cargarOperaciones`. 60 s cabe en cualquier plan de Vercel.
export const maxDuration = 60;

// La casa del CRM es el panel de operaciones, no el tablero de leads.
//
// El tablero se mudó a /crm/leads. El fundador abre esto para saber qué se está
// por caer hoy; los leads son una de las respuestas, no la única — y era la
// única que se veía. Un marcador viejo a /crm cae aquí, que enlaza a todo.
//
// 15 sep 2026: pasa a ser la vista de TODO el negocio (MRR según Stripe, embudo
// de alta, registrados sin hotel, cobros y Camila por hotel). Ojo al tiempo de
// carga: `cargarOperaciones` espera a Stripe y al servidor de Camila, cada uno
// con su tope (lib/crm/fuentes.ts). Si uno no contesta, la página sale igual y
// lo dice en la banda roja.
export default async function CrmPage() {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const datos = await cargarOperaciones();
  return <Operaciones datos={datos} />;
}
