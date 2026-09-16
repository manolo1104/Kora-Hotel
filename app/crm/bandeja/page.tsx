import { isCrmAuthed } from "@/lib/crm/auth";
import { adminEnvReady } from "@/lib/supabase/admin";
import { cargarBandeja } from "@/lib/crm/bandeja";
import { Bandeja } from "@/components/crm/Bandeja";

export const dynamic = "force-dynamic";

// La bandeja del fundador: lo que antes sólo llegaba por correo (las alertas del
// camino del dinero) o sólo se veía abriendo Supabase (los chats de la web que
// pidieron hablar con una persona), aquí y con botones para atenderlo.
//
// `?pestana=chats` / `?pestana=alertas` abren esa pestaña. Sin parámetro se abre
// la que tiene algo pendiente: el aviso de «chats escalados» de Operaciones
// apunta a `/crm/bandeja` a secas, y abrir en «Alertas: nada por atender» con
// tres chats esperando hacía creer que no había nada que hacer.
export default async function CrmBandejaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const { pestana } = await searchParams;
  const datos = await cargarBandeja();

  let inicial: "alertas" | "chats" = pestana === "chats" ? "chats" : "alertas";
  if (pestana !== "chats" && pestana !== "alertas") {
    // Un fallo al leer las alertas cuenta como pendiente: saltar a los chats
    // escondería la banda roja de «no se pudieron leer».
    const alertasPendientes =
      datos.alertas.estado === "ok"
        ? datos.alertas.data.alertas.some((a) => !a.atendida_at)
        : datos.alertas.estado === "error";
    const chatsPendientes =
      datos.chats.estado === "ok" ? datos.chats.data.chats.some((c) => c.estado !== "atendido") : false;
    if (!alertasPendientes && chatsPendientes) inicial = "chats";
  }
  return <Bandeja datos={datos} pestanaInicial={inicial} />;
}
