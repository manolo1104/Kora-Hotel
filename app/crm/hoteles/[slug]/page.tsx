import Link from "next/link";
import { notFound } from "next/navigation";
import { isCrmAuthed } from "@/lib/crm/auth";
import { adminEnvReady } from "@/lib/supabase/admin";
import { cargarFichaHotel } from "@/lib/crm/ficha";
import { FichaHotel } from "@/components/crm/FichaHotel";

export const dynamic = "force-dynamic";

// Las esperas de fuera se SUMAN, igual que en /crm (app/crm/page.tsx): las
// cuentas de Auth (8 s), el servidor de Camila (4 s), un conteo por hotel del
// saldo y, después, Stripe Connect (10 s) y las suscripciones de Stripe (15 s).
// Con el tope corto por defecto, un Stripe lento mata la función y el fundador
// ve la pantalla de error de la plataforma en vez de la ficha con la banda roja
// que `cargarFichaHotel` promete. 60 s cabe en cualquier plan de Vercel.
export const maxDuration = 60;

// La ficha de un hotel: todo lo que se sabe de él y los botones para gestionarlo.
// Carga en el servidor (service-role, Stripe, servidor de Camila) y le pasa al
// componente sólo datos planos.
export default async function CrmFichaHotelPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!adminEnvReady || !(await isCrmAuthed())) return null;
  const { slug } = await params;

  const r = await cargarFichaHotel(slug);
  if (r.tipo === "no-existe") notFound();
  if (r.tipo === "error") {
    // Con la base caída NO se manda a un 404: el hotel puede existir.
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <Link href="/crm/hoteles" className="text-sm text-kora-muted hover:text-kora-text">
          ← Hoteles
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-800">No se pudo abrir la ficha</p>
          <p className="mt-1 text-sm text-red-700">{r.detalle}</p>
        </div>
      </main>
    );
  }

  return <FichaHotel ficha={r.ficha} />;
}
