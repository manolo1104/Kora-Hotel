import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Página no encontrada — Kora",
  robots: { index: false },
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Kora`;

export default function NotFound() {
  return (
    <main className="pt-16">
      <section className="min-h-[calc(100dvh-4rem)] flex items-center justify-center px-4 py-16 bg-kora-bg">
        <div className="max-w-md w-full text-center">

          {/* Backdrop number */}
          <p
            className="text-[9rem] sm:text-[13rem] font-bold leading-none text-kora-primary/[0.07] select-none"
            aria-hidden="true"
          >
            404
          </p>

          {/* Content — overlaps the number */}
          <div className="-mt-8 sm:-mt-14 relative z-10 space-y-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
              Esta habitación no existe.
            </h1>
            <p className="text-kora-muted leading-relaxed max-w-xs mx-auto">
              La página que buscas está vacía. Pero si tu hotel tiene pocas
              reservas directas, eso sí lo podemos arreglar.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-primary text-white font-bold text-sm hover:bg-kora-primary-dark transition-colors"
              >
                Volver al inicio
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
              >
                Hablar con Manolo
              </a>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
