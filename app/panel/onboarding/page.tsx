import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { alcanzoTopeDeHoteles } from "@/lib/tenant";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crear mi hotel | Kora",
  robots: { index: false },
};

export default async function OnboardingPage() {
  if (!supabaseEnvReady) redirect("/panel");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Sin sesión: al entrar regresa directo aquí a cargar los datos del hotel.
  if (!user) redirect("/entrar?next=/panel/onboarding");

  // Tope por cuenta: si ya llegó al máximo de hoteles propios, no dejamos entrar
  // al alta (bloquea también el acceso directo por URL).
  if ((await alcanzoTopeDeHoteles(user.id)).alcanzado) redirect("/panel");

  return (
    <main className="pt-16">
      <section className="py-12 sm:py-16 bg-kora-bg min-h-[80vh]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <OnboardingClient />
        </div>
      </section>
    </main>
  );
}
