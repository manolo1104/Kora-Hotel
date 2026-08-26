import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { planPorClave } from "@/lib/oferta";
import { getHotelesDelUsuario } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

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

  // Quién está viendo esta página. Hace falta antes de leer la sesión de Stripe.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  } catch {
    /* sin sesión legible: se cae al mensaje genérico */
  }

  // Confirmación best-effort: el estado real lo escribe el webhook.
  //
  // Antes bastaba con pegar CUALQUIER `session_id` de la cuenta plataforma —sin
  // sesión iniciada siquiera— para que la página gritara "¡Tu plan está activo!"
  // con el nombre del plan de un cliente ajeno. Ahora se comprueban tres cosas:
  // que la sesión esté PAGADA, y que sea de ESTE usuario.
  let planNombre: string | null = null;
  let pagoConfirmado = false;
  if (session_id && stripeEnvReady) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      const esDeEsteUsuario =
        Boolean(userId) &&
        (session.metadata?.user_id === userId || session.client_reference_id === userId);
      const pagada = session.payment_status === "paid" || session.status === "complete";
      if (esDeEsteUsuario && pagada) {
        pagoConfirmado = true;
        planNombre = planPorClave(session.metadata?.plan)?.nombre ?? null;
      }
    } catch {
      // Si la sesión no se puede leer, mostramos el mensaje genérico.
    }
  }

  // Siguiente paso sin fricción: si aún no tiene hotel, directo al onboarding;
  // si ya tiene, a su panel. (Best-effort: en caso de duda, al hub.)
  let siguienteHref = "/panel";
  try {
    const hoteles = await getHotelesDelUsuario();
    if (hoteles.length === 0) siguienteHref = "/panel/onboarding";
  } catch {
    // Sin sesión legible aquí, el hub resuelve.
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
                {pagoConfirmado ? "¡Tu plan está activo!" : "Gracias"}
              </h1>
              <p className="mt-3 text-kora-muted text-sm leading-relaxed">
                {pagoConfirmado ? (
                  <>
                    {planNombre
                      ? `Bienvenido al plan ${planNombre} de Kora. `
                      : "Bienvenido a Kora. "}
                    Tu recibo llega a tu correo. El siguiente paso es configurar
                    tu hotel: te toma unos 5 minutos.
                  </>
                ) : (
                  <>
                    Si tu pago se completó, tu recibo llega a tu correo y tu plan
                    aparece en tu panel en unos segundos. Entra a tu panel para
                    verlo.
                  </>
                )}
              </p>
              <Link
                href={siguienteHref}
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
