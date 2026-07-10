import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { PanelEditor } from "@/components/panel/PanelEditor";
import { requireHotelMember } from "@/lib/tenant";
import { ownerTienePlanActivo } from "@/lib/suscripcion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editar sitio | Kora",
  robots: { index: false },
};

export default async function EditarSitioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Gate: redirige a /entrar si no hay sesión, a /panel si no es miembro.
  const ctx = await requireHotelMember(slug);
  // El gancho premium (quitar marca, etc.) depende del plan del DUEÑO del hotel,
  // no del usuario que edita (puede ser un encargado).
  const planActivo = await ownerTienePlanActivo(ctx.hotel.owner_id);

  return (
    <main className="pt-16">
      <section className="py-12 sm:py-16 bg-kora-bg min-h-[70vh]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Link
              href="/panel"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-text transition-colors"
            >
              <ArrowLeft size={15} /> Mis hoteles
            </Link>
            <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                  Editar sitio
                </h1>
                <p className="mt-1 text-sm text-kora-muted">{ctx.hotel.nombre}</p>
              </div>
              <Link
                href={`/panel/${slug}/insights`}
                className="btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-sm hover:bg-kora-primary-dark transition-colors"
              >
                <LayoutDashboard size={16} aria-hidden="true" />
                Ir a mi panel
              </Link>
            </div>
          </Reveal>

          <PanelEditor userId={ctx.userId} planActivo={planActivo} hotelSlug={slug} />
        </div>
      </section>
    </main>
  );
}
