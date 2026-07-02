import type { Metadata } from "next";
import { requireHotelMember } from "@/lib/tenant";
import { getConnectState } from "@/lib/stripe/connect";
import type { MiniExtras } from "@/lib/mini";
import { OnboardingHotelClient } from "./OnboardingHotelClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configura tu hotel | Kora",
  robots: { index: false },
};

// Continuación RESUMABLE del onboarding (pasos 3-6 de 6; los pasos 1-2 crean el
// hotel en /panel/onboarding). El progreso vive en extras.onboarding, así que
// el dueño puede cerrar el navegador y retomar donde iba. Navegar aquí también
// fija la cookie kora_active_slug (proxy), que /api/panel/connect necesita.
export default async function OnboardingHotelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireHotelMember(slug);
  const hotel = ctx.hotel;
  const extras = (hotel.extras ?? {}) as MiniExtras;

  // Estado real de cobros. Al volver del onboarding de Stripe (?ok / ?refresh)
  // se consulta EN VIVO: el cache puede ir detrás del webhook account.updated.
  const volviendoDeStripe = sp.ok !== undefined || sp.refresh !== undefined;
  const connect = await getConnectState(hotel.id, hotel.stripe_account_id, {
    live: volviendoDeStripe,
  });

  const habitacionesOk = Array.isArray(hotel.habitaciones) && hotel.habitaciones.length > 0;

  return (
    <main className="pt-16">
      <section className="py-12 sm:py-16 bg-kora-bg min-h-[80vh]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <OnboardingHotelClient
            slug={slug}
            hotelId={hotel.id}
            userId={ctx.userId}
            esDueno={ctx.rol === "dueno"}
            nombre={hotel.nombre}
            whatsapp={hotel.whatsapp ?? ""}
            fotosIniciales={hotel.fotos ?? []}
            habitacionesOk={habitacionesOk}
            publicadoInicial={hotel.publicado}
            reglasIniciales={{
              anticipoPct:
                typeof extras.reglas?.anticipoPct === "number" ? extras.reglas.anticipoPct : 50,
              minNoches:
                typeof extras.reglas?.minNoches === "number" ? extras.reglas.minNoches : 1,
              pagoEnHotel: extras.reglas?.pagoEnHotel === true,
            }}
            ishPctInicial={
              typeof extras.impuestos?.ishPct === "number" ? extras.impuestos.ishPct : 0
            }
            pasoGuardado={
              volviendoDeStripe
                ? 4
                : typeof extras.onboarding?.paso === "number"
                  ? extras.onboarding.paso
                  : 3
            }
            completado={extras.onboarding?.completado === true}
            chargesEnabled={connect.chargesEnabled}
            connectStatus={connect.onboardingStatus}
            requirementsDue={connect.requirementsDue}
          />
        </div>
      </section>
    </main>
  );
}
