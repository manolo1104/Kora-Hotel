import type { Metadata } from "next";
import { Reveal } from "@/components/shared/Reveal";
import { AuthForm } from "@/components/panel/AuthForm";
import { planPorClave } from "@/lib/oferta";

export const metadata: Metadata = {
  title: "Entrar | Kora",
  description: "Entra a tu panel de Kora o crea tu cuenta para cargar tu hotel.",
  robots: { index: false },
  alternates: { canonical: "/entrar" },
};

// Solo permitimos destinos internos (evita open-redirect): debe empezar con
// una sola "/" y no con "//" ni "/\".
function destinoSeguro(v: string | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  return v;
}

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; next?: string }>;
}) {
  const { plan: planParam, next: nextParam } = await searchParams;
  const plan = planPorClave(planParam);
  // Prioridad del destino tras entrar: 1) plan (va al pago), 2) ?next= seguro
  // (ej. el onboarding), 3) el panel.
  const next = plan
    ? `/pago/iniciar?plan=${plan.clave}`
    : destinoSeguro(nextParam) ?? "/panel";

  // El título y el texto siguen la intención con la que llegó la persona:
  // activar la prueba (pago), cargar su hotel (onboarding) o entrar al panel.
  const vaAlOnboarding = next.startsWith("/panel/onboarding");
  const titulo = plan
    ? "Activa tus 30 días gratis"
    : vaAlOnboarding
      ? "Empieza a cargar tu hotel"
      : "Entra a tu panel";
  const detalle = plan
    ? `Crea tu cuenta o entra para empezar tu prueba de 30 días del ${plan.nombre}. Hoy no se cobra nada: el primer cargo ($${plan.precio.toLocaleString("es-MX")} MXN/mes) es hasta el día 31, y puedes cancelar antes.`
    : vaAlOnboarding
      ? "Crea tu cuenta o entra para cargar tus cuartos, precios y fotos. Te toma unos 5 minutos y no necesitas tarjeta."
      : "Entra o crea tu cuenta para administrar tu hotel y tu página de reservas directas.";

  return (
    <main className="pt-16">
      <section className="py-16 sm:py-24 bg-kora-bg min-h-[70vh]">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-kora-text tracking-tight">
                {titulo}
              </h1>
              <p className="mt-3 text-kora-muted text-sm leading-relaxed">
                {detalle}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <AuthForm next={next} />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
