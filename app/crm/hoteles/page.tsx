import { isCrmAuthed } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { bloqueoDelHotel } from "@/lib/suscripcion";
import { HotelesAdmin, type HotelAdminRow } from "@/components/crm/HotelesAdmin";

export const dynamic = "force-dynamic";

interface Row {
  slug: string;
  nombre: string;
  publicado: boolean | null;
  extras: Record<string, unknown> | null;
  created_at: string | null;
}

// Bloqueo de cuentas de hotel. Vive dentro del CRM porque comparte su login
// (contraseña del fundador) — ningún hotelero llega aquí.
export default async function CrmHotelesPage() {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hoteles")
    .select("slug, nombre, publicado, extras, created_at")
    .order("created_at", { ascending: true });

  const hoteles: HotelAdminRow[] = ((data as Row[]) ?? []).map((h) => {
    const bloqueo = bloqueoDelHotel(h.extras);
    return {
      slug: h.slug,
      nombre: h.nombre,
      publicado: h.publicado === true,
      demo: (h.extras ?? {}).demo === true,
      bloqueado: Boolean(bloqueo),
      mensaje: bloqueo?.mensaje ?? null,
      fecha: bloqueo?.fecha ?? null,
    };
  });

  return <HotelesAdmin initial={hoteles} />;
}
