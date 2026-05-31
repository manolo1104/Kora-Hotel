import type { Metadata } from "next";
import { Reveal } from "@/components/shared/Reveal";
import { AuthForm } from "@/components/panel/AuthForm";

export const metadata: Metadata = {
  title: "Entrar | Kora",
  description: "Entra para crear y editar tu mini-página de reservas gratis.",
  robots: { index: false },
  alternates: { canonical: "/entrar" },
};

export default function EntrarPage() {
  return (
    <main className="pt-16">
      <section className="py-16 sm:py-24 bg-kora-bg min-h-[70vh]">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-kora-text tracking-tight">
                Tu mini-página gratis
              </h1>
              <p className="mt-3 text-kora-muted text-sm leading-relaxed">
                Entra o crea tu cuenta para armar tu página de reservas directas y
                tu guía del huésped, sin costo.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <AuthForm />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
