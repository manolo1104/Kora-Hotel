import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Reveal } from "@/components/shared/Reveal";
import { LogoutButton } from "@/components/panel/LogoutButton";
import { PanelEditor } from "@/components/panel/PanelEditor";
import { SuscripcionCard } from "@/components/panel/SuscripcionCard";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { getSuscripcion, tienePlanActivo } from "@/lib/suscripcion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi panel | Kora",
  robots: { index: false },
};

export default async function PanelPage() {
  if (!supabaseEnvReady) {
    return (
      <main className="pt-16">
        <section className="py-20 bg-kora-bg min-h-[60vh]">
          <div className="max-w-md mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-kora-text">Configuración pendiente</h1>
            <p className="mt-3 text-kora-muted text-sm leading-relaxed">
              El panel se activará en cuanto se configure la base de datos.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const suscripcion = await getSuscripcion(user.id);
  const planActivo = tienePlanActivo(suscripcion);

  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-kora-bg min-h-[60vh]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                  Tu panel
                </h1>
                <p className="mt-1 text-sm text-kora-muted">{user.email}</p>
              </div>
              <LogoutButton />
            </div>
          </Reveal>

          <SuscripcionCard
            plan={suscripcion?.plan ?? null}
            estado={suscripcion?.estado ?? null}
            esStripe={Boolean(suscripcion?.stripe_customer_id)}
          />

          <PanelEditor userId={user.id} planActivo={planActivo} />
        </div>
      </section>
    </main>
  );
}
