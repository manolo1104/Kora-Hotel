import type { Metadata } from "next";
import { requireHotelMember } from "@/lib/tenant";
import { getConnectState } from "@/lib/stripe/connect";
import { accesoDelHotel } from "@/lib/suscripcion";
import { puedeCtx } from "@/lib/panel/permisos";
import { motivoCierre } from "@/lib/panel/pantallas";
import { estadoDelMotor } from "@/lib/panel/primeros-pasos";
import type { MiniExtras } from "@/lib/mini";
import { OnboardingHotelClient } from "./OnboardingHotelClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configura tu hotel | Kora",
  robots: { index: false },
};

// Continuación RESUMABLE del onboarding (pasos 3-6 de 6; los pasos 1-2 crean el
// hotel en /panel/onboarding). El progreso vive en extras.onboarding, así que
// el dueño puede cerrar el navegador y retomar donde iba. El paso de cobros
// (/api/panel/connect) resuelve el hotel por la PESTAÑA —la cabecera
// x-kora-hotel y el Referer, ambos con este /panel/<slug>/…—; la cookie que
// antes lo sostenía se retiró el 2 sep 2026.
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
  const [connect, acceso] = await Promise.all([
    getConnectState(hotel.id, hotel.stripe_account_id, { live: volviendoDeStripe }),
    accesoDelHotel(hotel),
  ]);

  // Qué hace HOY su motor si alguien paga. Las pantallas del alta decían que sin
  // Stripe «el huésped reservará por WhatsApp», y era falso: el motor cobraba en
  // la cuenta de Kora. Desde el 15 sep 2026 un hotel en prueba sin cobros listos
  // SIMULA el pago, y el asistente tiene que decir exactamente eso. Se decide
  // con la misma regla que el motor (`decidirModoPrueba`), usando el estado de
  // Connect que ya se leyó arriba —en vivo si vuelve de Stripe— para no pedirlo
  // dos veces.
  const estadoMotor = estadoDelMotor({
    acceso,
    cobrosListos: Boolean(connect.chargesEnabled && connect.accountId),
    demo: extras.demo === true,
  });

  const habitacionesOk = Array.isArray(hotel.habitaciones) && hotel.habitaciones.length > 0;
  // El chat de prueba y el QR viven en la pantalla de Camila; los cobros, en
  // Pagos (sólo el dueño). No se enlaza a nada que termine en «no tienes permiso».
  const camilaAbierta = motivoCierre(ctx.rol, ctx.pantallas, "camila") === null;

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
            estadoMotor={estadoMotor}
            puedeProbarCamila={camilaAbierta && puedeCtx(ctx, "bot:leer")}
            puedeVerPagos={puedeCtx(ctx, "pagos:ver")}
          />
        </div>
      </section>
    </main>
  );
}
