import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { HerramientasPanelClient } from "@/components/panel/HerramientasPanelClient";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { getHotelesDelUsuario } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Herramientas con IA | Kora",
  robots: { index: false },
};

export default async function PanelHerramientasPage() {
  if (!supabaseEnvReady) redirect("/panel");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const hoteles = await getHotelesDelUsuario();
  // Si el usuario tiene un solo hotel, prellenamos su nombre en las herramientas.
  const hotelNombre = hoteles.length === 1 ? hoteles[0].hotel.nombre : "";

  return (
    <main className="pt-16">
      <section className="py-12 sm:py-16 bg-kora-bg min-h-[70vh]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Link
              href="/panel"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-primary transition-colors"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Mis hoteles
            </Link>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kora-accent/15">
                <Sparkles size={13} className="text-kora-primary" aria-hidden="true" />
                <span className="text-[11px] font-bold text-kora-primary uppercase tracking-widest">
                  Incluido en tu plan
                </span>
              </span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Herramientas con IA
            </h1>
            <p className="mt-1 text-sm text-kora-muted max-w-xl">
              Responde reseñas, escribe mensajes de WhatsApp y descripciones en segundos. La genera
              una IA — revísala y ajústala antes de enviarla.
            </p>
          </Reveal>

          <div className="mt-8">
            <HerramientasPanelClient hotelNombre={hotelNombre} />
          </div>
        </div>
      </section>
    </main>
  );
}
