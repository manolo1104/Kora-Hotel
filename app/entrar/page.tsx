import type { Metadata } from "next";
import { Reveal } from "@/components/shared/Reveal";
import { AuthForm } from "@/components/panel/AuthForm";
import { planPorClave } from "@/lib/oferta";

export const metadata: Metadata = {
  title: "Entrar | Kora",
  description: "Entra para crear y editar tu mini-página de reservas gratis.",
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

  return (
    <main className="pt-16">
      <section className="py-16 sm:py-24 bg-kora-bg min-h-[70vh]">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-kora-text tracking-tight">
                {plan ? `Tu plan ${plan.nombre}` : "Tu mini-página gratis"}
              </h1>
              <p className="mt-3 text-kora-muted text-sm leading-relaxed">
                {plan
                  ? `Crea tu cuenta o entra para activar tu plan ${plan.nombre} ($${plan.precio.toLocaleString("es-MX")} MXN/mes). Después del pago configuras tu hotel en 5 minutos.`
                  : "Entra o crea tu cuenta para armar tu página de reservas directas y tu guía del huésped, sin costo."}
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
