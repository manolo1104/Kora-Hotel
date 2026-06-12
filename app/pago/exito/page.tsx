import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { planPorClave } from "@/lib/oferta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pago confirmado | Kora",
  robots: { index: false },
};

export default async function PagoExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Confirmación best-effort: el estado real lo escribe el webhook.
  let planNombre: string | null = null;
  if (session_id && stripeEnvReady) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      planNombre = planPorClave(session.metadata?.plan)?.nombre ?? null;
    } catch {
      // Si la sesión no se puede leer, mostramos el mensaje genérico.
    }
  }

  return (
    <main className="pt-16">
      <section className="py-20 sm:py-28 bg-kora-bg min-h-[70vh]">
        <div className="max-w-md mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 sm:p-10">
              <div className="w-16 h-16 rounded-full bg-kora-accent/20 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={34} className="text-kora-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
                ¡Tu plan está activo!
              </h1>
              <p className="mt-3 text-kora-muted text-sm leading-relaxed">
                {planNombre
                  ? `Bienvenido al plan ${planNombre} de Kora. `
                  : "Bienvenido a Kora. "}
                Tu recibo llega a tu correo. El siguiente paso es configurar tu
                hotel: te toma unos 5 minutos.
              </p>
              <Link
                href="/panel"
                className="btn-press btn-fill mt-7 inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Configurar mi hotel
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <p className="mt-5 text-xs text-kora-muted leading-relaxed">
                ¿Dudas? Escríbenos por WhatsApp — soy Manolo, el fundador, y te
                contesto yo.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
